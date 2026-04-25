BEGIN;

-- ============================================================
-- 010_crm_pipeline.sql
-- CRM Pipeline & Journey feature migration
-- ============================================================

-- 1A: Alter customers table
ALTER TABLE customers 
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;
-- NOT UNIQUE — one staff handles many customers
CREATE INDEX IF NOT EXISTS idx_customers_assigned_to ON customers(assigned_to) WHERE deleted_at IS NULL;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS source TEXT;
CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source) WHERE deleted_at IS NULL;

-- 1B: pipeline_columns
CREATE TABLE IF NOT EXISTS pipeline_columns (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT 'slate',
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_columns_sort ON pipeline_columns(sort_order);

-- 1C: pipeline_stages
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    column_id   UUID NOT NULL REFERENCES pipeline_columns(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    color       TEXT NOT NULL DEFAULT 'slate',
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_column ON pipeline_stages(column_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_sort ON pipeline_stages(column_id, sort_order);

-- 1D: customer_pipeline
CREATE TABLE IF NOT EXISTS customer_pipeline (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    stage_id    UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_pipeline_stage ON customer_pipeline(stage_id);

-- 1E: customer_stage_history
CREATE TABLE IF NOT EXISTS customer_stage_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    from_stage_id   UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    to_stage_id     UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
    note            TEXT NOT NULL,
    moved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    moved_by        UUID REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_stage_history_customer ON customer_stage_history(customer_id, moved_at DESC);

-- 1F: customer_activities
CREATE TABLE IF NOT EXISTS customer_activities (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    activity_type   TEXT NOT NULL 
                    CHECK (activity_type IN ('email','sms','zns','call','task','meeting','note','trao_doi','kh_phan_hoi')),
    title           TEXT NOT NULL,
    description     TEXT,
    assigned_to     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    related_project TEXT,
    created_by      UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activities_customer ON customer_activities(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON customer_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_created ON customer_activities(created_at DESC);

-- 1G: quotes
CREATE TABLE IF NOT EXISTS quotes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    code            TEXT NOT NULL UNIQUE,
    title           TEXT,
    amount          DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
    notes           TEXT,
    created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_code ON quotes(code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER tr_quotes_updated
    BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 1H: contracts
CREATE TABLE IF NOT EXISTS contracts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    code            TEXT NOT NULL UNIQUE,
    title           TEXT,
    amount          DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'expired', 'cancelled', 'renewed')),
    start_date      DATE,
    end_date        DATE,
    notes           TEXT,
    created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_contracts_customer ON contracts(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_code ON contracts(code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER tr_contracts_updated
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 1I: RLS Policies
ALTER TABLE pipeline_columns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_pipeline      ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts              ENABLE ROW LEVEL SECURITY;

-- Pipeline structure: readable by all authenticated
DROP POLICY IF EXISTS "pipeline_columns_read" ON pipeline_columns;
CREATE POLICY "pipeline_columns_read" ON pipeline_columns FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "pipeline_stages_read" ON pipeline_stages;
CREATE POLICY "pipeline_stages_read"  ON pipeline_stages  FOR SELECT USING (auth.role() = 'authenticated');

-- All customer data: admin/staff only
DROP POLICY IF EXISTS "customer_pipeline_admin" ON customer_pipeline;
CREATE POLICY "customer_pipeline_admin"   ON customer_pipeline      FOR ALL USING (is_admin_or_staff());

DROP POLICY IF EXISTS "customer_history_admin" ON customer_stage_history;
CREATE POLICY "customer_history_admin"    ON customer_stage_history  FOR ALL USING (is_admin_or_staff());

DROP POLICY IF EXISTS "customer_activities_admin" ON customer_activities;
CREATE POLICY "customer_activities_admin" ON customer_activities     FOR ALL USING (is_admin_or_staff());

DROP POLICY IF EXISTS "quotes_admin" ON quotes;
CREATE POLICY "quotes_admin"              ON quotes                  FOR ALL USING (is_admin_or_staff());

DROP POLICY IF EXISTS "contracts_admin" ON contracts;
CREATE POLICY "contracts_admin"           ON contracts               FOR ALL USING (is_admin_or_staff());

-- 1J: Seed Data
DO $$
DECLARE
  v_pre UUID; v_cons UUID; v_cskh UUID; v_post UUID;
  v_up  UUID; v_appr UUID; v_disb UUID; v_aft  UUID;
BEGIN
  INSERT INTO pipeline_columns (name, color, sort_order) VALUES ('Trước bán',     'blue',   1) RETURNING id INTO v_pre;
  INSERT INTO pipeline_columns (name, color, sort_order) VALUES ('Tư vấn',        'indigo', 2) RETURNING id INTO v_cons;
  INSERT INTO pipeline_columns (name, color, sort_order) VALUES ('CSKH',          'green',  3) RETURNING id INTO v_cskh;
  INSERT INTO pipeline_columns (name, color, sort_order) VALUES ('Sau bán',       'cyan',   4) RETURNING id INTO v_post;
  INSERT INTO pipeline_columns (name, color, sort_order) VALUES ('Upsale',        'orange', 5) RETURNING id INTO v_up;
  INSERT INTO pipeline_columns (name, color, sort_order) VALUES ('Phê duyệt',     'purple', 6) RETURNING id INTO v_appr;
  INSERT INTO pipeline_columns (name, color, sort_order) VALUES ('Giải ngân',     'teal',   7) RETURNING id INTO v_disb;
  INSERT INTO pipeline_columns (name, color, sort_order) VALUES ('Chăm sóc khác', 'amber',  8) RETURNING id INTO v_aft;

  -- Trước bán (2 stages)
  INSERT INTO pipeline_stages (column_id, name, color, sort_order) VALUES
    (v_pre, 'Tiếp cận ban đầu', 'blue', 1), (v_pre, 'Khách hàng mới', 'slate', 2);

  -- Tư vấn (3 stages)
  INSERT INTO pipeline_stages (column_id, name, description, color, sort_order) VALUES
    (v_cons, 'Quay lại sử dụng dịch vụ mới', NULL, 'blue', 1),
    (v_cons, 'Khách hàng để số', NULL, 'indigo', 2),
    (v_cons, 'Đã đặt lịch', 'Khách hàng đã đặt lịch tới cơ sở', 'emerald', 3);

  -- CSKH (8 stages)
  INSERT INTO pipeline_stages (column_id, name, description, color, sort_order) VALUES
    (v_cskh, 'Nguồn FB', NULL, 'blue', 1),
    (v_cskh, 'Test khách mới', NULL, 'amber', 2),
    (v_cskh, 'oads', NULL, 'slate', 3),
    (v_cskh, 'Data mới', 'KH đã nghe máy, cho phép giới thiệu và phần mềm', 'green', 4),
    (v_cskh, 'Khách hàng sắp quen', NULL, 'orange', 5),
    (v_cskh, 'Chăm sóc sau khám 6 tháng', 'KH đã chốt đơn, hoàn tất thanh toán', 'green', 6),
    (v_cskh, 'Chăm lại', NULL, 'emerald', 7),
    (v_cskh, 'Đã tiếp cận và chăm sóc', 'KH vừa mới có thông tin, chưa xử lý', 'teal', 8);

  -- Sau bán (3 stages)
  INSERT INTO pipeline_stages (column_id, name, color, sort_order) VALUES
    (v_post, 'Khách hàng tiềm năng', 'cyan', 1),
    (v_post, 'Test 2024', 'slate', 2),
    (v_post, 'Đã chăm sóc 2 lần', 'cyan', 3);

  -- Upsale (8 stages)
  INSERT INTO pipeline_stages (column_id, name, description, color, sort_order) VALUES
    (v_up, 'Hủy hẹn', NULL, 'red', 1),
    (v_up, 'Đối tác cấp 3', NULL, 'slate', 2),
    (v_up, 'Khách hàng A', 'Được import vào', 'amber', 3),
    (v_up, 'Một hai ba bốn', 'check xem đây có phải là nơi thêm status mới không', 'red', 4),
    (v_up, 'Thiết kế Quan hệ', 'Thiết kế Quan hệ', 'orange', 5),
    (v_up, 'Chưa tiếp cận', NULL, 'slate', 6),
    (v_up, 'Khách từ showroom', NULL, 'amber', 7),
    (v_up, 'Không tiềm năng do giá cao', NULL, 'slate', 8);

  -- Phê duyệt (6 stages)
  INSERT INTO pipeline_stages (column_id, name, description, color, sort_order) VALUES
    (v_appr, 'Đại lý cấp 1', NULL, 'purple', 1),
    (v_appr, 'Sai đối tượng', NULL, 'red', 2),
    (v_appr, 'Quan tâm', 'Đã gọi lọc, nhưng KH không nghe máy, máy bận', 'yellow', 3),
    (v_appr, 'Chăm sóc sau khám', NULL, 'teal', 4),
    (v_appr, 'Đến không mua', NULL, 'slate', 5),
    (v_appr, 'Chăm sóc sau', 'Đang tư vấn, KH quan tâm, nhưng chưa chốt được', 'red', 6);

  -- Giải ngân (4 stages)
  INSERT INTO pipeline_stages (column_id, name, color, sort_order) VALUES
    (v_disb, 'Data ngoài', 'slate', 1),
    (v_disb, 'Đối tác cấp 1', 'cyan', 2),
    (v_disb, 'Gọi lại sau 2 ngày', 'blue', 3),
    (v_disb, 'Đối tác cấp 2', 'cyan', 4);

  -- Chăm sóc khác (5 stages)
  INSERT INTO pipeline_stages (column_id, name, description, color, sort_order) VALUES
    (v_aft, 'Nuôi dưỡng', NULL, 'green', 1),
    (v_aft, 'Báo giá/Hợp đồng', NULL, 'amber', 2),
    (v_aft, 'Thất bại/Không chốt', NULL, 'red', 3),
    (v_aft, 'Hẹn tới phòng', 'KH quan tâm và...', 'teal', 4),
    (v_aft, 'Đại lý cấp 2', 'bí mật', 'purple', 5);
END $$;

COMMIT;
