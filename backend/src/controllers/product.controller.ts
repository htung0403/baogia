import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError, sendSuccess, sendCreated, parsePagination } from '../utils/index.js';
import { createProductSchema, updateProductSchema } from '../validators/index.js';
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
      .select('*, product_categories(name, slug)', { count: 'exact' });

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
      .select('*, product_categories(name, slug)')
      .eq('id', id)
      .single();

    if (error || !data) throw ApiError.notFound('Sản phẩm không tồn tại');

    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /products
 * Create a new product (admin/staff only)
 */
export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const input = createProductSchema.parse(req.body);

    // Check SKU uniqueness
    const { data: existing } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('sku', input.sku)
      .is('deleted_at', null)
      .single();

    if (existing) {
      throw ApiError.conflict(`SKU "${input.sku}" đã tồn tại`);
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({
        ...input,
        created_by: user.id,
      })
      .select('*, product_categories(name, slug)')
      .single();

    if (error) throw ApiError.internal(error.message);

    // Audit log
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
      .select('*, product_categories(name, slug)')
      .single();

    if (error) throw ApiError.internal(error.message);

    // Audit log
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
      .select('*, product_categories(name, slug)')
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
