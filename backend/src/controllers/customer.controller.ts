import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError, sendSuccess, sendCreated, parsePagination } from '../utils/index.js';
import { createCustomerSchema, updateCustomerSchema } from '../validators/index.js';
import { AuthenticatedRequest } from '../types/api.js';
import { AuditService } from '../services/audit.service.js';
import { formatPhoneE164, phoneToEmail } from '../utils/phone.js';

/**
 * GET /customers
 * List customers with pagination and search (admin/staff only)
 */
export async function listCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const search = req.query.search as string | undefined;
    const include_deleted = req.query.include_deleted === 'true';

    let query = supabaseAdmin
      .from('customers')
      .select('*, profiles:profile_id(display_name, email:id, role, is_active)', { count: 'exact' });

    if (!include_deleted) {
      query = query.is('deleted_at', null);
    }

    if (search) {
      query = query.or(
        `customer_name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

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
 * GET /customers/:id
 * Get single customer with assigned price lists
 */
export async function getCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .select('*, profiles:profile_id(display_name, role, is_active)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !customer) throw ApiError.notFound('Khách hàng không tồn tại');

    // Fetch assigned price lists
    const { data: assignments } = await supabaseAdmin
      .from('price_list_customers')
      .select('*, price_lists(id, title, status, created_at)')
      .eq('customer_id', id);

    sendSuccess(res, {
      ...customer,
      assigned_price_lists: assignments ?? [],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /customers
 * Create a new customer, optionally with a user account
 */
export async function createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const input = createCustomerSchema.parse(req.body);

    let profileId: string | null = null;

    // Optionally create a Supabase Auth account for this customer
    if (input.create_account && input.account_phone && input.account_password) {
      const shadowEmail = phoneToEmail(input.account_phone);
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: shadowEmail,
        password: input.account_password,
        email_confirm: true,
        user_metadata: {
          display_name: input.customer_name,
          role: 'customer',
          phone_number: formatPhoneE164(input.account_phone),
        },
      });

      if (authError) {
        if (authError.message.includes('already')) {
          throw ApiError.conflict('Số điện thoại đã được sử dụng');
        }
        throw ApiError.badRequest(authError.message);
      }

      profileId = authData.user.id;
    }

    // Create customer record
    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert({
        profile_id: profileId,
        customer_name: input.customer_name,
        phone_number: input.phone_number ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) throw ApiError.internal(error.message);

    await AuditService.log({
      actorId: user.id,
      action: 'create',
      entityType: 'customer',
      entityId: data.id,
      newData: data,
      ipAddress: req.ip,
    });

    sendCreated(res, data, 'Tạo khách hàng thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /customers/:id
 * Update customer info
 */
export async function updateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const input = updateCustomerSchema.parse(req.body);

    // Fetch old data
    const { data: oldData, error: fetchError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !oldData) throw ApiError.notFound('Khách hàng không tồn tại');

    const { data, error } = await supabaseAdmin
      .from('customers')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw ApiError.internal(error.message);

    await AuditService.log({
      actorId: user.id,
      action: 'update',
      entityType: 'customer',
      entityId: id,
      oldData,
      newData: data,
      ipAddress: req.ip,
    });

    sendSuccess(res, data, 'Cập nhật khách hàng thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /customers/:id
 * Soft delete a customer
 */
export async function deleteCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    const { data: oldData, error: fetchError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !oldData) throw ApiError.notFound('Khách hàng không tồn tại');

    // Soft delete
    const { error } = await supabaseAdmin
      .from('customers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw ApiError.internal(error.message);

    // Deactivate their profile if they have one
    if (oldData.profile_id) {
      await supabaseAdmin
        .from('profiles')
        .update({ is_active: false })
        .eq('id', oldData.profile_id);
    }

    await AuditService.log({
      actorId: user.id,
      action: 'delete',
      entityType: 'customer',
      entityId: id,
      oldData,
      ipAddress: req.ip,
    });

    sendSuccess(res, { id }, 'Xóa khách hàng thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * GET /customers/:id/stats
 * Get customer statistics: view history, financial summary
 */
export async function getCustomerStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    // Verify customer exists
    const { data: customer, error: custError } = await supabaseAdmin
      .from('customers')
      .select('id, customer_name')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (custError || !customer) throw ApiError.notFound('Khách hàng không tồn tại');

    // 1. View sessions (lịch sử xem báo giá)
    const { data: sessions } = await supabaseAdmin
      .from('view_sessions')
      .select('*, price_lists(id, title, status)')
      .eq('customer_id', id)
      .order('started_at', { ascending: false })
      .limit(50);

    // 2. Assigned price lists (báo giá được giao)
    const { data: assignments } = await supabaseAdmin
      .from('price_list_customers')
      .select('*, price_lists(id, title, status, created_at, updated_at)')
      .eq('customer_id', id)
      .order('assigned_at', { ascending: false });

    // 3. Orders (đơn hàng)
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('customer_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // 4. Payments (lịch sử thanh toán)
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('customer_id', id)
      .order('paid_at', { ascending: false });

    // 5. Activity summary (tóm tắt lượt xem)
    const { data: activityRow } = await supabaseAdmin
      .from('v_customer_activity')
      .select('total_sessions, last_viewed_at, total_duration_seconds')
      .eq('customer_id', id)
      .single();

    // 6. Financial summary (tổng hợp tài chính)
    const { data: financialRow } = await supabaseAdmin
      .from('v_customer_financials')
      .select('total_orders_amount, total_paid, total_debt')
      .eq('customer_id', id)
      .single();

    sendSuccess(res, {
      sessions: sessions ?? [],
      assigned_price_lists: assignments ?? [],
      orders: orders ?? [],
      payments: payments ?? [],
      activity: activityRow ?? { total_sessions: 0, last_viewed_at: null, total_duration_seconds: 0 },
      financials: financialRow ?? {
        total_orders_amount: 0,
        total_debt: 0,
        total_paid: 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /customers/:id/restore
 * Restore a soft-deleted customer
 */
export async function restoreCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('customers')
      .update({ deleted_at: null })
      .eq('id', id)
      .not('deleted_at', 'is', null)
      .select('*')
      .single();

    if (error || !data) throw ApiError.notFound('Khách hàng không tồn tại hoặc chưa bị xóa');

    // Re-activate profile
    if (data.profile_id) {
      await supabaseAdmin
        .from('profiles')
        .update({ is_active: true })
        .eq('id', data.profile_id);
    }

    await AuditService.log({
      actorId: user.id,
      action: 'restore',
      entityType: 'customer',
      entityId: id,
      newData: data,
      ipAddress: req.ip,
    });

    sendSuccess(res, data, 'Khôi phục khách hàng thành công');
  } catch (error) {
    next(error);
  }
}
