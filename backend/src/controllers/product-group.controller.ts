import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError, sendSuccess, sendCreated } from '../utils/index.js';
import { createProductGroupSchema, updateProductGroupSchema } from '../validators/index.js';

export async function listProductGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('product_groups')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw ApiError.internal(error.message);
    sendSuccess(res, data ?? []);
  } catch (error) {
    next(error);
  }
}

export async function getProductGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('product_groups')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw ApiError.notFound('Nhóm hàng không tồn tại');
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function createProductGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createProductGroupSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from('product_groups')
      .insert(input)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') throw ApiError.conflict('Slug đã được sử dụng');
      throw ApiError.internal(error.message);
    }
    sendCreated(res, data, 'Tạo nhóm hàng thành công');
  } catch (error) {
    next(error);
  }
}

export async function updateProductGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const input = updateProductGroupSchema.parse(req.body);

    const { data: existing } = await supabaseAdmin.from('product_groups').select('id').eq('id', id).single();
    if (!existing) throw ApiError.notFound('Nhóm hàng không tồn tại');

    const { data, error } = await supabaseAdmin
      .from('product_groups')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') throw ApiError.conflict('Slug đã được sử dụng');
      throw ApiError.internal(error.message);
    }
    sendSuccess(res, data, 'Cập nhật nhóm hàng thành công');
  } catch (error) {
    next(error);
  }
}

export async function deleteProductGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { data: existing } = await supabaseAdmin.from('product_groups').select('id').eq('id', id).single();
    if (!existing) throw ApiError.notFound('Nhóm hàng không tồn tại');

    const { error } = await supabaseAdmin.from('product_groups').delete().eq('id', id);
    if (error) throw ApiError.internal(error.message);

    sendSuccess(res, { id }, 'Xóa nhóm hàng thành công');
  } catch (error) {
    next(error);
  }
}
