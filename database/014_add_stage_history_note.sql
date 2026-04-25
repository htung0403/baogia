BEGIN;

-- ============================================================
-- 014_add_stage_history_note.sql
-- Require note when moving customer stage
-- ============================================================

ALTER TABLE customer_stage_history
  ADD COLUMN IF NOT EXISTS note TEXT;

UPDATE customer_stage_history
SET note = 'Không có ghi chú'
WHERE note IS NULL OR btrim(note) = '';

ALTER TABLE customer_stage_history
  ALTER COLUMN note SET NOT NULL;

COMMIT;
