import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError, sendSuccess, sendCreated, parsePagination } from '../utils/index.js';
import {
  createPriceListSchema,
  createVersionSchema,
  assignCustomersSchema,
} from '../validators/index.js';
import { AuthenticatedRequest } from '../types/api.js';
import { AuditService } from '../services/audit.service.js';

// ============================================================
// PRICE LIST CRUD
// ============================================================

/**
 * GET /price-lists
 * List price lists.
 * - Admin/staff: see all
 * - Customer: see only assigned + published
 */
export async function listPriceLists(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;

    if (user.profile.role === 'customer') {
      // Customer: only see assigned, published lists
      const { data: customerRecord } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('profile_id', user.id)
        .is('deleted_at', null)
        .single();

      if (!customerRecord) {
        sendSuccess(res, [], undefined, 200, { page, limit, total: 0, totalPages: 0 });
        return;
      }

      let query = supabaseAdmin
        .from('price_list_customers')
        .select(`
          assigned_at,
          price_lists!inner(
            id, title, description, status, created_at, updated_at
          )
        `, { count: 'exact' })
        .eq('customer_id', customerRecord.id)
        .eq('price_lists.status', 'published')
        .is('price_lists.deleted_at', null);

      if (search) {
        query = query.ilike('price_lists.title', `%${search}%`);
      }

      query = query.order('assigned_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw ApiError.internal(error.message);

      // Flatten results
      const priceLists = (data ?? []).map((row: any) => ({
        ...row.price_lists,
        assigned_at: row.assigned_at,
      }));

      sendSuccess(res, priceLists, undefined, 200, {
        page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit),
      });
      return;
    }

    // Admin/staff: see all
    let query = supabaseAdmin
      .from('price_lists')
      .select('*, profiles:created_by(display_name)', { count: 'exact' })
      .is('deleted_at', null);

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw ApiError.internal(error.message);

    // Attach version count and customer count for each list
    const enriched = await Promise.all(
      (data ?? []).map(async (pl: any) => {
        const [versionRes, customerRes] = await Promise.all([
          supabaseAdmin
            .from('price_list_versions')
            .select('id', { count: 'exact', head: true })
            .eq('price_list_id', pl.id),
          supabaseAdmin
            .from('price_list_customers')
            .select('id', { count: 'exact', head: true })
            .eq('price_list_id', pl.id),
        ]);
        return {
          ...pl,
          version_count: versionRes.count ?? 0,
          customer_count: customerRes.count ?? 0,
        };
      })
    );

    sendSuccess(res, enriched, undefined, 200, {
      page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /price-lists/:id
 * Get single price list with current published version + items
 */
export async function getPriceList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    // Fetch price list
    const { data: priceList, error } = await supabaseAdmin
      .from('price_lists')
      .select('*, profiles:created_by(display_name)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !priceList) throw ApiError.notFound('Bảng giá không tồn tại');

    // Customer: check assignment
    if (user.profile.role === 'customer') {
      const { data: customerRecord } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('profile_id', user.id)
        .is('deleted_at', null)
        .single();

      if (!customerRecord) throw ApiError.forbidden('Không có quyền xem bảng giá này');

      const { data: assignment } = await supabaseAdmin
        .from('price_list_customers')
        .select('id')
        .eq('price_list_id', id)
        .eq('customer_id', customerRecord.id)
        .single();

      if (!assignment) throw ApiError.forbidden('Bảng giá chưa được gán cho bạn');
    }

    // Fetch all versions
    const { data: versions } = await supabaseAdmin
      .from('price_list_versions')
      .select('*')
      .eq('price_list_id', id)
      .order('version_number', { ascending: false });

    // Fetch current published version's items
    const publishedVersion = (versions ?? []).find((v: any) => v.status === 'published');

    let items: any[] = [];
    if (publishedVersion) {
      const { data: versionItems } = await supabaseAdmin
        .from('price_list_items')
        .select('*')
        .eq('version_id', publishedVersion.id)
        .order('sort_order', { ascending: true });
      items = versionItems ?? [];
    }

    // Fetch assigned customers
    const { data: customers } = await supabaseAdmin
      .from('price_list_customers')
      .select('*, customers(id, customer_name, phone_number)')
      .eq('price_list_id', id);

    sendSuccess(res, {
      ...priceList,
      versions: versions ?? [],
      current_version: publishedVersion ?? null,
      items,
      assigned_customers: customers ?? [],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /price-lists
 * Create a new price list (admin/staff only)
 */
export async function createPriceList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const input = createPriceListSchema.parse(req.body);

    // Create the price list
    const { data: priceList, error } = await supabaseAdmin
      .from('price_lists')
      .insert({
        title: input.title,
        description: input.description ?? null,
        status: 'draft',
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) throw ApiError.internal(error.message);

    // Assign customers if provided
    if (input.customer_ids.length > 0) {
      const assignments = input.customer_ids.map((cid) => ({
        price_list_id: priceList.id,
        customer_id: cid,
        assigned_by: user.id,
      }));

      const { error: assignError } = await supabaseAdmin
        .from('price_list_customers')
        .insert(assignments);

      if (assignError) {
        console.error('[PRICE_LIST] Failed to assign customers:', assignError.message);
      }
    }

    await AuditService.log({
      actorId: user.id,
      action: 'create',
      entityType: 'price_list',
      entityId: priceList.id,
      newData: { ...priceList, customer_ids: input.customer_ids },
      ipAddress: req.ip,
    });

    sendCreated(res, priceList, 'Tạo bảng giá thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /price-lists/:id
 * Update price list title/description (admin/staff only)
 */
export async function updatePriceList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const { title, description } = req.body;

    const { data: oldData } = await supabaseAdmin
      .from('price_lists')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!oldData) throw ApiError.notFound('Bảng giá không tồn tại');

    const updateFields: Record<string, unknown> = {};
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;

    const { data, error } = await supabaseAdmin
      .from('price_lists')
      .update(updateFields)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw ApiError.internal(error.message);

    await AuditService.log({
      actorId: user.id,
      action: 'update',
      entityType: 'price_list',
      entityId: id,
      oldData,
      newData: data,
      ipAddress: req.ip,
    });

    sendSuccess(res, data, 'Cập nhật bảng giá thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /price-lists/:id
 * Soft delete a price list
 */
export async function deletePriceList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    const { data: oldData } = await supabaseAdmin
      .from('price_lists')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!oldData) throw ApiError.notFound('Bảng giá không tồn tại');

    const { error } = await supabaseAdmin
      .from('price_lists')
      .update({ deleted_at: new Date().toISOString(), status: 'archived' })
      .eq('id', id);

    if (error) throw ApiError.internal(error.message);

    await AuditService.log({
      actorId: user.id,
      action: 'delete',
      entityType: 'price_list',
      entityId: id,
      oldData,
      ipAddress: req.ip,
    });

    sendSuccess(res, { id }, 'Xóa bảng giá thành công');
  } catch (error) {
    next(error);
  }
}

// ============================================================
// VERSION MANAGEMENT
// ============================================================

/**
 * POST /price-lists/:id/versions
 * Create a new version with items (snapshot product data)
 */
export async function createVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id: priceListId } = req.params;
    const input = createVersionSchema.parse(req.body);

    // Verify price list exists
    const { data: priceList } = await supabaseAdmin
      .from('price_lists')
      .select('id')
      .eq('id', priceListId)
      .is('deleted_at', null)
      .single();

    if (!priceList) throw ApiError.notFound('Bảng giá không tồn tại');

    // Get next version number
    const { data: latestVersion } = await supabaseAdmin
      .from('price_list_versions')
      .select('version_number')
      .eq('price_list_id', priceListId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

    // Create version
    const { data: version, error: versionError } = await supabaseAdmin
      .from('price_list_versions')
      .insert({
        price_list_id: priceListId,
        version_number: nextVersionNumber,
        status: 'draft',
        changelog: input.changelog ?? null,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (versionError) throw ApiError.internal(versionError.message);

    // Fetch product data for snapshots
    const productIds = input.items.map((item) => item.product_id);
    
    const CHUNK_SIZE = 50;
    const products: any[] = [];
    
    for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
      const chunk = productIds.slice(i, i + CHUNK_SIZE);
      const { data: chunkProducts, error: chunkError } = await supabaseAdmin
        .from('products')
        .select('id, name, sku, specs, image_urls, unit')
        .in('id', chunk);
        
      if (chunkError) throw ApiError.internal(chunkError.message);
      if (chunkProducts) {
        products.push(...chunkProducts);
      }
    }

    const productMap = new Map((products ?? []).map((p: any) => [p.id, p]));

    // Validate all products exist
    const missingProducts = productIds.filter((pid) => !productMap.has(pid));
    if (missingProducts.length > 0) {
      throw ApiError.badRequest(
        `Sản phẩm không tồn tại: ${missingProducts.join(', ')}`
      );
    }

    // Create items with snapshots
    const itemsToInsert = input.items.map((item, index) => {
      const product = productMap.get(item.product_id)!;
      return {
        version_id: version.id,
        product_id: item.product_id,
        // Snapshot
        product_name_snapshot: product.name,
        product_sku_snapshot: product.sku,
        product_specs_snapshot: product.specs,
        product_image_snapshot: product.image_urls?.[0] ?? null,
        product_unit_snapshot: product.unit,
        // Pricing
        dealer_price: item.dealer_price ?? null,
        retail_price: item.retail_price ?? null,
        public_price: item.public_price ?? null,
        note: item.note ?? null,
        sort_order: item.sort_order ?? index,
        // Flags (will be computed on publish)
        is_new: false,
        is_changed: false,
      };
    });

    const { error: itemsError } = await supabaseAdmin
      .from('price_list_items')
      .insert(itemsToInsert);

    if (itemsError) throw ApiError.internal(itemsError.message);

    // Fetch created items
    const { data: createdItems } = await supabaseAdmin
      .from('price_list_items')
      .select('*')
      .eq('version_id', version.id)
      .order('sort_order', { ascending: true });

    await AuditService.log({
      actorId: user.id,
      action: 'create',
      entityType: 'price_list_version',
      entityId: version.id,
      newData: { version, item_count: input.items.length },
      ipAddress: req.ip,
    });

    sendCreated(res, {
      ...version,
      items: createdItems ?? [],
    }, `Tạo phiên bản ${nextVersionNumber} thành công`);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /price-lists/:id/versions/:versionId
 * Get a specific version with all items
 */
export async function getVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: priceListId, versionId } = req.params;

    const { data: version, error } = await supabaseAdmin
      .from('price_list_versions')
      .select('*')
      .eq('id', versionId)
      .eq('price_list_id', priceListId)
      .single();

    if (error || !version) throw ApiError.notFound('Phiên bản không tồn tại');

    const { data: items } = await supabaseAdmin
      .from('price_list_items')
      .select('*')
      .eq('version_id', versionId)
      .order('sort_order', { ascending: true });

    sendSuccess(res, {
      ...version,
      items: items ?? [],
    });
  } catch (error) {
    next(error);
  }
}

export async function updateVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id: priceListId, versionId } = req.params;
    const input = createVersionSchema.parse(req.body);

    const { data: version } = await supabaseAdmin
      .from('price_list_versions')
      .select('*')
      .eq('id', versionId)
      .eq('price_list_id', priceListId)
      .eq('status', 'draft')
      .single();

    if (!version) throw ApiError.badRequest('Phiên bản không tồn tại hoặc không ở trạng thái draft');

    const productIds = input.items.map((item) => item.product_id);
    const CHUNK_SIZE = 50;
    const products: any[] = [];
    
    for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
      const chunk = productIds.slice(i, i + CHUNK_SIZE);
      const { data: chunkProducts, error: chunkError } = await supabaseAdmin
        .from('products')
        .select('id, name, sku, specs, image_urls, unit')
        .in('id', chunk);
      if (chunkError) throw ApiError.internal(chunkError.message);
      if (chunkProducts) products.push(...chunkProducts);
    }

    const productMap = new Map(products.map((p: any) => [p.id, p]));
    const missingProducts = productIds.filter((pid) => !productMap.has(pid));
    if (missingProducts.length > 0) {
      throw ApiError.badRequest(`Sản phẩm không tồn tại: ${missingProducts.join(', ')}`);
    }

    await supabaseAdmin.from('price_list_items').delete().eq('version_id', versionId);

    const itemsToInsert = input.items.map((item, index) => {
      const product = productMap.get(item.product_id)!;
      return {
        version_id: versionId,
        product_id: item.product_id,
        product_name_snapshot: product.name,
        product_sku_snapshot: product.sku,
        product_specs_snapshot: product.specs,
        product_image_snapshot: product.image_urls?.[0] ?? null,
        product_unit_snapshot: product.unit,
        dealer_price: item.dealer_price ?? null,
        retail_price: item.retail_price ?? null,
        public_price: item.public_price ?? null,
        note: item.note ?? null,
        sort_order: item.sort_order ?? index,
        is_new: false,
        is_changed: false,
      };
    });

    const { error: itemsError } = await supabaseAdmin.from('price_list_items').insert(itemsToInsert);
    if (itemsError) throw ApiError.internal(itemsError.message);

    if (input.changelog !== undefined) {
      await supabaseAdmin
        .from('price_list_versions')
        .update({ changelog: input.changelog })
        .eq('id', versionId);
    }

    const { data: updatedVersion } = await supabaseAdmin
      .from('price_list_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    const { data: createdItems } = await supabaseAdmin
      .from('price_list_items')
      .select('*')
      .eq('version_id', versionId)
      .order('sort_order', { ascending: true });

    sendSuccess(res, { ...updatedVersion, items: createdItems ?? [] }, 'Cập nhật phiên bản thành công');
  } catch (error) {
    next(error);
  }
}

export async function deleteVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id: priceListId, versionId } = req.params;

    console.log('[DELETE_VERSION_START] Trying to delete version:', versionId, 'for priceList:', priceListId);

    const { data: version, error: findError } = await supabaseAdmin
      .from('price_list_versions')
      .select('*')
      .eq('id', versionId)
      .eq('price_list_id', priceListId)
      .eq('status', 'draft')
      .single();

    if (findError || !version) {
      console.error('[PRICE_LIST_VERSION_DELETE_ERROR] Version not found or not draft. findError:', findError);
      throw ApiError.badRequest('Phiên bản không tồn tại hoặc không ở trạng thái draft');
    }

    await supabaseAdmin
      .from('view_sessions')
      .update({ version_id: null })
      .eq('version_id', versionId);

    const { data: deleteData, error } = await supabaseAdmin
      .from('price_list_versions')
      .delete()
      .match({ id: versionId })
      .select();

    if (error) {
      console.error('[PRICE_LIST_VERSION_DELETE_ERROR] DB delete failed:', error);
      throw ApiError.internal(error.message);
    }

    console.log('[DELETE_VERSION_SUCCESS] Version deleted from DB. deleteData:', deleteData);

    sendSuccess(res, { id: versionId }, `Xóa phiên bản thành công`);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /price-lists/:id/versions/:versionId/publish
 * Publish a version (auto-detect changes, supersede old version)
 */
export async function publishVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id: priceListId, versionId } = req.params;

    // Verify version exists and is draft
    const { data: version } = await supabaseAdmin
      .from('price_list_versions')
      .select('*')
      .eq('id', versionId)
      .eq('price_list_id', priceListId)
      .eq('status', 'draft')
      .single();

    if (!version) {
      throw ApiError.badRequest('Phiên bản không tồn tại hoặc không ở trạng thái draft');
    }

    // Find currently published version (for change detection)
    const { data: oldPublished } = await supabaseAdmin
      .from('price_list_versions')
      .select('id')
      .eq('price_list_id', priceListId)
      .eq('status', 'published')
      .single();

    // Call the database function to publish
    // This handles: supersede old, publish new, detect changes
    const { error: rpcError } = await supabaseAdmin
      .rpc('publish_price_list_version', { p_version_id: versionId });

    if (rpcError) {
      // Fallback: do it manually if RPC not available
      console.warn('[PRICE_LIST] RPC failed, doing manual publish:', rpcError.message);
      await manualPublish(priceListId, versionId, oldPublished?.id ?? null);
    }

    // Fetch updated version
    const { data: updatedVersion } = await supabaseAdmin
      .from('price_list_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    const { data: items } = await supabaseAdmin
      .from('price_list_items')
      .select('*')
      .eq('version_id', versionId)
      .order('sort_order', { ascending: true });

    await AuditService.log({
      actorId: user.id,
      action: 'publish',
      entityType: 'price_list_version',
      entityId: versionId,
      newData: { version_number: version.version_number, price_list_id: priceListId },
      ipAddress: req.ip,
    });

    sendSuccess(res, {
      ...updatedVersion,
      items: items ?? [],
    }, `Phiên bản ${version.version_number} đã được publish`);
  } catch (error) {
    next(error);
  }
}

/**
 * Manual publish fallback (if DB function not available)
 */
async function manualPublish(
  priceListId: string,
  newVersionId: string,
  oldVersionId: string | null
): Promise<void> {
  // 1. Supersede old version
  if (oldVersionId) {
    await supabaseAdmin
      .from('price_list_versions')
      .update({ status: 'superseded' })
      .eq('id', oldVersionId);
  }

  // 2. Publish new version
  await supabaseAdmin
    .from('price_list_versions')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', newVersionId);

  // 3. Update master price list status
  await supabaseAdmin
    .from('price_lists')
    .update({ status: 'published' })
    .eq('id', priceListId);

  // 4. Detect changes
  if (oldVersionId) {
    // Get old items
    const { data: oldItems } = await supabaseAdmin
      .from('price_list_items')
      .select('product_id, dealer_price, retail_price, public_price')
      .eq('version_id', oldVersionId);

    const oldMap = new Map(
      (oldItems ?? []).map((item: any) => [item.product_id, item])
    );

    // Get new items
    const { data: newItems } = await supabaseAdmin
      .from('price_list_items')
      .select('id, product_id, dealer_price, retail_price, public_price')
      .eq('version_id', newVersionId);

    // Update each item's flags
    for (const newItem of newItems ?? []) {
      const oldItem = oldMap.get(newItem.product_id);

      if (!oldItem) {
        // New product
        await supabaseAdmin
          .from('price_list_items')
          .update({ is_new: true, is_changed: false })
          .eq('id', newItem.id);
      } else if (
        oldItem.dealer_price !== newItem.dealer_price ||
        oldItem.retail_price !== newItem.retail_price ||
        oldItem.public_price !== newItem.public_price
      ) {
        // Price changed
        const changeAmount = (newItem.dealer_price ?? 0) - (oldItem.dealer_price ?? 0);
        const changePct = oldItem.dealer_price
          ? Number(((changeAmount / oldItem.dealer_price) * 100).toFixed(2))
          : null;

        await supabaseAdmin
          .from('price_list_items')
          .update({
            is_new: false,
            is_changed: true,
            price_change_amount: changeAmount,
            price_change_pct: changePct,
          })
          .eq('id', newItem.id);
      } else {
        // No change
        await supabaseAdmin
          .from('price_list_items')
          .update({
            is_new: false,
            is_changed: false,
            price_change_amount: 0,
            price_change_pct: 0,
          })
          .eq('id', newItem.id);
      }
    }
  } else {
    // First version: mark all as new
    await supabaseAdmin
      .from('price_list_items')
      .update({ is_new: true })
      .eq('version_id', newVersionId);
  }
}

// ============================================================
// CUSTOMER ASSIGNMENT
// ============================================================

/**
 * POST /price-lists/:id/customers
 * Assign customers to a price list
 */
export async function assignCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id: priceListId } = req.params;
    const { customer_ids } = assignCustomersSchema.parse(req.body);

    // Verify price list exists
    const { data: priceList } = await supabaseAdmin
      .from('price_lists')
      .select('id')
      .eq('id', priceListId)
      .is('deleted_at', null)
      .single();

    if (!priceList) throw ApiError.notFound('Bảng giá không tồn tại');

    // Upsert assignments (ignore duplicates)
    const assignments = customer_ids.map((cid) => ({
      price_list_id: priceListId,
      customer_id: cid,
      assigned_by: user.id,
    }));

    const { error } = await supabaseAdmin
      .from('price_list_customers')
      .upsert(assignments, {
        onConflict: 'price_list_id,customer_id',
        ignoreDuplicates: true,
      });

    if (error) throw ApiError.internal(error.message);

    // Log each assignment
    for (const cid of customer_ids) {
      await AuditService.log({
        actorId: user.id,
        action: 'assign',
        entityType: 'price_list_customer',
        entityId: priceListId,
        newData: { customer_id: cid },
        ipAddress: req.ip,
      });
    }

    sendSuccess(res, { assigned: customer_ids.length }, 'Gán khách hàng thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /price-lists/:id/customers/:customerId
 * Unassign a customer from a price list
 */
export async function unassignCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id: priceListId, customerId } = req.params;

    const { error } = await supabaseAdmin
      .from('price_list_customers')
      .delete()
      .eq('price_list_id', priceListId)
      .eq('customer_id', customerId);

    if (error) throw ApiError.internal(error.message);

    await AuditService.log({
      actorId: user.id,
      action: 'unassign',
      entityType: 'price_list_customer',
      entityId: priceListId,
      oldData: { customer_id: customerId },
      ipAddress: req.ip,
    });

    sendSuccess(res, null, 'Bỏ gán khách hàng thành công');
  } catch (error) {
    next(error);
  }
}
