import { z } from 'zod';

// ============================================================
// AUTH
// ============================================================
export const loginSchema = z.object({
  phone_number: z.string().min(10, 'Số điện thoại không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
});

export const registerSchema = z.object({
  phone_number: z.string().min(10, 'Số điện thoại không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
  display_name: z.string().min(1, 'Tên hiển thị không được trống'),
  role: z.enum(['admin', 'customer', 'staff']).default('customer'),
});

export const updateProfileSchema = z.object({
  display_name: z.string().min(1, 'Tên hiển thị không được trống').optional(),
  role: z.enum(['admin', 'customer', 'staff']).optional(),
  is_active: z.boolean().optional(),
});

// ============================================================
// PRODUCTS
// ============================================================
export const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU không được trống'),
  name: z.string().min(1, 'Tên sản phẩm không được trống'),
  category_id: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  specs: z.record(z.unknown()).default({}),
  image_urls: z.array(z.string()).default([]),
  unit: z.string().default('cái'),
  base_price: z.number().min(0, 'Giá phải >= 0'),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const updateProductSchema = createProductSchema.partial();

// ============================================================
// CUSTOMERS
// ============================================================
export const createCustomerSchema = z.object({
  customer_name: z.string().min(1, 'Tên khách hàng không được trống'),
  phone_number: z.string().nullable().optional(),
  email: z.string().email('Email không hợp lệ').nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  tax_code: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  customer_group: z.string().nullable().optional(),
  customer_group_id: z.string().uuid().nullable().optional(),
  website: z.string().nullable().optional(),
  fax: z.string().nullable().optional(),
  skype: z.string().nullable().optional(),
  facebook: z.string().nullable().optional(),
  tiktok_url: z.string().nullable().optional(),
  characteristics: z.string().nullable().optional(),
  create_account: z.boolean().default(false),
  account_phone: z.string().min(10).optional(),
  account_password: z.string().min(6).optional(),
});

export const updateCustomerSchema = z.object({
  customer_name: z.string().min(1).optional(),
  phone_number: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  source: z.string().optional().nullable(),
  tax_code: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  customer_group: z.string().nullable().optional(),
  customer_group_id: z.string().uuid().nullable().optional(),
  website: z.string().nullable().optional(),
  fax: z.string().nullable().optional(),
  skype: z.string().nullable().optional(),
  facebook: z.string().nullable().optional(),
  tiktok_url: z.string().nullable().optional(),
  characteristics: z.string().nullable().optional(),
});

// ============================================================
// CUSTOMER GROUPS
// ============================================================
export const createCustomerGroupSchema = z.object({
  name: z.string().min(1, 'Tên nhóm không được trống'),
  code: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
});

export const updateCustomerGroupSchema = createCustomerGroupSchema.partial();

// ============================================================
// PRICE LISTS
// ============================================================
export const createPriceListSchema = z.object({
  title: z.string().min(1, 'Tiêu đề không được trống'),
  description: z.string().nullable().optional(),
  customer_ids: z.array(z.string().uuid()).default([]),
});

export const createVersionSchema = z.object({
  changelog: z.string().nullable().optional(),
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      dealer_price: z.number().min(0).nullable().optional(),
      retail_price: z.number().min(0).nullable().optional(),
      public_price: z.number().min(0).nullable().optional(),
      note: z.string().nullable().optional(),
      sort_order: z.number().int().default(0),
    })
  ).min(1, 'Cần ít nhất 1 sản phẩm'),
});

export const assignCustomersSchema = z.object({
  customer_ids: z.array(z.string().uuid()).min(1, 'Cần ít nhất 1 khách hàng'),
});

// ============================================================
// TRACKING
// ============================================================
export const startSessionSchema = z.object({
  price_list_id: z.string(), // Cho phép string để handle cả trường hợp ID không phải UUID
  version_id: z.string().optional(),
  device: z.string().optional(),
});

export const endSessionSchema = z.object({
  session_id: z.string().uuid(),
});

export const trackItemViewSchema = z.object({
  session_id: z.string().uuid(),
  product_id: z.string().uuid(),
  view_duration_seconds: z.number().int().min(0).default(0),
});

// ============================================================
// PRODUCT CATEGORIES
// ============================================================
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Tên danh mục không được trống'),
  slug: z.string().min(1, 'Slug không được trống'),
  description: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  parent_id: z.string().uuid().nullable().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

// ============================================================
// Type exports
// ============================================================
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreatePriceListInput = z.infer<typeof createPriceListSchema>;
export type CreateVersionInput = z.infer<typeof createVersionSchema>;
export type AssignCustomersInput = z.infer<typeof assignCustomersSchema>;
export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type TrackItemViewInput = z.infer<typeof trackItemViewSchema>;

// ============================================================
// ORDERS
// ============================================================

export const orderItemInputSchema = z.object({
  product_id:              z.string().uuid('Invalid product ID'),
  product_name:            z.string().min(1, 'Product name required'),
  product_price_snapshot:  z.number().min(0, 'Price must be >= 0'),
  quantity:                z.number().int().min(1, 'Quantity must be >= 1'),
  unit_price:              z.number().min(0, 'Unit price must be >= 0'),
  notes:                   z.string().nullable().optional(),
});

export const createOrderSchema = z.object({
  customer_id:      z.string().uuid('Invalid customer ID'),
  order_date:       z.string().datetime({ offset: true }).optional(),
  discount_amount:  z.number().min(0).default(0),
  notes:            z.string().nullable().optional(),
  items:            z.array(orderItemInputSchema).min(1, 'At least one item required'),
});

export const updateOrderSchema = z.object({
  discount_amount: z.number().min(0).optional(),
  notes:           z.string().nullable().optional(),
  items:           z.array(orderItemInputSchema).min(1, 'At least one item required'),
});

// ============================================================
// PAYMENTS
// ============================================================

export const createPaymentSchema = z.object({
  customer_id:     z.string().uuid('Invalid customer ID'),
  order_id:        z.string().uuid().nullable().optional(),
  amount:          z.number().positive('Amount must be positive'),
  payment_method:  z.enum(['cash', 'transfer', 'card', 'momo']),
  notes:           z.string().nullable().optional(),
});

// ============================================================
// PIPELINE
// ============================================================

// Stage assignment
export const assignStageSchema = z.object({
  stage_id: z.string().uuid('stage_id phải là UUID hợp lệ'),
  note: z.string().trim().min(1, 'Ghi chú không được để trống'),
});

// Funnel query params
export const funnelQuerySchema = z.object({
  assigned_to: z.string().uuid().optional(),
  period: z.enum(['this_month', 'last_month', 'all']).default('this_month'),
  all_kh: z.string().optional().transform(v => v === 'true'),
});

// ============================================================
// PIPELINE SETTINGS
// ============================================================
export const createColumnSchema = z.object({
  name: z.string().min(1, 'Tên không được trống'),
  color: z.string().optional().nullable(),
  sort_order: z.number().int().default(0),
});

export const updateColumnSchema = createColumnSchema.partial();

export const createStageSchema = z.object({
  column_id: z.string().uuid('column_id phải là UUID hợp lệ'),
  name: z.string().min(1, 'Tên không được trống'),
  description: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  sort_order: z.number().int().default(0),
});

export const updateStageSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  sort_order: z.number().int().optional(),
});

// Create activity
export const createActivitySchema = z.object({
  customer_id:     z.string().uuid(),
  activity_type:   z.enum(['email','sms','zns','call','task','meeting','note','trao_doi','kh_phan_hoi']),
  title:           z.string().min(1),
  description:     z.string().optional().nullable(),
  assigned_to:     z.string().uuid().optional().nullable(),
  related_project: z.string().optional().nullable(),
  scheduled_at:    z.string().datetime({ offset: true }).optional().nullable(),
  status:          z.enum(['pending', 'done', 'cancelled']).optional().nullable(),
});

// Create quote
export const createQuoteSchema = z.object({
  customer_id: z.string().uuid(),
  title:       z.string().optional().nullable(),
  amount:      z.number().min(0).default(0),
  notes:       z.string().optional().nullable(),
});

// Create contract
export const createContractSchema = z.object({
  customer_id: z.string().uuid(),
  title:       z.string().optional().nullable(),
  amount:      z.number().min(0).default(0),
  start_date:  z.string().optional().nullable(),
  end_date:    z.string().optional().nullable(),
  notes:       z.string().optional().nullable(),
});

// ============================================================
// CUSTOMER COSTS
// ============================================================
export const createCustomerCostSchema = z.object({
  customer_id: z.string().uuid(),
  amount: z.number().positive('Số tiền phải lớn hơn 0'),
  description: z.string().min(1, 'Mô tả không được trống'),
  cost_type: z.enum(['advertising', 'consulting', 'travel', 'gift', 'commission', 'other']).default('other'),
  cost_date: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export const updateCustomerCostSchema = z.object({
  amount: z.number().positive('Số tiền phải lớn hơn 0').optional(),
  description: z.string().min(1).optional(),
  cost_type: z.enum(['advertising', 'consulting', 'travel', 'gift', 'commission', 'other']).optional(),
  cost_date: z.string().optional(),
  notes: z.string().optional().nullable(),
});

// ============================================================
// Type exports (orders + payments)
// ============================================================
export type OrderItemInput   = z.infer<typeof orderItemInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type AssignStageInput = z.infer<typeof assignStageSchema>;
export type FunnelQueryInput = z.infer<typeof funnelQuerySchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type CreateContractInput = z.infer<typeof createContractSchema>;
export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type CreateStageInput = z.infer<typeof createStageSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
export type CreateCustomerCostInput = z.infer<typeof createCustomerCostSchema>;
export type UpdateCustomerCostInput = z.infer<typeof updateCustomerCostSchema>;
export type CreateCustomerGroupInput = z.infer<typeof createCustomerGroupSchema>;
export type UpdateCustomerGroupInput = z.infer<typeof updateCustomerGroupSchema>;

// ============================================================
// Care Schedule
// ============================================================

export const createCareSettingSchema = z.object({
  customer_group_id: z.string().uuid(),
  cycle_days: z.number().int().min(1).max(365),
  is_active: z.boolean().optional().default(true),
  steps: z.array(z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(500).nullable().optional(),
    days_offset: z.number().int().min(0).max(365),
    sort_order: z.number().int().min(0).optional().default(0),
  })).min(1, 'Cần ít nhất 1 bước chăm sóc'),
});

export const updateCareSettingSchema = z.object({
  cycle_days: z.number().int().min(1).max(365).optional(),
  is_active: z.boolean().optional(),
  steps: z.array(z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(500).nullable().optional(),
    days_offset: z.number().int().min(0).max(365),
    sort_order: z.number().int().min(0).optional().default(0),
  })).min(1, 'Cần ít nhất 1 bước chăm sóc').optional(),
});

export const generateCareEventsSchema = z.object({
  customer_group_id: z.string().uuid('ID nhóm khách hàng không hợp lệ'),
  horizon_days: z.number().int().min(1).max(90).optional(),
});

export const createCareEventSchema = z.object({
  customer_id: z.string().uuid('ID khách hàng không hợp lệ'),
  scheduled_date: z.string(),
  notes: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
});

export const updateCareEventSchema = z.object({
  status: z.enum(['done', 'skipped']).optional(),
  notes: z.string().max(1000).nullable().optional(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng ngày: YYYY-MM-DD').optional(),
});
