-- ============================================================
-- CRM QUOTATION SYSTEM - DATABASE SCHEMA v2
-- Supabase PostgreSQL
-- ============================================================
-- Run order:
--   1. 001_schema.sql    (this file)
--   2. 002_rls.sql       (row level security)
--   3. 003_functions.sql  (triggers & functions)
--   4. 004_seed.sql       (test data)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'customer' 
                CHECK (role IN ('admin', 'customer', 'staff')),
    display_name TEXT NOT NULL,
    avatar_url  TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);

COMMENT ON TABLE profiles IS 'Extended user profile linked to Supabase auth.users';
COMMENT ON COLUMN profiles.role IS 'Extensible: admin, customer, staff (future: manager, accountant)';

-- ============================================================
-- 2. CUSTOMERS
-- ============================================================
CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id      UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
    company_name    TEXT NOT NULL,
    contact_name    TEXT,
    contact_email   TEXT,
    contact_phone   TEXT,
    address         TEXT,
    tax_code        TEXT,
    notes           TEXT,
    created_by      UUID REFERENCES profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ  -- soft delete
);

CREATE INDEX idx_customers_profile ON customers(profile_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_company ON customers(company_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_deleted ON customers(deleted_at);

COMMENT ON TABLE customers IS 'Customer companies. Soft-deletable.';

-- ============================================================
-- 3. PRODUCT CATEGORIES
-- ============================================================
CREATE TABLE product_categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT,
    sort_order  INT NOT NULL DEFAULT 0,
    parent_id   UUID REFERENCES product_categories(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_parent ON product_categories(parent_id);
CREATE INDEX idx_categories_slug ON product_categories(slug);

COMMENT ON TABLE product_categories IS 'Hierarchical product categories';

-- ============================================================
-- 4. PRODUCTS
-- ============================================================
CREATE TABLE products (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku         TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    category_id UUID REFERENCES product_categories(id),
    description TEXT,
    specs       JSONB DEFAULT '{}',
    image_urls  TEXT[] DEFAULT '{}',
    unit        TEXT DEFAULT 'cái',
    base_price  DECIMAL(15, 2) NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    sort_order  INT NOT NULL DEFAULT 0,
    created_by  UUID REFERENCES profiles(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ  -- soft delete
);

CREATE INDEX idx_products_sku ON products(sku) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category ON products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_name ON products(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_active ON products(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_deleted ON products(deleted_at);

COMMENT ON TABLE products IS 'Product catalog. Soft-deletable.';

-- ============================================================
-- 5. PRICE LISTS (master)
-- ============================================================
CREATE TABLE price_lists (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published', 'archived')),
    created_by  UUID NOT NULL REFERENCES profiles(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ  -- soft delete
);

CREATE INDEX idx_price_lists_status ON price_lists(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_price_lists_created_by ON price_lists(created_by) WHERE deleted_at IS NULL;

COMMENT ON TABLE price_lists IS 'Master price list. Has multiple versions.';

-- ============================================================
-- 6. PRICE LIST VERSIONS
-- ============================================================
CREATE TABLE price_list_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    price_list_id   UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'superseded')),
    changelog       TEXT,
    published_at    TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(price_list_id, version_number)
);

CREATE INDEX idx_plv_price_list ON price_list_versions(price_list_id);
CREATE INDEX idx_plv_status ON price_list_versions(status);

COMMENT ON TABLE price_list_versions IS 'Each price list can have multiple versions. Only one published at a time.';
COMMENT ON COLUMN price_list_versions.status IS 'draft → published → superseded (when new version published)';

-- ============================================================
-- 7. PRICE LIST ITEMS (with product snapshot)
-- ============================================================
CREATE TABLE price_list_items (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id              UUID NOT NULL REFERENCES price_list_versions(id) ON DELETE CASCADE,
    product_id              UUID NOT NULL REFERENCES products(id),

    -- Product snapshot at time of creation (immutable)
    product_name_snapshot   TEXT NOT NULL,
    product_sku_snapshot    TEXT NOT NULL,
    product_specs_snapshot  JSONB DEFAULT '{}',
    product_image_snapshot  TEXT,
    product_unit_snapshot   TEXT,

    -- Pricing
    dealer_price            DECIMAL(15, 2),
    retail_price            DECIMAL(15, 2),
    public_price            DECIMAL(15, 2),
    
    -- Metadata
    note                    TEXT,
    is_new                  BOOLEAN NOT NULL DEFAULT false,
    is_changed              BOOLEAN NOT NULL DEFAULT false,
    price_change_pct        DECIMAL(5, 2),  -- % change vs previous version
    price_change_amount     DECIMAL(15, 2), -- absolute change
    sort_order              INT NOT NULL DEFAULT 0,

    UNIQUE(version_id, product_id)
);

CREATE INDEX idx_pli_version ON price_list_items(version_id);
CREATE INDEX idx_pli_product ON price_list_items(product_id);
CREATE INDEX idx_pli_new ON price_list_items(is_new) WHERE is_new = true;
CREATE INDEX idx_pli_changed ON price_list_items(is_changed) WHERE is_changed = true;

COMMENT ON TABLE price_list_items IS 'Line items with snapshotted product data. Immutable once version is published.';
COMMENT ON COLUMN price_list_items.product_name_snapshot IS 'Frozen product name at time of version creation';

-- ============================================================
-- 8. PRICE LIST ↔ CUSTOMER ASSIGNMENT
-- ============================================================
CREATE TABLE price_list_customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    price_list_id   UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by     UUID REFERENCES profiles(id),

    UNIQUE(price_list_id, customer_id)
);

CREATE INDEX idx_plc_customer ON price_list_customers(customer_id);
CREATE INDEX idx_plc_price_list ON price_list_customers(price_list_id);

COMMENT ON TABLE price_list_customers IS 'Many-to-many: which customers can see which price lists';

-- ============================================================
-- 9. VIEW SESSIONS (deep tracking)
-- ============================================================
CREATE TABLE view_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    price_list_id   UUID NOT NULL REFERENCES price_lists(id),
    version_id      UUID REFERENCES price_list_versions(id),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    duration_seconds INT,
    device          TEXT,
    ip_address      INET,
    user_agent      TEXT
);

CREATE INDEX idx_vs_customer ON view_sessions(customer_id);
CREATE INDEX idx_vs_price_list ON view_sessions(price_list_id);
CREATE INDEX idx_vs_started ON view_sessions(started_at DESC);
CREATE INDEX idx_vs_customer_time ON view_sessions(customer_id, started_at DESC);

COMMENT ON TABLE view_sessions IS 'Tracks when a customer opens a price list. Session-based.';

-- ============================================================
-- 10. VIEW SESSION ITEMS (product-level tracking)
-- ============================================================
CREATE TABLE view_session_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID NOT NULL REFERENCES view_sessions(id) ON DELETE CASCADE,
    product_id          UUID NOT NULL REFERENCES products(id),
    viewed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    view_duration_seconds INT DEFAULT 0
);

CREATE INDEX idx_vsi_session ON view_session_items(session_id);
CREATE INDEX idx_vsi_product ON view_session_items(product_id);

COMMENT ON TABLE view_session_items IS 'Which specific products a customer looked at during a session';

-- ============================================================
-- 11. AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id    UUID REFERENCES profiles(id),
    action      TEXT NOT NULL 
                CHECK (action IN ('create', 'update', 'delete', 'restore', 'publish', 'archive', 'assign', 'unassign')),
    entity_type TEXT NOT NULL
                CHECK (entity_type IN ('product', 'price_list', 'price_list_version', 'customer', 'price_list_customer')),
    entity_id   UUID NOT NULL,
    old_data    JSONB,
    new_data    JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_time ON audit_logs(created_at DESC);

COMMENT ON TABLE audit_logs IS 'Immutable log of all admin actions for accountability';

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_customers_updated
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_products_updated
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_price_lists_updated
    BEFORE UPDATE ON price_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: auto-create profile on Supabase auth signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, display_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- FUNCTION: auto-detect price changes between versions
-- ============================================================
CREATE OR REPLACE FUNCTION detect_price_changes(
    p_new_version_id UUID,
    p_old_version_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- Mark items as is_new if product not in previous version
    UPDATE price_list_items new_item
    SET 
        is_new = true,
        is_changed = false,
        price_change_pct = NULL,
        price_change_amount = NULL
    WHERE new_item.version_id = p_new_version_id
      AND NOT EXISTS (
          SELECT 1 FROM price_list_items old_item
          WHERE old_item.version_id = p_old_version_id
            AND old_item.product_id = new_item.product_id
      );

    -- Mark items as is_changed if price differs from previous version
    UPDATE price_list_items new_item
    SET 
        is_new = false,
        is_changed = true,
        price_change_amount = new_item.dealer_price - old_item.dealer_price,
        price_change_pct = CASE 
            WHEN old_item.dealer_price > 0 
            THEN ROUND(((new_item.dealer_price - old_item.dealer_price) / old_item.dealer_price * 100)::NUMERIC, 2)
            ELSE NULL 
        END
    FROM price_list_items old_item
    WHERE new_item.version_id = p_new_version_id
      AND old_item.version_id = p_old_version_id
      AND old_item.product_id = new_item.product_id
      AND (
          old_item.dealer_price IS DISTINCT FROM new_item.dealer_price
          OR old_item.retail_price IS DISTINCT FROM new_item.retail_price
          OR old_item.public_price IS DISTINCT FROM new_item.public_price
      );

    -- Mark unchanged items
    UPDATE price_list_items new_item
    SET 
        is_new = false,
        is_changed = false,
        price_change_pct = 0,
        price_change_amount = 0
    WHERE new_item.version_id = p_new_version_id
      AND is_new = false
      AND is_changed = false;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION detect_price_changes IS 'Compare two versions and auto-flag new/changed items';

-- ============================================================
-- FUNCTION: snapshot product data into price list items
-- ============================================================
CREATE OR REPLACE FUNCTION snapshot_product_to_item(
    p_version_id UUID,
    p_product_id UUID,
    p_dealer_price DECIMAL,
    p_retail_price DECIMAL,
    p_public_price DECIMAL,
    p_note TEXT DEFAULT NULL,
    p_sort_order INT DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
    v_item_id UUID;
    v_product RECORD;
BEGIN
    -- Get current product data
    SELECT name, sku, specs, image_urls[1], unit
    INTO v_product
    FROM products
    WHERE id = p_product_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found or deleted', p_product_id;
    END IF;

    -- Insert with snapshot
    INSERT INTO price_list_items (
        version_id, product_id,
        product_name_snapshot, product_sku_snapshot,
        product_specs_snapshot, product_image_snapshot, product_unit_snapshot,
        dealer_price, retail_price, public_price,
        note, sort_order
    ) VALUES (
        p_version_id, p_product_id,
        v_product.name, v_product.sku,
        v_product.specs, v_product.image_urls, v_product.unit,
        p_dealer_price, p_retail_price, p_public_price,
        p_note, p_sort_order
    )
    RETURNING id INTO v_item_id;

    RETURN v_item_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION snapshot_product_to_item IS 'Creates a price list item with frozen product data snapshot';

-- ============================================================
-- FUNCTION: publish a version (mark old as superseded)
-- ============================================================
CREATE OR REPLACE FUNCTION publish_price_list_version(
    p_version_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_price_list_id UUID;
    v_old_version_id UUID;
BEGIN
    -- Get price list id
    SELECT price_list_id INTO v_price_list_id
    FROM price_list_versions
    WHERE id = p_version_id;

    -- Find currently published version (to compare)
    SELECT id INTO v_old_version_id
    FROM price_list_versions
    WHERE price_list_id = v_price_list_id
      AND status = 'published'
    LIMIT 1;

    -- Supersede old version
    UPDATE price_list_versions
    SET status = 'superseded'
    WHERE price_list_id = v_price_list_id
      AND status = 'published'
      AND id != p_version_id;

    -- Publish new version
    UPDATE price_list_versions
    SET status = 'published', published_at = now()
    WHERE id = p_version_id;

    -- Update master price list status
    UPDATE price_lists
    SET status = 'published'
    WHERE id = v_price_list_id;

    -- Auto-detect changes if there was a previous version
    IF v_old_version_id IS NOT NULL THEN
        PERFORM detect_price_changes(p_version_id, v_old_version_id);
    ELSE
        -- First version: mark all as new
        UPDATE price_list_items
        SET is_new = true
        WHERE version_id = p_version_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION publish_price_list_version IS 'Publishes a version, supersedes old one, auto-detects price changes';

-- ============================================================
-- VIEWS: convenient queries
-- ============================================================

-- Active products (not soft-deleted)
CREATE OR REPLACE VIEW v_active_products AS
SELECT p.*, pc.name AS category_name, pc.slug AS category_slug
FROM products p
LEFT JOIN product_categories pc ON p.category_id = pc.id
WHERE p.deleted_at IS NULL;

-- Active customers
CREATE OR REPLACE VIEW v_active_customers AS
SELECT c.*, pr.display_name AS user_display_name, pr.role
FROM customers c
LEFT JOIN profiles pr ON c.profile_id = pr.id
WHERE c.deleted_at IS NULL;

-- Current published version per price list
CREATE OR REPLACE VIEW v_current_price_lists AS
SELECT 
    pl.id AS price_list_id,
    pl.title,
    pl.description,
    pl.status AS list_status,
    plv.id AS version_id,
    plv.version_number,
    plv.published_at,
    plv.changelog,
    pl.created_by,
    pr.display_name AS created_by_name
FROM price_lists pl
INNER JOIN price_list_versions plv ON plv.price_list_id = pl.id
LEFT JOIN profiles pr ON pl.created_by = pr.id
WHERE pl.deleted_at IS NULL
  AND plv.status = 'published';

-- Customer view activity summary
CREATE OR REPLACE VIEW v_customer_activity AS
SELECT 
    c.id AS customer_id,
    c.company_name,
    COUNT(vs.id) AS total_sessions,
    MAX(vs.started_at) AS last_viewed_at,
    COALESCE(SUM(vs.duration_seconds), 0) AS total_duration_seconds
FROM customers c
LEFT JOIN view_sessions vs ON vs.customer_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.company_name;

-- Most viewed products
CREATE OR REPLACE VIEW v_product_view_stats AS
SELECT 
    p.id AS product_id,
    p.name AS product_name,
    p.sku,
    COUNT(vsi.id) AS total_views,
    COUNT(DISTINCT vs.customer_id) AS unique_viewers,
    COALESCE(SUM(vsi.view_duration_seconds), 0) AS total_view_seconds
FROM products p
LEFT JOIN view_session_items vsi ON vsi.product_id = p.id
LEFT JOIN view_sessions vs ON vs.id = vsi.session_id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, p.sku;
