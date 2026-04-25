import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError, sendSuccess, sendCreated, parsePagination } from '../utils/index.js';
import { createCustomerCostSchema, updateCustomerCostSchema } from '../validators/index.js';
import { AuthenticatedRequest } from '../types/api.js';

export async function listCustomerCosts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customerId = req.params.customerId || (req.query.customer_id as string);
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);

    let query = supabaseAdmin
      .from('customer_costs')
      .select('*, profiles:created_by(display_name)', { count: 'exact' })
      .is('deleted_at', null)
      .order('cost_date', { ascending: false });

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const costType = req.query.cost_type as string | undefined;
    if (costType) {
      query = query.eq('cost_type', costType);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw ApiError.internal(error.message);

    sendSuccess(res, data ?? [], undefined, 200, {
      page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function createCustomerCost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const input = createCustomerCostSchema.parse(req.body);

    const { data: customer, error: custErr } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('id', input.customer_id)
      .is('deleted_at', null)
      .single();
    if (custErr || !customer) throw ApiError.notFound('Khách hàng không tồn tại');

    const { data, error } = await supabaseAdmin
      .from('customer_costs')
      .insert({
        customer_id: input.customer_id,
        amount: input.amount,
        description: input.description,
        cost_type: input.cost_type ?? 'other',
        cost_date: input.cost_date ?? new Date().toISOString().split('T')[0],
        notes: input.notes ?? null,
        created_by: user.id,
      })
      .select('*, profiles:created_by(display_name)')
      .single();

    if (error) throw ApiError.internal(error.message);

    sendCreated(res, data, 'Thêm chi phí thành công');
  } catch (error) {
    next(error);
  }
}

export async function updateCustomerCost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const input = updateCustomerCostSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('customer_costs')
      .update(input)
      .eq('id', id)
      .is('deleted_at', null)
      .select('*, profiles:created_by(display_name)')
      .single();

    if (error || !data) throw ApiError.notFound('Chi phí không tồn tại');

    sendSuccess(res, data, 'Cập nhật chi phí thành công');
  } catch (error) {
    next(error);
  }
}

export async function deleteCustomerCost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('customer_costs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) throw ApiError.internal(error.message);

    sendSuccess(res, { id }, 'Xóa chi phí thành công');
  } catch (error) {
    next(error);
  }
}

export async function getCustomerCostSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { customerId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('customer_costs')
      .select('amount, cost_type')
      .eq('customer_id', customerId)
      .is('deleted_at', null);

    if (error) throw ApiError.internal(error.message);

    const rows = data ?? [];
    const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
    const byType: Record<string, number> = {};
    for (const r of rows) {
      const t = r.cost_type as string;
      byType[t] = (byType[t] ?? 0) + Number(r.amount);
    }

    sendSuccess(res, {
      total_cost: total,
      count: rows.length,
      by_type: Object.entries(byType).map(([type, amount]) => ({ type, amount })),
    });
  } catch (error) {
    next(error);
  }
}
