// ============================================================
// Shared Types
// ============================================================

export type Role = 'admin' | 'customer' | 'staff';

export type PriceListStatus = 'draft' | 'published' | 'archived';
export type VersionStatus = 'draft' | 'published' | 'superseded';
export type AuditAction = 'create' | 'update' | 'delete' | 'restore' | 'publish' | 'archive' | 'assign' | 'unassign' | 'confirm' | 'cancel';
export type EntityType = 'product' | 'price_list' | 'price_list_version' | 'customer' | 'price_list_customer' | 'order' | 'payment';

export type OrderStatus = 'draft' | 'confirmed' | 'cancelled';
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'momo';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type OrderPaymentStatus = 'paid' | 'partial' | 'unpaid' | 'not_applicable' | 'cancelled';

// ============================================================
// Database Row Types
// ============================================================

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
  tiktok_url: string | null;
  characteristics: string | null;
  created_by: string | null;
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
  created_at: string;
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
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PriceList {
  id: string;
  title: string;
  description: string | null;
  status: PriceListStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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

export interface PriceListCustomer {
  id: string;
  price_list_id: string;
  customer_id: string;
  assigned_at: string;
  assigned_by: string | null;
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
  ip_address: string | null;
  user_agent: string | null;
}

export interface ViewSessionItem {
  id: string;
  session_id: string;
  product_id: string;
  viewed_at: string;
  view_duration_seconds: number;
}

// ============================================================
// Order Management + Financial Tracking Types
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

export interface OrderWithDetails extends Order {
  items: OrderItem[];
  payment_summary: OrderPaymentSummary;
  customer?: { customer_name: string; phone_number: string | null };
  created_by_profile?: { display_name: string };
}

export interface OrderPaymentSummary {
  order_id: string;
  order_status: OrderStatus;
  final_amount: number;
  total_paid: number;
  remaining: number;
  payment_status: OrderPaymentStatus;
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
}

export interface CustomerCredit {
  id: string;
  customer_id: string;
  balance: number;
  updated_at: string;
}

export interface CustomerFinancial {
  customer_id: string;
  total_orders_amount: number;
  total_paid: number;
  total_debt: number;
  credit_balance: number;
  last_payment_date: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: AuditAction;
  entity_type: EntityType;
  entity_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}
