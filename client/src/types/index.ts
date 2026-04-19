// Shared types matching backend database types

export type Role = 'admin' | 'customer' | 'staff';
export type PriceListStatus = 'draft' | 'published' | 'archived';
export type VersionStatus = 'draft' | 'published' | 'superseded';
export type OrderStatus = 'draft' | 'confirmed' | 'cancelled';
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'momo';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type OrderPaymentStatus = 'paid' | 'partial' | 'unpaid' | 'not_applicable' | 'cancelled';

export interface Profile {
  id: string;
  role: Role;
  display_name: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  profile_id: string | null;
  customer_name: string;
  phone_number: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  parent_id: string | null;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id: string | null;
  description: string | null;
  specs: Record<string, unknown>;
  image_urls: string[];
  unit: string;
  base_price: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  product_categories?: { name: string; slug: string } | null;
}

export interface PriceList {
  id: string;
  title: string;
  description: string | null;
  status: PriceListStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  version_count?: number;
  customer_count?: number;
  profiles?: { display_name: string };
}

export interface PriceListVersion {
  id: string;
  price_list_id: string;
  version_number: number;
  status: VersionStatus;
  changelog: string | null;
  published_at: string | null;
  created_by: string;
  created_at: string;
}

export interface PriceListItem {
  id: string;
  version_id: string;
  product_id: string;
  product_name_snapshot: string;
  product_sku_snapshot: string;
  product_specs_snapshot: Record<string, unknown>;
  product_image_snapshot: string | null;
  product_unit_snapshot: string | null;
  dealer_price: number | null;
  retail_price: number | null;
  public_price: number | null;
  note: string | null;
  is_new: boolean;
  is_changed: boolean;
  price_change_pct: number | null;
  price_change_amount: number | null;
  sort_order: number;
}

export interface PriceListDetail extends PriceList {
  versions: PriceListVersion[];
  current_version: PriceListVersion | null;
  items: PriceListItem[];
  assigned_customers: Array<{
    id: string;
    customer_id: string;
    assigned_at: string;
    customers: { id: string; customer_name: string; phone_number: string | null };
  }>;
}

export interface ViewSession {
  id: string;
  customer_id: string;
  price_list_id: string;
  version_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  device: string | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthUser {
  id: string;
  phone: string | null;
  email: string;
  profile: Profile;
  customer?: Customer | null;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface LoginResponse {
  user: AuthUser;
  session: AuthSession;
}

export interface AnalyticsOverview {
  total_sessions: number;
  unique_customers: number;
  recent_sessions: Array<ViewSession & {
    customers: { id: string; customer_name: string; phone_number: string | null };
    price_lists: { id: string; title: string };
  }>;
  top_products: Array<{
    product_id: string;
    count: number;
    name: string;
    sku: string;
  }>;
}

// ============================================================
// Order Management + Financial Tracking
// ============================================================

export interface Order {
  id: string;
  customer_id: string;
  created_by: string | null;
  code: string;
  status: OrderStatus;
  order_date: string;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joined
  customers?: { customer_name: string; phone_number: string | null };
  v_order_payment_summary?: Array<{ payment_status: OrderPaymentStatus; total_paid: number; remaining: number }>;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_price_snapshot: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  created_at: string;
}

export interface OrderItemInput {
  product_id: string;
  product_name: string;
  product_price_snapshot: number;
  quantity: number;
  unit_price: number;
  notes?: string | null;
}

export interface OrderPaymentSummary {
  order_id: string;
  order_status: OrderStatus;
  final_amount: number;
  total_paid: number;
  remaining: number;
  payment_status: OrderPaymentStatus;
}

export interface OrderWithDetails extends Order {
  items: OrderItem[];
  payment_summary: OrderPaymentSummary;
  customer?: { customer_name: string; phone_number: string | null };
  created_by_profile?: { display_name: string };
}

export interface Payment {
  id: string;
  customer_id: string;
  order_id: string | null;
  code: string;
  amount: number;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  notes: string | null;
  created_by: string | null;
  paid_at: string;
  created_at: string;
  updated_at: string;
  // Joined
  customers?: { customer_name: string; phone_number: string | null };
  orders?: { code: string; status: OrderStatus; final_amount: number } | null;
}

export interface CustomerFinancial {
  customer_id: string;
  total_orders_amount: number;
  total_paid: number;
  total_debt: number;
  credit_balance: number;
  last_payment_date: string | null;
}

export interface FinancialKPIs {
  total_revenue: number;
  total_collected: number;
  total_outstanding: number;
  total_credits: number;
  customers_in_debt: number;
}

export interface RevenueDataPoint {
  period: string;
  revenue: number;
  order_count: number;
}

export interface TopCustomerData {
  customer_id: string;
  total_orders_amount: number;
  total_paid: number;
  total_debt: number;
  last_payment_date?: string | null;
  customers?: { customer_name: string; phone_number: string | null };
}
