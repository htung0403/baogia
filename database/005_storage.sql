-- ============================================================
-- SUPABASE STORAGE SETUP
-- ============================================================
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create a bucket for product images
-- Note: 'public: true' allows viewing files via public URL without a token
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up Access Control Policies (RLS for Storage)

-- Allow Public Access (Everyone can view images)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-images' );

-- Allow Authenticated Uploads (Admin/Staff can upload)
-- Note: We check if the user is an admin/staff based on our 'profiles' table
CREATE POLICY "Admin/Staff Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'product-images' 
    AND (
        SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('admin', 'staff')
);

-- Allow Admin/Staff to Update/Delete images
CREATE POLICY "Admin/Staff Modify"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'product-images' 
    AND (
        SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('admin', 'staff')
);

CREATE POLICY "Admin/Staff Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'product-images' 
    AND (
        SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('admin', 'staff')
);
