-- ============================================================
-- CRM QUOTATION SYSTEM - ROW LEVEL SECURITY (RLS)
-- Supabase PostgreSQL
-- ============================================================
-- Run AFTER 001_schema.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: get current user role
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- HELPER: check if current user is admin or staff
CREATE OR REPLACE FUNCTION is_admin_or_staff()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'staff')
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- HELPER: get customer_id for current user
CREATE OR REPLACE FUNCTION get_my_customer_id()
RETURNS UUID AS $$
    SELECT id FROM customers 
    WHERE profile_id = auth.uid() 
    AND deleted_at IS NULL
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES
-- ============================================================
-- Everyone can read their own profile
CREATE POLICY profiles_select_own ON profiles
    FOR SELECT USING (id = auth.uid());

-- Admin/staff can read all profiles
CREATE POLICY profiles_select_admin ON profiles
    FOR SELECT USING (is_admin_or_staff());

-- Users can update their own profile (name, avatar only)
CREATE POLICY profiles_update_own ON profiles
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        -- role cannot be changed by the user themselves
        AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    );

-- Admin can update any profile (including role)
CREATE POLICY profiles_update_admin ON profiles
    FOR UPDATE USING (is_admin_or_staff());

-- ============================================================
-- CUSTOMERS
-- ============================================================
-- Admin/staff: full access
CREATE POLICY customers_admin_select ON customers
    FOR SELECT USING (is_admin_or_staff());

CREATE POLICY customers_admin_insert ON customers
    FOR INSERT WITH CHECK (is_admin_or_staff());

CREATE POLICY customers_admin_update ON customers
    FOR UPDATE USING (is_admin_or_staff());

CREATE POLICY customers_admin_delete ON customers
    FOR DELETE USING (is_admin_or_staff());

-- Customer: can read own record only
CREATE POLICY customers_own_select ON customers
    FOR SELECT USING (profile_id = auth.uid() AND deleted_at IS NULL);

-- ============================================================
-- PRODUCT CATEGORIES
-- ============================================================
-- Everyone can read categories
CREATE POLICY categories_select_all ON product_categories
    FOR SELECT USING (true);

-- Only admin can modify
CREATE POLICY categories_admin_insert ON product_categories
    FOR INSERT WITH CHECK (is_admin_or_staff());

CREATE POLICY categories_admin_update ON product_categories
    FOR UPDATE USING (is_admin_or_staff());

CREATE POLICY categories_admin_delete ON product_categories
    FOR DELETE USING (is_admin_or_staff());

-- ============================================================
-- PRODUCTS
-- ============================================================
-- Admin/staff: full CRUD (see all including soft-deleted)
CREATE POLICY products_admin_select ON products
    FOR SELECT USING (is_admin_or_staff());

CREATE POLICY products_admin_insert ON products
    FOR INSERT WITH CHECK (is_admin_or_staff());

CREATE POLICY products_admin_update ON products
    FOR UPDATE USING (is_admin_or_staff());

CREATE POLICY products_admin_delete ON products
    FOR DELETE USING (is_admin_or_staff());

-- Customer: can see active, non-deleted products only
CREATE POLICY products_customer_select ON products
    FOR SELECT USING (
        get_user_role() = 'customer'
        AND deleted_at IS NULL
        AND is_active = true
    );

-- ============================================================
-- PRICE LISTS
-- ============================================================
-- Admin/staff: full access
CREATE POLICY price_lists_admin_select ON price_lists
    FOR SELECT USING (is_admin_or_staff());

CREATE POLICY price_lists_admin_insert ON price_lists
    FOR INSERT WITH CHECK (is_admin_or_staff());

CREATE POLICY price_lists_admin_update ON price_lists
    FOR UPDATE USING (is_admin_or_staff());

CREATE POLICY price_lists_admin_delete ON price_lists
    FOR DELETE USING (is_admin_or_staff());

-- Customer: can see only assigned, published, non-deleted price lists
CREATE POLICY price_lists_customer_select ON price_lists
    FOR SELECT USING (
        get_user_role() = 'customer'
        AND deleted_at IS NULL
        AND status = 'published'
        AND EXISTS (
            SELECT 1 FROM price_list_customers plc
            WHERE plc.price_list_id = price_lists.id
            AND plc.customer_id = get_my_customer_id()
        )
    );

-- ============================================================
-- PRICE LIST VERSIONS
-- ============================================================
-- Admin/staff: full access
CREATE POLICY plv_admin_select ON price_list_versions
    FOR SELECT USING (is_admin_or_staff());

CREATE POLICY plv_admin_insert ON price_list_versions
    FOR INSERT WITH CHECK (is_admin_or_staff());

CREATE POLICY plv_admin_update ON price_list_versions
    FOR UPDATE USING (is_admin_or_staff());

-- Customer: can see published versions of assigned price lists only
CREATE POLICY plv_customer_select ON price_list_versions
    FOR SELECT USING (
        get_user_role() = 'customer'
        AND status = 'published'
        AND EXISTS (
            SELECT 1 FROM price_list_customers plc
            WHERE plc.price_list_id = price_list_versions.price_list_id
            AND plc.customer_id = get_my_customer_id()
        )
    );

-- ============================================================
-- PRICE LIST ITEMS
-- ============================================================
-- Admin/staff: full access
CREATE POLICY pli_admin_select ON price_list_items
    FOR SELECT USING (is_admin_or_staff());

CREATE POLICY pli_admin_insert ON price_list_items
    FOR INSERT WITH CHECK (is_admin_or_staff());

CREATE POLICY pli_admin_update ON price_list_items
    FOR UPDATE USING (is_admin_or_staff());

CREATE POLICY pli_admin_delete ON price_list_items
    FOR DELETE USING (is_admin_or_staff());

-- Customer: can see items of published versions of assigned price lists
CREATE POLICY pli_customer_select ON price_list_items
    FOR SELECT USING (
        get_user_role() = 'customer'
        AND EXISTS (
            SELECT 1 
            FROM price_list_versions plv
            JOIN price_list_customers plc ON plc.price_list_id = plv.price_list_id
            WHERE plv.id = price_list_items.version_id
            AND plv.status = 'published'
            AND plc.customer_id = get_my_customer_id()
        )
    );

-- ============================================================
-- PRICE LIST CUSTOMERS (assignment table)
-- ============================================================
-- Admin/staff: full access
CREATE POLICY plc_admin_select ON price_list_customers
    FOR SELECT USING (is_admin_or_staff());

CREATE POLICY plc_admin_insert ON price_list_customers
    FOR INSERT WITH CHECK (is_admin_or_staff());

CREATE POLICY plc_admin_delete ON price_list_customers
    FOR DELETE USING (is_admin_or_staff());

-- Customer: can see own assignments
CREATE POLICY plc_customer_select ON price_list_customers
    FOR SELECT USING (customer_id = get_my_customer_id());

-- ============================================================
-- VIEW SESSIONS
-- ============================================================
-- Admin/staff: read all sessions
CREATE POLICY vs_admin_select ON view_sessions
    FOR SELECT USING (is_admin_or_staff());

-- Customer: can insert own sessions + read own sessions
CREATE POLICY vs_customer_insert ON view_sessions
    FOR INSERT WITH CHECK (customer_id = get_my_customer_id());

CREATE POLICY vs_customer_select ON view_sessions
    FOR SELECT USING (customer_id = get_my_customer_id());

CREATE POLICY vs_customer_update ON view_sessions
    FOR UPDATE USING (customer_id = get_my_customer_id());

-- ============================================================
-- VIEW SESSION ITEMS
-- ============================================================
-- Admin/staff: read all
CREATE POLICY vsi_admin_select ON view_session_items
    FOR SELECT USING (is_admin_or_staff());

-- Customer: can insert own + read own
CREATE POLICY vsi_customer_insert ON view_session_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM view_sessions vs
            WHERE vs.id = view_session_items.session_id
            AND vs.customer_id = get_my_customer_id()
        )
    );

CREATE POLICY vsi_customer_select ON view_session_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM view_sessions vs
            WHERE vs.id = view_session_items.session_id
            AND vs.customer_id = get_my_customer_id()
        )
    );

-- ============================================================
-- AUDIT LOGS
-- ============================================================
-- Only admin can read
CREATE POLICY audit_admin_select ON audit_logs
    FOR SELECT USING (is_admin_or_staff());

-- System inserts (via service role key, bypasses RLS)
-- No INSERT policy needed - backend uses service_role key

-- ============================================================
-- NOTES:
-- ============================================================
-- 1. Backend uses Supabase service_role key for admin operations
--    → bypasses RLS when needed (audit log inserts, etc.)
-- 2. Frontend uses anon key → RLS enforced
-- 3. All soft-delete filters are in policies where relevant
-- 4. get_my_customer_id() returns NULL if user has no customer record
--    → effectively denies access (NULL != any customer_id)
