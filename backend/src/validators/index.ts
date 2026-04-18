import { z } from 'zod';

// ============================================================
// AUTH
// ============================================================
export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
});

export const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
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
  company_name: z.string().min(1, 'Tên công ty không được trống'),
  contact_name: z.string().nullable().optional(),
  contact_email: z.string().email('Email không hợp lệ').nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  tax_code: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Optional: create a user account for this customer
  create_account: z.boolean().default(false),
  account_email: z.string().email().optional(),
  account_password: z.string().min(6).optional(),
});

export const updateCustomerSchema = z.object({
  company_name: z.string().min(1).optional(),
  contact_name: z.string().nullable().optional(),
  contact_email: z.string().email().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  tax_code: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
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
