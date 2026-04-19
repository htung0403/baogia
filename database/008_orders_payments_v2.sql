-- ============================================================
-- MIGRATION 008: Order Management + Financial Tracking v2
-- ============================================================
-- Run AFTER 007_orders_payments.sql
-- 
-- Changes:
--   1. Extend orders table (discount, final_amount, order_date)
--   2. Migrate order status values
--   3. Extend order_items (price snapshot)
--   4. Extend payments (momo method, rename date field)
--   5. New customer_credits table (overpayment tracking)
--   6. Composite indexes for performance
--   7. Fix v_customer_financials (subquery, no cross-join)
--   8. New v_order_payment_summary view
--   9. Materialized view for scale
--  10. RPC functions for atomic transactions + concurrency
-- ============================================================

BEGIN;

-- ============================================================
-- 1. EXTEND ORDERS TABLE
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount    DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_date      TIMESTAMPTZ   NOT NULL DEFAULT now();

-- Backfill final_amount for existing rows (total - discount)
UPDATE orders SET final_amount = total_amount - discount_amount
WHERE final_amount = 0;

-- ============================================================
-- 2. MIGRATE ORDER STATUS VALUES
-- ============================================================

-- Temporarily drop the check constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Migrate existing data
UPDATE orders SET status = 'draft'     WHERE status = 'pending';
UPDATE orders SET status = 'confirmed' WHERE status IN ('processing', 'completed');

-- Re-add with new valid values
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('draft', 'confirmed', 'cancelled'));

-- ============================================================
-- 3. EXTEND ORDER_ITEMS TABLE
-- ============================================================

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS product_price_snapshot DECIMAL(15,2);

-- Backfill: use unit_price as the snapshot for existing rows
UPDATE order_items
SET product_price_snapshot = unit_price
WHERE product_price_snapshot IS NULL;

-- ============================================================
-- 4. EXTEND PAYMENTS TABLE
-- ============================================================

-- Drop old payment_method check to add 'momo'
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('cash', 'transfer', 'card', 'momo'));

-- Rename payment_date → paid_at (matches spec naming)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'payment_date'
  ) THEN
    ALTER TABLE payments RENAME COLUMN payment_date TO paid_at;
  END IF;
END;
$$;

-- Ensure payments have a proper status field (007 already has it, but verify check)
-- status ('pending', 'completed', 'failed', 'refunded') already defined in 007

-- ============================================================
-- 5. CUSTOMER CREDITS TABLE (overpayment / credit balance)
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_credits (
  id          UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID      NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  balance     DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_credits_customer
  ON customer_credits(customer_id);

-- ============================================================
-- 6. COMPOSITE INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_orders_customer_status
  ON orders(customer_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_status_date
  ON orders(status, order_date DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_customer_status
  ON payments(customer_id, status);

CREATE INDEX IF NOT EXISTS idx_payments_order_status
  ON payments(order_id, status);

-- ============================================================
-- 7. FIX v_customer_financials (subquery-based, no cross-join)
-- ============================================================

DROP VIEW IF EXISTS v_customer_financials CASCADE;

CREATE OR REPLACE VIEW v_customer_financials AS
SELECT
  c.id AS customer_id,
  COALESCE(o.total_orders_amount, 0)                           AS total_orders_amount,
  COALESCE(p.total_paid, 0)                                    AS total_paid,
  COALESCE(o.total_orders_amount, 0) - COALESCE(p.total_paid, 0) AS total_debt,
  COALESCE(cr.balance, 0)                                      AS credit_balance,
  p.last_payment_date
FROM customers c
LEFT JOIN (
  SELECT customer_id,
         SUM(final_amount) AS total_orders_amount
  FROM orders
  WHERE status = 'confirmed'
    AND deleted_at IS NULL
  GROUP BY customer_id
) o ON c.id = o.customer_id
LEFT JOIN (
  SELECT customer_id,
         SUM(amount)   AS total_paid,
         MAX(paid_at)  AS last_payment_date
  FROM payments
  WHERE status = 'completed'
  GROUP BY customer_id
) p ON c.id = p.customer_id
LEFT JOIN customer_credits cr ON c.id = cr.customer_id;

-- ============================================================
-- 8. v_order_payment_summary (per-order payment state)
-- ============================================================

CREATE OR REPLACE VIEW v_order_payment_summary AS
SELECT
  o.id                                               AS order_id,
  o.customer_id,
  o.code                                             AS order_code,
  o.status                                           AS order_status,
  o.total_amount,
  o.discount_amount,
  o.final_amount,
  COALESCE(SUM(p.amount), 0)                         AS total_paid,
  o.final_amount - COALESCE(SUM(p.amount), 0)        AS remaining,
  CASE
    WHEN o.status = 'cancelled'                          THEN 'cancelled'
    WHEN o.status = 'draft'                              THEN 'not_applicable'
    WHEN COALESCE(SUM(p.amount), 0) >= o.final_amount   THEN 'paid'
    WHEN COALESCE(SUM(p.amount), 0) > 0                 THEN 'partial'
    ELSE 'unpaid'
  END                                                AS payment_status
FROM orders o
LEFT JOIN payments p
  ON p.order_id = o.id
  AND p.status  = 'completed'
WHERE o.deleted_at IS NULL
GROUP BY o.id, o.customer_id, o.code, o.status,
         o.total_amount, o.discount_amount, o.final_amount;

-- ============================================================
-- 9. MATERIALIZED VIEW (for analytics at scale)
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_customer_financials AS
SELECT * FROM v_customer_financials;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_cust_fin_customer
  ON mv_customer_financials(customer_id);

-- ============================================================
-- 10. RPC FUNCTIONS FOR ATOMIC TRANSACTIONS
-- ============================================================

-- ────────────────────────────────────────────
-- 10a. fn_create_order
--      Atomically creates order + all items
--      Returns: order_id UUID
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_create_order(
  p_customer_id     UUID,
  p_created_by      UUID,
  p_code            TEXT,
  p_order_date      TIMESTAMPTZ,
  p_discount_amount DECIMAL,
  p_notes           TEXT,
  p_items           JSONB
  -- [{product_id, product_name, product_price_snapshot, quantity, unit_price, notes}]
) RETURNS UUID AS $$
DECLARE
  v_order_id   UUID;
  v_total      DECIMAL(15,2) := 0;
  v_item       JSONB;
  v_item_total DECIMAL(15,2);
  v_qty        INT;
  v_up         DECIMAL(15,2);
BEGIN
  -- Validate items not empty
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must have at least one item';
  END IF;

  -- Calculate total from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty  := (v_item->>'quantity')::INT;
    v_up   := (v_item->>'unit_price')::DECIMAL;
    v_item_total := v_qty * v_up;
    v_total      := v_total + v_item_total;
  END LOOP;

  -- Clamp discount to total
  IF p_discount_amount > v_total THEN
    RAISE EXCEPTION 'Discount cannot exceed order total';
  END IF;

  -- Insert order
  INSERT INTO orders (
    customer_id, created_by, code, status, order_date,
    total_amount, discount_amount, final_amount, notes
  ) VALUES (
    p_customer_id, p_created_by, p_code, 'draft', p_order_date,
    v_total, p_discount_amount, v_total - p_discount_amount, p_notes
  ) RETURNING id INTO v_order_id;

  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty        := (v_item->>'quantity')::INT;
    v_up         := (v_item->>'unit_price')::DECIMAL;
    v_item_total := v_qty * v_up;

    INSERT INTO order_items (
      order_id, product_id, product_name,
      product_price_snapshot, quantity, unit_price, total_price, notes
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'product_price_snapshot')::DECIMAL,
      v_qty,
      v_up,
      v_item_total,
      v_item->>'notes'
    );
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_create_order IS
  'Atomically creates order + items in one transaction. Calculates totals, validates discount.';

-- ────────────────────────────────────────────
-- 10b. fn_confirm_order
--      Locked status transition draft → confirmed
--      Validates: order exists, is draft, has items
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_confirm_order(
  p_order_id UUID,
  p_user_id  UUID
) RETURNS VOID AS $$
DECLARE
  var_current_status TEXT;
  v_item_count INT;
BEGIN
  -- Lock the order row to prevent concurrent modifications
  PERFORM id FROM orders WHERE id = p_order_id AND deleted_at IS NULL FOR UPDATE;
  var_current_status := (SELECT status FROM orders WHERE id = p_order_id AND deleted_at IS NULL);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or deleted';
  END IF;

  IF var_current_status != 'draft' THEN
    RAISE EXCEPTION 'Only draft orders can be confirmed. Current status: %', var_current_status;
  END IF;

  -- Validate has at least one item
  v_item_count := (SELECT COUNT(*) FROM order_items WHERE order_id = p_order_id);

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Cannot confirm an order with no items';
  END IF;

  UPDATE orders
  SET status = 'confirmed', updated_at = now()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_confirm_order IS
  'Atomic draft→confirmed transition with row-level lock. Validates item count.';

-- ────────────────────────────────────────────
-- 10c. fn_cancel_order
--      Locked cancellation
--      Rejects if completed payments exist
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_cancel_order(
  p_order_id UUID,
  p_user_id  UUID
) RETURNS VOID AS $$
DECLARE
  var_current_status TEXT;
  v_payment_total DECIMAL(15,2);
BEGIN
  -- Lock order row
  PERFORM id FROM orders WHERE id = p_order_id AND deleted_at IS NULL FOR UPDATE;
  var_current_status := (SELECT status FROM orders WHERE id = p_order_id AND deleted_at IS NULL);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or deleted';
  END IF;

  IF var_current_status = 'cancelled' THEN
    RAISE EXCEPTION 'Order is already cancelled';
  END IF;

  -- Check for completed payments
  v_payment_total := (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = p_order_id AND status = 'completed');

  IF v_payment_total > 0 THEN
    RAISE EXCEPTION
      'Cannot cancel order with %.0f VND in payments recorded. Please process refunds first.',
      v_payment_total;
  END IF;

  UPDATE orders
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_cancel_order IS
  'Atomic order cancellation with row-level lock. Rejects if completed payments exist.';

-- ────────────────────────────────────────────
-- 10d. fn_record_payment
--      Locked payment recording
--      SELECT FOR UPDATE on customer_credits prevents race conditions
--      Auto-updates credit balance for overpayments
--      Returns: payment_id UUID
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_record_payment(
  p_customer_id    UUID,
  p_order_id       UUID,    -- nullable: payment not tied to a specific order
  p_code           TEXT,
  p_amount         DECIMAL,
  p_payment_method TEXT,
  p_notes          TEXT,
  p_created_by     UUID
) RETURNS UUID AS $$
DECLARE
  v_payment_id    UUID;
  v_order_status  TEXT;
  v_total_orders  DECIMAL(15,2) := 0;
  v_total_paid    DECIMAL(15,2) := 0;
  v_net_debt      DECIMAL(15,2);
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  -- Validate payment method
  IF p_payment_method NOT IN ('cash', 'transfer', 'card', 'momo') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
  END IF;

  -- Ensure customer_credits row exists, then LOCK IT
  -- This is the key concurrency guard: all concurrent payments for same customer
  -- will queue here, preventing race conditions.
  INSERT INTO customer_credits (customer_id, balance)
  VALUES (p_customer_id, 0)
  ON CONFLICT (customer_id) DO NOTHING;

  PERFORM id FROM customer_credits
  WHERE customer_id = p_customer_id
  FOR UPDATE;

  -- If order-specific payment: validate order is confirmed
  IF p_order_id IS NOT NULL THEN
    v_order_status := (SELECT status FROM orders WHERE id = p_order_id AND deleted_at IS NULL);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order_status != 'confirmed' THEN
      RAISE EXCEPTION
        'Payments can only be recorded for confirmed orders. Order status: %',
        v_order_status;
    END IF;
  END IF;

  -- Insert payment record
  INSERT INTO payments (
    customer_id, order_id, code, amount, payment_method,
    status, notes, created_by, paid_at
  ) VALUES (
    p_customer_id, p_order_id, p_code, p_amount, p_payment_method,
    'completed', p_notes, p_created_by, now()
  ) RETURNING id INTO v_payment_id;

  -- Recalculate net debt for this customer (after inserting the payment)
  v_total_orders := (SELECT COALESCE(SUM(final_amount), 0) FROM orders WHERE customer_id = p_customer_id AND status = 'confirmed' AND deleted_at IS NULL);
  v_total_paid := (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE customer_id = p_customer_id AND status = 'completed');

  v_net_debt := v_total_orders - v_total_paid;

  -- Update credit balance:
  -- If net_debt < 0 → customer has credit (overpayment)
  -- If net_debt >= 0 → no credit
  UPDATE customer_credits
  SET balance    = CASE WHEN v_net_debt < 0 THEN ABS(v_net_debt) ELSE 0 END,
      updated_at = now()
  WHERE customer_id = p_customer_id;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_record_payment IS
  'Atomic payment recording with SELECT FOR UPDATE concurrency lock on customer_credits.
   Auto-updates credit balance for overpayments. Validates order status.';

-- ────────────────────────────────────────────
-- 10e. fn_refresh_financials
--      Refreshes materialized view concurrently
--      Safe to call after mutations
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_refresh_financials()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_financials;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_refresh_financials IS
  'Refreshes mv_customer_financials materialized view. Call after order/payment mutations.';

-- ────────────────────────────────────────────
-- 10f. fn_update_order (replace items atomically)
--      Only works on draft orders
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_update_order(
  p_order_id        UUID,
  p_discount_amount DECIMAL,
  p_notes           TEXT,
  p_items           JSONB
) RETURNS VOID AS $$
DECLARE
  var_current_status TEXT;
  v_total      DECIMAL(15,2) := 0;
  v_item       JSONB;
  v_item_total DECIMAL(15,2);
  v_qty        INT;
  v_up         DECIMAL(15,2);
BEGIN
  -- Lock and verify draft status
  PERFORM id FROM orders WHERE id = p_order_id AND deleted_at IS NULL FOR UPDATE;
  var_current_status := (SELECT status FROM orders WHERE id = p_order_id AND deleted_at IS NULL);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF var_current_status != 'draft' THEN
    RAISE EXCEPTION 'Only draft orders can be edited. Current status: %', var_current_status;
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must have at least one item';
  END IF;

  -- Delete old items
  DELETE FROM order_items WHERE order_id = p_order_id;

  -- Recalculate total + insert new items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty        := (v_item->>'quantity')::INT;
    v_up         := (v_item->>'unit_price')::DECIMAL;
    v_item_total := v_qty * v_up;
    v_total      := v_total + v_item_total;

    INSERT INTO order_items (
      order_id, product_id, product_name,
      product_price_snapshot, quantity, unit_price, total_price, notes
    ) VALUES (
      p_order_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'product_price_snapshot')::DECIMAL,
      v_qty, v_up, v_item_total,
      v_item->>'notes'
    );
  END LOOP;

  IF p_discount_amount > v_total THEN
    RAISE EXCEPTION 'Discount cannot exceed order total';
  END IF;

  UPDATE orders
  SET total_amount    = v_total,
      discount_amount = p_discount_amount,
      final_amount    = v_total - p_discount_amount,
      notes           = p_notes,
      updated_at      = now()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_update_order IS
  'Atomically replaces all order items and recalculates totals. Draft orders only.';

-- ============================================================
-- 11. RLS FOR customer_credits
-- ============================================================

ALTER TABLE customer_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and admin manage credits" ON customer_credits;
CREATE POLICY "Staff and admin manage credits" ON customer_credits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff')
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Customer views own credit" ON customer_credits;
CREATE POLICY "Customer views own credit" ON customer_credits
  FOR SELECT USING (
    customer_id IN (
      SELECT id FROM customers WHERE profile_id = auth.uid()
    )
  );

-- ============================================================
-- 12. TRIGGER: auto-update customer_credits.updated_at
-- ============================================================

DROP TRIGGER IF EXISTS tr_customer_credits_updated ON customer_credits;
CREATE TRIGGER tr_customer_credits_updated
  BEFORE UPDATE ON customer_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;

-- ============================================================
-- POST-MIGRATION: Refresh materialized view
-- (Run manually after applying this migration)
-- ============================================================
-- SELECT fn_refresh_financials();
