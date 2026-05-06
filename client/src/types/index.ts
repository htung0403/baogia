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
  assigned_to: string | null;
  source: string | null;
  tax_code: string | null;
  industry: string | null;
  customer_group: string | null;
  customer_group_id: string | null;
  website: string | null;
  fax: string | null;
  skype: string | null;
  facebook: string | null;
  tiktok_url: string | null;
  characteristics: string | null;
  assigned_profile?: { display_name: string } | null;
  customer_groups?: { id: string; name: string; code: string | null } | null;
  last_activity_at?: string | null;
  latest_trao_doi?: string | null;
}

export interface CustomerGroup {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  parent_id: string | null;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id: string | null;
  brand_id: string | null;
  product_group_id: string | null;
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
  brands?: { name: string; slug: string } | null;
  product_groups?: { name: string; slug: string } | null;
  group_prices?: ProductGroupPrice[];
}

export interface ProductGroupPrice {
  id: string;
  product_id: string;
  customer_group_id: string;
  price: number;
  created_at: string;
  updated_at: string;
  customer_groups?: { name: string; code: string | null } | null;
}

export interface PriceList {
  id: string;
  title: string;
  description: string | null;
  company_name?: string | null;
  company_address?: string | null;
  sales_person?: string | null;
  sales_phone?: string | null;
  notice_text?: string | null;
  legend_blue_text?: string | null;
  legend_yellow_text?: string | null;
  legend_orange_text?: string | null;
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
  product_group_id: string | null;
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

// ============================================================
// Pipeline & CRM (added with 3-tab feature)
// ============================================================

export interface PipelineStage {
  id: string;
  column_id: string;
  name: string;
  description: string | null;
  color: string;       // Tailwind color name: 'blue', 'green', etc.
  sort_order: number;
  count: number;       // customers currently in this stage (computed by API)
  percent: number;     // percentage of total active customers (computed)
  customers?: { id: string; customer_name: string; email?: string | null; phone_number?: string | null; }[];
}

export interface PipelineColumn {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  stages: PipelineStage[];
}

export interface CreatePipelineColumnInput {
  name: string;
  color?: string | null;
  sort_order?: number;
}

export interface UpdatePipelineColumnInput {
  name?: string;
  color?: string | null;
  sort_order?: number;
}

export interface CreatePipelineStageInput {
  column_id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  sort_order?: number;
}

export interface UpdatePipelineStageInput {
  name?: string;
  description?: string | null;
  color?: string | null;
  sort_order?: number;
}

export interface BoardResponse {
  columns: PipelineColumn[];
  total_customers: number;
}

export interface CustomerPipeline {
  id: string;
  customer_id: string;
  stage_id: string;
  assigned_at: string;
  assigned_by: string | null;
}

export interface CustomerActivity {
  id: string;
  customer_id: string;
  activity_type: 'email' | 'sms' | 'zns' | 'call' | 'task' | 'meeting' | 'note' | 'trao_doi';
  title: string;
  description: string | null;
  assigned_to: string | null;
  related_project: string | null;
  created_by: string;
  created_at: string;
  scheduled_at: string | null;
  status: 'pending' | 'done' | 'cancelled' | null;
  profiles?: { display_name: string } | null;
}

export interface FunnelBySource  { source: string | null; count: number; pct: number; amount?: number; }
export interface FunnelByType    { type: string; count: number; }
export interface FunnelByProject { project: string | null; count: number; }

export interface FunnelResponse {
  new_customers: { count: number; by_source: FunnelBySource[] };
  interactions:  { count: number; by_type: FunnelByType[] };
  activities:    { count: number; by_project: FunnelByProject[]; by_type: FunnelByType[] };
  orders: {
    count: number; quotes: number; contracts: number;
    ratio: number; once: number; multiple: number; paid: number; unpaid: number;
  };
  revenue: { total: number; by_source: FunnelBySource[]; paid: number; unpaid: number };
}

export interface StaffProfile {
  id: string;
  display_name: string;
  role: string;
  avatar_url: string | null;
  is_active: boolean;
}

export interface Quote {
  id: string;
  customer_id: string;
  code: string;
  title: string | null;
  amount: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Contract {
  id: string;
  customer_id: string;
  code: string;
  title: string | null;
  amount: number;
  status: 'active' | 'expired' | 'cancelled' | 'renewed';
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type CustomerCostType = 'advertising' | 'consulting' | 'travel' | 'gift' | 'commission' | 'other';

export interface CustomerCost {
  id: string;
  customer_id: string;
  amount: number;
  description: string;
  cost_type: CustomerCostType;
  cost_date: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  profiles?: { display_name: string } | null;
}

export interface CustomerCostSummary {
  total_cost: number;
  count: number;
  by_type: Array<{ type: string; amount: number }>;
}

// ============================================================
// Care Schedule
// ============================================================

export interface CareScheduleStep {
  id: string;
  setting_id: string;
  name: string;
  description: string | null;
  days_offset: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CareScheduleSetting {
  id: string;
  customer_group_id: string;
  cycle_days: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer_groups?: { id: string; name: string; code: string | null } | null;
  care_schedule_steps?: CareScheduleStep[];
}

export interface CareScheduleEvent {
  id: string;
  customer_id: string;
  step_id: string | null;
  setting_id: string | null;
  assigned_to: string | null;
  scheduled_date: string;
  status: 'pending' | 'done' | 'skipped' | 'rescheduled';
  notes: string | null;
  completed_at: string | null;
  completed_by: string | null;
  original_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  customers?: { id: string; customer_name: string; phone_number: string | null; customer_group_id: string | null } | null;
  care_schedule_steps?: { id: string; name: string; description: string | null; days_offset: number } | null;
  care_schedule_settings?: { id: string; cycle_days: number; customer_groups?: { id: string; name: string } | null } | null;
  profiles?: { display_name: string } | null;
}
