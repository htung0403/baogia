-- Fix relationship between orders and v_order_payment_summary for PostgREST
-- This allows joining orders with v_order_payment_summary in Supabase JS/PostgREST queries

COMMENT ON COLUMN v_order_payment_summary.order_id IS 'FK -> orders.id';

-- Optional: Also add hint for v_customer_financials if needed
COMMENT ON COLUMN v_customer_financials.customer_id IS 'FK -> customers.id';
