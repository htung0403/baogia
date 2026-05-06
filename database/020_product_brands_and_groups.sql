  -- 020_product_brands_and_groups.sql
  -- Add brands and product_groups tables, link to products

  -- 1. Create brands table
  CREATE TABLE IF NOT EXISTS brands (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT,
    logo_url    TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX idx_brands_slug ON brands(slug);

  COMMENT ON TABLE brands IS 'Product brands (Thương hiệu)';

  -- 2. Create product_groups table
  CREATE TABLE IF NOT EXISTS product_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX idx_product_groups_slug ON product_groups(slug);

  COMMENT ON TABLE product_groups IS 'Product groups (Nhóm hàng)';

  -- 3. Add FK columns to products
  ALTER TABLE products
    ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id),
    ADD COLUMN IF NOT EXISTS product_group_id UUID REFERENCES product_groups(id);

  CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
  CREATE INDEX IF NOT EXISTS idx_products_product_group ON products(product_group_id);

  -- 4. Updated_at triggers
  DROP TRIGGER IF EXISTS tr_brands_updated ON brands;
  CREATE TRIGGER tr_brands_updated
    BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_product_groups_updated ON product_groups;
CREATE TRIGGER tr_product_groups_updated
  BEFORE UPDATE ON product_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

  -- 5. RLS
  ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
  ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;

  -- Brands policies
  DROP POLICY IF EXISTS brands_select_all ON brands;
  CREATE POLICY brands_select_all ON brands
    FOR SELECT USING (true);

  DROP POLICY IF EXISTS brands_admin_insert ON brands;
  CREATE POLICY brands_admin_insert ON brands
    FOR INSERT WITH CHECK (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff')
    );

  DROP POLICY IF EXISTS brands_admin_update ON brands;
  CREATE POLICY brands_admin_update ON brands
    FOR UPDATE USING (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff')
    );

  DROP POLICY IF EXISTS brands_admin_delete ON brands;
  CREATE POLICY brands_admin_delete ON brands
    FOR DELETE USING (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

  -- Product groups policies
  DROP POLICY IF EXISTS pgroups_select_all ON product_groups;
  CREATE POLICY pgroups_select_all ON product_groups
    FOR SELECT USING (true);

  DROP POLICY IF EXISTS pgroups_admin_insert ON product_groups;
  CREATE POLICY pgroups_admin_insert ON product_groups
    FOR INSERT WITH CHECK (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff')
    );

  DROP POLICY IF EXISTS pgroups_admin_update ON product_groups;
  CREATE POLICY pgroups_admin_update ON product_groups
    FOR UPDATE USING (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff')
    );

  DROP POLICY IF EXISTS pgroups_admin_delete ON product_groups;
  CREATE POLICY pgroups_admin_delete ON product_groups
    FOR DELETE USING (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );
