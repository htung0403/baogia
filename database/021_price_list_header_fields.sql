-- 021: Add header fields to price_lists for quotation header editing
ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS sales_person TEXT;
ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS sales_phone TEXT;
ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS notice_text TEXT;
ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS legend_blue_text TEXT;
ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS legend_yellow_text TEXT;
ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS legend_orange_text TEXT;
