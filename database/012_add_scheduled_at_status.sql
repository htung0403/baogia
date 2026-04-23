BEGIN;

-- ============================================================
-- 012_add_scheduled_at_status.sql
-- Add scheduled_at and status to customer_activities
-- ============================================================

ALTER TABLE customer_activities
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
-- NULL = not a scheduled meeting; filled only for activity_type='meeting'

ALTER TABLE customer_activities
  ADD COLUMN IF NOT EXISTS status TEXT
  CHECK (status IN ('pending', 'done', 'cancelled'));
-- NULL for non-meeting activities; explicit status for meetings

CREATE INDEX IF NOT EXISTS idx_activities_scheduled
  ON customer_activities(customer_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

COMMIT;
