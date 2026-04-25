BEGIN;

-- ============================================================
-- 016_customer_costs.sql
-- Customer Costs (Chi phí khách hàng) feature
-- Tracks expenses associated with each customer
-- ============================================================

-- 1. customer_costs table
CREATE TABLE IF NOT EXISTS customer_costs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount          DECIMAL(15, 2) NOT NULL DEFAULT 0,
    description     TEXT NOT NULL,
    cost_type       TEXT NOT NULL DEFAULT 'other'
                    CHECK (cost_type IN ('advertising', 'consulting', 'travel', 'gift', 'commission', 'other')),
    cost_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    notes           TEXT,
    created_by      UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customer_costs_customer ON customer_costs(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_costs_type ON customer_costs(cost_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_costs_date ON customer_costs(cost_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_costs_created ON customer_costs(created_at DESC);

-- 2. Auto-update updated_at trigger
CREATE OR REPLACE TRIGGER tr_customer_costs_updated
    BEFORE UPDATE ON customer_costs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. RLS
ALTER TABLE customer_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_costs_admin" ON customer_costs;
CREATE POLICY "customer_costs_admin" ON customer_costs FOR ALL USING (is_admin_or_staff());

COMMIT;
