-- ============================================================
-- CRM QUOTATION SYSTEM - SEED DATA
-- ============================================================
-- Run AFTER 001_schema.sql and 002_rls.sql
-- NOTE: Auth users must be created via Supabase Auth API
--       This script seeds the rest of the data assuming
--       profiles already exist.
-- ============================================================

-- ============================================================
-- 1. PRODUCT CATEGORIES
-- ============================================================
INSERT INTO product_categories (id, name, slug, description, sort_order) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Thiết bị điện', 'thiet-bi-dien', 'Các thiết bị điện dân dụng và công nghiệp', 1),
    ('a0000000-0000-0000-0000-000000000002', 'Thiết bị chiếu sáng', 'thiet-bi-chieu-sang', 'Đèn LED, đèn huỳnh quang, đèn trang trí', 2),
    ('a0000000-0000-0000-0000-000000000003', 'Dây cáp điện', 'day-cap-dien', 'Dây điện, cáp điện các loại', 3),
    ('a0000000-0000-0000-0000-000000000004', 'Ống luồn dây', 'ong-luon-day', 'Ống nhựa, ống thép luồn dây điện', 4),
    ('a0000000-0000-0000-0000-000000000005', 'Tủ điện', 'tu-dien', 'Tủ điện phân phối, tủ điều khiển', 5);

-- Sub-categories
INSERT INTO product_categories (id, name, slug, description, sort_order, parent_id) VALUES
    ('a0000000-0000-0000-0000-000000000011', 'Aptomat (MCB)', 'aptomat-mcb', 'Cầu dao tự động', 1, 'a0000000-0000-0000-0000-000000000001'),
    ('a0000000-0000-0000-0000-000000000012', 'Contactor', 'contactor', 'Công tắc tơ', 2, 'a0000000-0000-0000-0000-000000000001'),
    ('a0000000-0000-0000-0000-000000000013', 'Relay', 'relay', 'Rơ le bảo vệ', 3, 'a0000000-0000-0000-0000-000000000001'),
    ('a0000000-0000-0000-0000-000000000021', 'Đèn LED Panel', 'den-led-panel', 'Đèn LED âm trần panel', 1, 'a0000000-0000-0000-0000-000000000002'),
    ('a0000000-0000-0000-0000-000000000022', 'Đèn LED Tube', 'den-led-tube', 'Đèn LED tuýp thay thế huỳnh quang', 2, 'a0000000-0000-0000-0000-000000000002');

-- ============================================================
-- 2. PRODUCTS (20 sample products)
-- ============================================================
INSERT INTO products (id, sku, name, category_id, description, specs, image_urls, unit, base_price, sort_order) VALUES
    -- Aptomat
    ('b0000000-0000-0000-0000-000000000001', 'MCB-1P-16A', 'Aptomat 1P 16A Schneider', 'a0000000-0000-0000-0000-000000000011',
     'Cầu dao tự động 1 pha 16A, dòng cắt 6kA',
     '{"brand": "Schneider", "poles": 1, "current": "16A", "breaking_capacity": "6kA", "curve": "C"}',
     ARRAY['https://placeholder.com/mcb-1p-16a.jpg'], 'cái', 85000, 1),

    ('b0000000-0000-0000-0000-000000000002', 'MCB-1P-20A', 'Aptomat 1P 20A Schneider', 'a0000000-0000-0000-0000-000000000011',
     'Cầu dao tự động 1 pha 20A, dòng cắt 6kA',
     '{"brand": "Schneider", "poles": 1, "current": "20A", "breaking_capacity": "6kA", "curve": "C"}',
     ARRAY['https://placeholder.com/mcb-1p-20a.jpg'], 'cái', 90000, 2),

    ('b0000000-0000-0000-0000-000000000003', 'MCB-1P-32A', 'Aptomat 1P 32A Schneider', 'a0000000-0000-0000-0000-000000000011',
     'Cầu dao tự động 1 pha 32A, dòng cắt 6kA',
     '{"brand": "Schneider", "poles": 1, "current": "32A", "breaking_capacity": "6kA", "curve": "C"}',
     ARRAY['https://placeholder.com/mcb-1p-32a.jpg'], 'cái', 95000, 3),

    ('b0000000-0000-0000-0000-000000000004', 'MCB-3P-32A', 'Aptomat 3P 32A Schneider', 'a0000000-0000-0000-0000-000000000011',
     'Cầu dao tự động 3 pha 32A, dòng cắt 6kA',
     '{"brand": "Schneider", "poles": 3, "current": "32A", "breaking_capacity": "6kA", "curve": "C"}',
     ARRAY['https://placeholder.com/mcb-3p-32a.jpg'], 'cái', 280000, 4),

    ('b0000000-0000-0000-0000-000000000005', 'MCB-3P-63A', 'Aptomat 3P 63A Schneider', 'a0000000-0000-0000-0000-000000000011',
     'Cầu dao tự động 3 pha 63A, dòng cắt 10kA',
     '{"brand": "Schneider", "poles": 3, "current": "63A", "breaking_capacity": "10kA", "curve": "C"}',
     ARRAY['https://placeholder.com/mcb-3p-63a.jpg'], 'cái', 450000, 5),

    -- Contactor
    ('b0000000-0000-0000-0000-000000000006', 'CT-9A', 'Contactor 9A Schneider LC1D09', 'a0000000-0000-0000-0000-000000000012',
     'Công tắc tơ 9A, coil 220V',
     '{"brand": "Schneider", "model": "LC1D09", "current": "9A", "coil_voltage": "220V"}',
     ARRAY['https://placeholder.com/ct-9a.jpg'], 'cái', 350000, 1),

    ('b0000000-0000-0000-0000-000000000007', 'CT-18A', 'Contactor 18A Schneider LC1D18', 'a0000000-0000-0000-0000-000000000012',
     'Công tắc tơ 18A, coil 220V',
     '{"brand": "Schneider", "model": "LC1D18", "current": "18A", "coil_voltage": "220V"}',
     ARRAY['https://placeholder.com/ct-18a.jpg'], 'cái', 480000, 2),

    ('b0000000-0000-0000-0000-000000000008', 'CT-32A', 'Contactor 32A Schneider LC1D32', 'a0000000-0000-0000-0000-000000000012',
     'Công tắc tơ 32A, coil 220V',
     '{"brand": "Schneider", "model": "LC1D32", "current": "32A", "coil_voltage": "220V"}',
     ARRAY['https://placeholder.com/ct-32a.jpg'], 'cái', 720000, 3),

    -- Relay
    ('b0000000-0000-0000-0000-000000000009', 'RLY-OVR', 'Relay bảo vệ quá tải LRD08', 'a0000000-0000-0000-0000-000000000013',
     'Rơ le nhiệt bảo vệ quá tải 2.5-4A',
     '{"brand": "Schneider", "model": "LRD08", "range": "2.5-4A"}',
     ARRAY['https://placeholder.com/rly-ovr.jpg'], 'cái', 280000, 1),

    ('b0000000-0000-0000-0000-000000000010', 'RLY-TIMER', 'Timer Relay Schneider RE22R1', 'a0000000-0000-0000-0000-000000000013',
     'Rơ le thời gian đa năng',
     '{"brand": "Schneider", "model": "RE22R1", "type": "multi-function"}',
     ARRAY['https://placeholder.com/rly-timer.jpg'], 'cái', 950000, 2),

    -- LED Panel
    ('b0000000-0000-0000-0000-000000000011', 'LED-P-600-40W', 'Đèn LED Panel 600x600 40W Rạng Đông', 'a0000000-0000-0000-0000-000000000021',
     'Đèn LED panel âm trần 600x600mm, 40W, ánh sáng trắng',
     '{"brand": "Rang Dong", "wattage": "40W", "size": "600x600mm", "color_temp": "6500K", "lumen": "3600lm"}',
     ARRAY['https://placeholder.com/led-panel-600.jpg'], 'bộ', 320000, 1),

    ('b0000000-0000-0000-0000-000000000012', 'LED-P-300-18W', 'Đèn LED Panel 300x300 18W Rạng Đông', 'a0000000-0000-0000-0000-000000000021',
     'Đèn LED panel âm trần 300x300mm, 18W',
     '{"brand": "Rang Dong", "wattage": "18W", "size": "300x300mm", "color_temp": "6500K", "lumen": "1600lm"}',
     ARRAY['https://placeholder.com/led-panel-300.jpg'], 'bộ', 185000, 2),

    ('b0000000-0000-0000-0000-000000000013', 'LED-P-1200-36W', 'Đèn LED Panel 300x1200 36W Rạng Đông', 'a0000000-0000-0000-0000-000000000021',
     'Đèn LED panel âm trần 300x1200mm, 36W',
     '{"brand": "Rang Dong", "wattage": "36W", "size": "300x1200mm", "color_temp": "6500K", "lumen": "3200lm"}',
     ARRAY['https://placeholder.com/led-panel-1200.jpg'], 'bộ', 290000, 3),

    -- LED Tube
    ('b0000000-0000-0000-0000-000000000014', 'LED-T-1M2-18W', 'Đèn LED Tube 1.2m 18W Rạng Đông', 'a0000000-0000-0000-0000-000000000022',
     'Đèn LED tuýp 1.2m thay thế huỳnh quang T8',
     '{"brand": "Rang Dong", "wattage": "18W", "length": "1.2m", "color_temp": "6500K"}',
     ARRAY['https://placeholder.com/led-tube-1m2.jpg'], 'cái', 55000, 1),

    ('b0000000-0000-0000-0000-000000000015', 'LED-T-0M6-10W', 'Đèn LED Tube 0.6m 10W Rạng Đông', 'a0000000-0000-0000-0000-000000000022',
     'Đèn LED tuýp 0.6m thay thế huỳnh quang T8',
     '{"brand": "Rang Dong", "wattage": "10W", "length": "0.6m", "color_temp": "6500K"}',
     ARRAY['https://placeholder.com/led-tube-0m6.jpg'], 'cái', 38000, 2),

    -- Dây cáp điện
    ('b0000000-0000-0000-0000-000000000016', 'CAP-CV-1.5', 'Cáp điện CV 1.5mm² Cadivi', 'a0000000-0000-0000-0000-000000000003',
     'Cáp đồng 1 lõi, bọc PVC, 1.5mm²',
     '{"brand": "Cadivi", "type": "CV", "cross_section": "1.5mm2", "material": "copper"}',
     ARRAY['https://placeholder.com/cap-cv-1.5.jpg'], 'mét', 8500, 1),

    ('b0000000-0000-0000-0000-000000000017', 'CAP-CV-2.5', 'Cáp điện CV 2.5mm² Cadivi', 'a0000000-0000-0000-0000-000000000003',
     'Cáp đồng 1 lõi, bọc PVC, 2.5mm²',
     '{"brand": "Cadivi", "type": "CV", "cross_section": "2.5mm2", "material": "copper"}',
     ARRAY['https://placeholder.com/cap-cv-2.5.jpg'], 'mét', 13500, 2),

    ('b0000000-0000-0000-0000-000000000018', 'CAP-CV-4', 'Cáp điện CV 4mm² Cadivi', 'a0000000-0000-0000-0000-000000000003',
     'Cáp đồng 1 lõi, bọc PVC, 4mm²',
     '{"brand": "Cadivi", "type": "CV", "cross_section": "4mm2", "material": "copper"}',
     ARRAY['https://placeholder.com/cap-cv-4.jpg'], 'mét', 21000, 3),

    -- Ống luồn dây
    ('b0000000-0000-0000-0000-000000000019', 'ONG-PVC-D20', 'Ống luồn dây PVC D20 Sino', 'a0000000-0000-0000-0000-000000000004',
     'Ống nhựa PVC luồn dây điện D20mm',
     '{"brand": "Sino", "material": "PVC", "diameter": "D20", "length": "2.92m"}',
     ARRAY['https://placeholder.com/ong-pvc-d20.jpg'], 'cây', 12000, 1),

    -- Tủ điện
    ('b0000000-0000-0000-0000-000000000020', 'TU-12-WAY', 'Tủ điện 12 way Schneider', 'a0000000-0000-0000-0000-000000000005',
     'Tủ điện âm tường 12 đường, IP30',
     '{"brand": "Schneider", "ways": 12, "type": "flush mount", "protection": "IP30"}',
     ARRAY['https://placeholder.com/tu-12-way.jpg'], 'cái', 450000, 1);


-- ============================================================
-- NOTE: Customers, Price Lists, and tracking data
-- should be created via the application after setting up
-- Supabase Auth users.
--
-- Test accounts to create via Supabase Auth API:
--
-- Admin:
--   email: admin@baogia.vn
--   password: Admin@123456
--   metadata: { role: 'admin', display_name: 'Admin Hệ Thống' }
--
-- Customer 1:
--   email: khach1@company-a.vn
--   password: Khach@123456
--   metadata: { role: 'customer', display_name: 'Nguyễn Văn A' }
--
-- Customer 2:
--   email: khach2@company-b.vn
--   password: Khach@123456
--   metadata: { role: 'customer', display_name: 'Trần Thị B' }
--
-- Staff:
--   email: staff@baogia.vn
--   password: Staff@123456
--   metadata: { role: 'staff', display_name: 'Nhân Viên Sale' }
-- ============================================================

-- After auth users are created and profiles auto-generated,
-- run this to create customer records:

-- INSERT INTO customers (id, profile_id, customer_name, phone_number, email, address)
-- VALUES
--     ('c0000000-0000-0000-0000-000000000001', '<profile_id_of_khach1>', 'Nguyễn Văn A', '0901234567', 'khach1@company-a.vn', '123 Nguyễn Huệ, Q.1, TP.HCM'),
--     ('c0000000-0000-0000-0000-000000000002', '<profile_id_of_khach2>', 'Trần Thị B', '0907654321', 'khach2@company-b.vn', '456 Lê Lợi, Q.3, TP.HCM');
