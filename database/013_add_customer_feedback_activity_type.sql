BEGIN;

-- ============================================================
-- 013_add_customer_feedback_activity_type.sql
-- Allow customer feedback as an activity type
-- ============================================================

ALTER TABLE customer_activities
  DROP CONSTRAINT IF EXISTS customer_activities_activity_type_check;

ALTER TABLE customer_activities
  ADD CONSTRAINT customer_activities_activity_type_check
  CHECK (
    activity_type IN (
      'email',
      'sms',
      'zns',
      'call',
      'task',
      'meeting',
      'note',
      'trao_doi',
      'kh_phan_hoi'
    )
  );

COMMIT;
