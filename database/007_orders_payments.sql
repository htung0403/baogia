-- ============================================================
-- CRM QUOTATION SYSTEM - ADD ORDERS AND PAYMENTS
-- ============================================================

-- 1. ORDERS
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    code            TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    total_amount    DECIMAL(15, 2) NOT NULL DEFAULT 0,
    notes           TEXT,
    created_by      UUID REFERENCES profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_orders_customer ON orders(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_code ON orders(code) WHERE deleted_at IS NULL;

-- 2. ORDER ITEMS
CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    product_name    TEXT NOT NULL,
    quantity        INT NOT NULL DEFAULT 1,
    unit_price      DECIMAL(15, 2) NOT NULL,
    total_price     DECIMAL(15, 2) NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- 3. PAYMENTS
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
    code            TEXT NOT NULL UNIQUE,
    amount          DECIMAL(15, 2) NOT NULL,
    payment_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
    payment_method  TEXT NOT NULL DEFAULT 'transfer'
                    CHECK (payment_method IN ('cash', 'transfer', 'card')),
    status          TEXT NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    notes           TEXT,
    created_by      UUID REFERENCES profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_payments_order ON payments(order_id);

-- 4. TRIGGERS
CREATE TRIGGER tr_orders_updated
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_payments_updated
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. RLS POLICIES

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Admins and staff can view/edit everything
CREATE POLICY "Admins and staff can do everything on orders" ON orders
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff') AND is_active = true)
    );

CREATE POLICY "Admins and staff can do everything on order_items" ON order_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff') AND is_active = true)
    );

CREATE POLICY "Admins and staff can do everything on payments" ON payments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff') AND is_active = true)
    );

-- Customers can view their own orders and payments
CREATE POLICY "Customers view own orders" ON orders
    FOR SELECT USING (
        customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid())
    );

CREATE POLICY "Customers view own order_items" ON order_items
    FOR SELECT USING (
        order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid()))
    );

CREATE POLICY "Customers view own payments" ON payments
    FOR SELECT USING (
        customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid())
    );

-- 6. VIEWS FOR AGGREGATION
CREATE OR REPLACE VIEW v_customer_financials AS
SELECT 
    c.id AS customer_id,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.status != 'cancelled' AND o.deleted_at IS NULL), 0) AS total_revenue,
    COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) AS total_paid,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.status != 'cancelled' AND o.deleted_at IS NULL), 0) - 
    COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) AS total_debt
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
LEFT JOIN payments p ON c.id = p.customer_id
GROUP BY c.id;
