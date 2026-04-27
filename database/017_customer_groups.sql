BEGIN;

-- ============================================================
-- 017_customer_groups.sql
-- Add customer_groups table with CRUD support
-- Add customer_group_id FK to customers table
-- ============================================================

-- 1. Create customer_groups table
CREATE TABLE IF NOT EXISTS customer_groups (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    code        TEXT UNIQUE,
    description TEXT,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_groups_name
    ON customer_groups(name);

CREATE INDEX IF NOT EXISTS idx_customer_groups_code
    ON customer_groups(code) WHERE code IS NOT NULL;

COMMENT ON TABLE customer_groups IS 'Customer segmentation groups (e.g. Đại lý cấp 1, Đại lý cấp 2)';

-- Auto-update updated_at trigger
CREATE TRIGGER tr_customer_groups_updated
    BEFORE UPDATE ON customer_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Seed default groups
INSERT INTO customer_groups (name, code, sort_order) VALUES
    ('Đại lý cấp 1', 'DL1', 1),
    ('Đại lý cấp 2', 'DL2', 2),
    ('Đại lý',       'DL',  3)
ON CONFLICT (code) DO NOTHING;

-- 3. Add customer_group_id FK to customers table
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS customer_group_id UUID REFERENCES customer_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_customer_group_id
    ON customers(customer_group_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN customers.customer_group_id IS 'FK to customer_groups – structured group assignment';

-- 4. Enable RLS on customer_groups
ALTER TABLE customer_groups ENABLE ROW LEVEL SECURITY;

-- Admin/staff: full CRUD
CREATE POLICY customer_groups_admin_select ON customer_groups
    FOR SELECT USING (is_admin_or_staff());

CREATE POLICY customer_groups_admin_insert ON customer_groups
    FOR INSERT WITH CHECK (is_admin_or_staff());

CREATE POLICY customer_groups_admin_update ON customer_groups
    FOR UPDATE USING (is_admin_or_staff());

CREATE POLICY customer_groups_admin_delete ON customer_groups
    FOR DELETE USING (is_admin_or_staff());

-- Authenticated customers: read-only (needed for PostgREST to resolve the FK relationship)
CREATE POLICY customer_groups_customer_select ON customer_groups
    FOR SELECT USING (auth.role() = 'authenticated');

COMMIT;
