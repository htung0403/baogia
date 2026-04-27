import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError, sendSuccess, sendCreated } from '../utils/index.js';
import { AuthenticatedRequest } from '../types/api.js';
import {
  createCustomerGroupSchema,
  updateCustomerGroupSchema,
} from '../validators/index.js';

export async function listCustomerGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('customer_groups')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw ApiError.internal(error.message);

    sendSuccess(res, data ?? []);
  } catch (error) {
    next(error);
  }
}

export async function getCustomerGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('customer_groups')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw ApiError.notFound('Nhóm khách hàng không tồn tại');

    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function createCustomerGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createCustomerGroupSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('customer_groups')
      .insert({
        name: input.name,
        code: input.code ?? null,
        description: input.description ?? null,
        sort_order: input.sort_order ?? 0,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw ApiError.conflict('Mã nhóm đã được sử dụng');
      }
      throw ApiError.internal(error.message);
    }

    sendCreated(res, data, 'Tạo nhóm khách hàng thành công');
  } catch (error) {
    next(error);
  }
}

export async function updateCustomerGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const input = updateCustomerGroupSchema.parse(req.body);

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('customer_groups')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) throw ApiError.notFound('Nhóm khách hàng không tồn tại');

    const { data, error } = await supabaseAdmin
      .from('customer_groups')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw ApiError.conflict('Mã nhóm đã được sử dụng');
      }
      throw ApiError.internal(error.message);
    }

    sendSuccess(res, data, 'Cập nhật nhóm khách hàng thành công');
  } catch (error) {
    next(error);
  }
}

export async function deleteCustomerGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('customer_groups')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) throw ApiError.notFound('Nhóm khách hàng không tồn tại');

    const { error } = await supabaseAdmin
      .from('customer_groups')
      .delete()
      .eq('id', id);

    if (error) throw ApiError.internal(error.message);

    sendSuccess(res, { id }, 'Xóa nhóm khách hàng thành công');
  } catch (error) {
    next(error);
  }
}
