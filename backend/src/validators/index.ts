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
  // Optional: create a user account for this customer
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
});

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
});

// Funnel query params
export const funnelQuerySchema = z.object({
  assigned_to: z.string().uuid().optional(),
  period: z.enum(['this_month', 'last_month', 'all']).default('this_month'),
  all_kh: z.string().optional().transform(v => v === 'true'),
});

// Create activity
export const createActivitySchema = z.object({
  customer_id:     z.string().uuid(),
  activity_type:   z.enum(['email','sms','zns','call','task','meeting','note','trao_doi']),
  title:           z.string().min(1),
  description:     z.string().optional().nullable(),
  assigned_to:     z.string().uuid().optional().nullable(),
  related_project: z.string().optional().nullable(),
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
