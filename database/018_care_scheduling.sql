BEGIN;

-- ============================================================
-- 018_care_scheduling.sql
-- Add Customer Care Scheduling System tables:
--   care_schedule_settings, care_schedule_steps, care_schedule_events
-- ============================================================

-- 1. Create care_schedule_settings table
CREATE TABLE IF NOT EXISTS care_schedule_settings (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_group_id UUID NOT NULL UNIQUE REFERENCES customer_groups(id) ON DELETE CASCADE,
    cycle_days        INT NOT NULL DEFAULT 30,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_settings_group
    ON care_schedule_settings(customer_group_id);

-- Auto-update updated_at trigger
CREATE TRIGGER tr_care_settings_updated
    BEFORE UPDATE ON care_schedule_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE care_schedule_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY care_settings_admin ON care_schedule_settings
    FOR ALL USING (is_admin_or_staff());

-- 2. Create care_schedule_steps table
CREATE TABLE IF NOT EXISTS care_schedule_steps (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_id  UUID NOT NULL REFERENCES care_schedule_settings(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    days_offset INT NOT NULL DEFAULT 0,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_steps_setting
    ON care_schedule_steps(setting_id, sort_order);

-- Auto-update updated_at trigger
CREATE TRIGGER tr_care_steps_updated
    BEFORE UPDATE ON care_schedule_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE care_schedule_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY care_steps_admin ON care_schedule_steps
    FOR ALL USING (is_admin_or_staff());

-- 3. Create care_schedule_events table
CREATE TABLE IF NOT EXISTS care_schedule_events (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    step_id        UUID REFERENCES care_schedule_steps(id) ON DELETE SET NULL,
    setting_id     UUID REFERENCES care_schedule_settings(id) ON DELETE SET NULL,
    assigned_to    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    scheduled_date DATE NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'done', 'skipped', 'rescheduled')),
    notes          TEXT,
    completed_at   TIMESTAMPTZ,
    completed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    original_date  DATE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_events_customer
    ON care_schedule_events(customer_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_care_events_date
    ON care_schedule_events(scheduled_date) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_care_events_setting
    ON care_schedule_events(setting_id);

CREATE INDEX IF NOT EXISTS idx_care_events_status
    ON care_schedule_events(status, scheduled_date);

-- Auto-update updated_at trigger
CREATE TRIGGER tr_care_events_updated
    BEFORE UPDATE ON care_schedule_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE care_schedule_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY care_events_admin ON care_schedule_events
    FOR ALL USING (is_admin_or_staff());

COMMIT;
