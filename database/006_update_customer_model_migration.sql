-- Migration: Update Customer Model (Company -> Individual)
-- Description: Renames company-specific fields to individual-centric fields and updates dependent views.
-- Date: 2026-04-18

BEGIN;

-- 0. Drop dependent views first to avoid dependency errors
DROP VIEW IF EXISTS v_customer_activity;
DROP VIEW IF EXISTS v_active_customers;

-- 1. Rename columns in customers table
ALTER TABLE customers RENAME COLUMN company_name TO customer_name;
ALTER TABLE customers RENAME COLUMN contact_phone TO phone_number;

-- 2. Add email column (if not already handled via contact_email)
-- In the previous schema, contact_email existed. We should migrate its data if we want to keep it.
-- Let's check the previous state of the schema from the summary.
-- Previous fields: company_name, contact_name, contact_email, contact_phone, tax_code.
-- Since we are dropping contact_email but want an 'email' field, we can just rename it.
ALTER TABLE customers RENAME COLUMN contact_email TO email;

-- 3. Drop obsolete columns
ALTER TABLE customers DROP COLUMN IF EXISTS contact_name;
ALTER TABLE customers DROP COLUMN IF EXISTS tax_code;

-- 4. Update Views
-- View: v_active_customers
CREATE OR REPLACE VIEW v_active_customers AS
SELECT c.*, pr.display_name AS user_display_name, pr.role, pr.is_active
FROM customers c
LEFT JOIN profiles pr ON c.profile_id = pr.id
WHERE c.deleted_at IS NULL;

-- View: v_customer_activity
CREATE OR REPLACE VIEW v_customer_activity AS
SELECT 
    c.id AS customer_id,
    c.customer_name,
    c.phone_number,
    c.email,
    COUNT(vs.id) AS total_sessions,
    MAX(vs.started_at) AS last_viewed_at,
    COALESCE(SUM(vs.duration_seconds), 0) AS total_duration_seconds
FROM customers c
LEFT JOIN view_sessions vs ON vs.customer_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.customer_name, c.phone_number, c.email;

-- 5. Update Trigger Function handle_new_user
-- Ensure it uses phone as display_name if available
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.phone, new.email),
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'role', 'customer')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
