-- 022: Add product_group_id to price_list_items for dynamic group headers
ALTER TABLE price_list_items ADD COLUMN IF NOT EXISTS product_group_id UUID REFERENCES product_groups(id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_product_group ON price_list_items(product_group_id);
