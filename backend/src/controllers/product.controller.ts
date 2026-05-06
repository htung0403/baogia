import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError, sendSuccess, sendCreated, parsePagination } from '../utils/index.js';
import { createProductSchema, updateProductSchema, updateProductGroupPricesSchema } from '../validators/index.js';
import { AuthenticatedRequest } from '../types/api.js';
import { AuditService } from '../services/audit.service.js';

/**
 * GET /products
 * List products with pagination, search, filter
 */
export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const search = req.query.search as string | undefined;
    const category_id = req.query.category_id as string | undefined;
    const is_active = req.query.is_active as string | undefined;
    const include_deleted = req.query.include_deleted === 'true';

    let query = supabaseAdmin
      .from('products')
      .select('*, product_categories(name, slug), brands(name, slug), product_groups(name, slug)', { count: 'exact' });

    // Soft delete filter (admin can see deleted)
    if (!include_deleted) {
      query = query.is('deleted_at', null);
    }

    // Search by name or SKU
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    // Filter by category
    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    // Filter by active status
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    // Sort and paginate
    const sort_by = (req.query.sort_by as string) || 'sort_order';
    const sort_order = req.query.sort_order === 'desc' ? false : true;

    query = query.order(sort_by, { ascending: sort_order }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw ApiError.internal(error.message);

    sendSuccess(res, data, undefined, 200, {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /products/:id
 * Get single product
 */
export async function getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*, product_categories(name, slug), brands(name, slug), product_groups(name, slug)')
      .eq('id', id)
      .single();

    if (error || !data) throw ApiError.notFound('Sản phẩm không tồn tại');

    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

function generateSku(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SP${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${random}`;
}

/**
 * POST /products
 * Create a new product (admin/staff only)
 */
export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const input = createProductSchema.parse(req.body);
    const sku = input.sku || generateSku();

    // Check SKU uniqueness
    const { data: existing } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('sku', sku)
      .is('deleted_at', null)
      .single();

    if (existing) {
      throw ApiError.conflict(`SKU "${sku}" đã tồn tại`);
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({
        ...input,
        sku,
        created_by: user.id,
      })
      .select('*, product_categories(name, slug), brands(name, slug), product_groups(name, slug)')
      .single();

    if (error) throw ApiError.internal(error.message);

    const groupPrices = req.body.group_prices as Array<{ customer_group_id: string; price: number }> | undefined;
    if (groupPrices && groupPrices.length > 0) {
      await supabaseAdmin.from('product_group_prices').insert(
        groupPrices.map((p) => ({
          product_id: data.id,
          customer_group_id: p.customer_group_id,
          price: p.price,
        }))
      );
    }

    await AuditService.log({
      actorId: user.id,
      action: 'create',
      entityType: 'product',
      entityId: data.id,
      newData: data,
      ipAddress: req.ip,
    });

    sendCreated(res, data, 'Tạo sản phẩm thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /products/:id
 * Update a product (admin/staff only)
 */
export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const input = updateProductSchema.parse(req.body);

    // Fetch old data for audit
    const { data: oldData, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !oldData) throw ApiError.notFound('Sản phẩm không tồn tại');

    // Check SKU uniqueness if changed
    if (input.sku && input.sku !== oldData.sku) {
      const { data: existing } = await supabaseAdmin
        .from('products')
        .select('id')
        .eq('sku', input.sku)
        .is('deleted_at', null)
        .neq('id', id)
        .single();

      if (existing) {
        throw ApiError.conflict(`SKU "${input.sku}" đã tồn tại`);
      }
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .update(input)
      .eq('id', id)
      .select('*, product_categories(name, slug), brands(name, slug), product_groups(name, slug)')
      .single();

    if (error) throw ApiError.internal(error.message);

    const groupPrices = req.body.group_prices as Array<{ customer_group_id: string; price: number }> | undefined;
    if (groupPrices) {
      await supabaseAdmin.from('product_group_prices').delete().eq('product_id', id);
      if (groupPrices.length > 0) {
        await supabaseAdmin.from('product_group_prices').insert(
          groupPrices.map((p) => ({
            product_id: id,
            customer_group_id: p.customer_group_id,
            price: p.price,
          }))
        );
      }
    }

    await AuditService.log({
      actorId: user.id,
      action: 'update',
      entityType: 'product',
      entityId: id,
      oldData,
      newData: data,
      ipAddress: req.ip,
    });

    sendSuccess(res, data, 'Cập nhật sản phẩm thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /products/:id
 * Soft delete a product (admin only)
 */
export async function deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    // Fetch old data for audit
    const { data: oldData, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !oldData) throw ApiError.notFound('Sản phẩm không tồn tại');

    // Soft delete
    const { error } = await supabaseAdmin
      .from('products')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw ApiError.internal(error.message);

    // Audit log
    await AuditService.log({
      actorId: user.id,
      action: 'delete',
      entityType: 'product',
      entityId: id,
      oldData,
      ipAddress: req.ip,
    });

    sendSuccess(res, { id }, 'Xóa sản phẩm thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /products/:id/restore
 * Restore a soft-deleted product (admin only)
 */
export async function restoreProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('products')
      .update({ deleted_at: null })
      .eq('id', id)
      .not('deleted_at', 'is', null)
      .select('*, product_categories(name, slug), brands(name, slug), product_groups(name, slug)')
      .single();

    if (error || !data) throw ApiError.notFound('Sản phẩm không tồn tại hoặc chưa bị xóa');

    await AuditService.log({
      actorId: user.id,
      action: 'restore',
      entityType: 'product',
      entityId: id,
      newData: data,
      ipAddress: req.ip,
    });

    sendSuccess(res, data, 'Khôi phục sản phẩm thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * GET /products/:id/group-prices
 * List group prices for a product
 */
export async function listProductGroupPrices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('product_group_prices')
      .select('*, customer_groups(name, code)')
      .eq('product_id', id)
      .order('created_at', { ascending: true });

    if (error) throw ApiError.internal(error.message);

    sendSuccess(res, data ?? []);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /products/:id/group-prices
 * Update group prices for a product (batch upsert)
 */
export async function updateProductGroupPrices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const input = updateProductGroupPricesSchema.parse(req.body);

    const { data: product } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!product) throw ApiError.notFound('Sản phẩm không tồn tại');

    await supabaseAdmin
      .from('product_group_prices')
      .delete()
      .eq('product_id', id);

    if (input.prices.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('product_group_prices')
        .insert(
          input.prices.map((p) => ({
            product_id: id,
            customer_group_id: p.customer_group_id,
            price: p.price,
          }))
        );

      if (insertError) throw ApiError.internal(insertError.message);
    }

    await AuditService.log({
      actorId: user.id,
      action: 'update',
      entityType: 'product',
      entityId: id,
      newData: { group_prices: input.prices },
      ipAddress: req.ip,
    });

    const { data } = await supabaseAdmin
      .from('product_group_prices')
      .select('*, customer_groups(name, code)')
      .eq('product_id', id)
      .order('created_at', { ascending: true });

    sendSuccess(res, data ?? [], 'Cập nhật giá nhóm thành công');
  } catch (error) {
    next(error);
  }
}
