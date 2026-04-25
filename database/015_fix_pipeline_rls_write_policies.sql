BEGIN;

-- ============================================================
-- 015_fix_pipeline_rls_write_policies.sql
-- Add INSERT/UPDATE/DELETE policies for pipeline_columns
-- and pipeline_stages (previously only had SELECT).
-- ============================================================

-- pipeline_columns: allow admin/staff full access
DROP POLICY IF EXISTS "pipeline_columns_admin" ON pipeline_columns;
CREATE POLICY "pipeline_columns_admin" ON pipeline_columns
  FOR ALL USING (is_admin_or_staff());

-- pipeline_stages: allow admin/staff full access
DROP POLICY IF EXISTS "pipeline_stages_admin" ON pipeline_stages;
CREATE POLICY "pipeline_stages_admin" ON pipeline_stages
  FOR ALL USING (is_admin_or_staff());

COMMIT;
