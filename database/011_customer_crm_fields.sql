BEGIN;

-- ============================================================
-- 011_customer_crm_fields.sql
-- Add CRM-related fields to customers table
-- Columns: tax_code, industry, customer_group, website, fax, skype, facebook
-- ============================================================

-- Tax identification number
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS tax_code TEXT;

-- Business industry / sector
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS industry TEXT;

-- Customer segmentation group (e.g. VIP, wholesale, retail)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_group TEXT;

-- Company website URL
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS website TEXT;

-- Fax number
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS fax TEXT;

-- Skype contact handle
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS skype TEXT;

-- Facebook profile or page URL
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS facebook TEXT;

-- Indices for frequently queried/filtered columns
CREATE INDEX IF NOT EXISTS idx_customers_tax_code
  ON customers(tax_code) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_customer_group
  ON customers(customer_group) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_industry
  ON customers(industry) WHERE deleted_at IS NULL;

COMMIT;
