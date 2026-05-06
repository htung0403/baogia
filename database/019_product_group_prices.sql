BEGIN;

-- ============================================================
-- 019_product_group_prices.sql
-- Add product_group_prices table for per-customer-group pricing
-- ============================================================

-- 1. Create product_group_prices table
CREATE TABLE IF NOT EXISTS product_group_prices (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_group_id UUID NOT NULL REFERENCES customer_groups(id) ON DELETE CASCADE,
    price             DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(product_id, customer_group_id)
);

CREATE INDEX IF NOT EXISTS idx_product_group_prices_product
    ON product_group_prices(product_id);

CREATE INDEX IF NOT EXISTS idx_product_group_prices_group
    ON product_group_prices(customer_group_id);

COMMENT ON TABLE product_group_prices IS 'Per-product pricing per customer group';

DROP TRIGGER IF EXISTS tr_product_group_prices_updated ON product_group_prices;
CREATE TRIGGER tr_product_group_prices_updated
    BEFORE UPDATE ON product_group_prices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE product_group_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pgp_admin_select ON product_group_prices;
CREATE POLICY pgp_admin_select ON product_group_prices
    FOR SELECT USING (is_admin_or_staff());

DROP POLICY IF EXISTS pgp_admin_insert ON product_group_prices;
CREATE POLICY pgp_admin_insert ON product_group_prices
    FOR INSERT WITH CHECK (is_admin_or_staff());

DROP POLICY IF EXISTS pgp_admin_update ON product_group_prices;
CREATE POLICY pgp_admin_update ON product_group_prices
    FOR UPDATE USING (is_admin_or_staff());

DROP POLICY IF EXISTS pgp_admin_delete ON product_group_prices;
CREATE POLICY pgp_admin_delete ON product_group_prices
    FOR DELETE USING (is_admin_or_staff());

COMMIT;
