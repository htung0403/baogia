import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError, sendSuccess, sendCreated } from '../utils/index.js';
import { createBrandSchema, updateBrandSchema } from '../validators/index.js';

export async function listBrands(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('brands')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw ApiError.internal(error.message);
    sendSuccess(res, data ?? []);
  } catch (error) {
    next(error);
  }
}

export async function getBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('brands')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw ApiError.notFound('Thương hiệu không tồn tại');
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function createBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createBrandSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from('brands')
      .insert(input)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') throw ApiError.conflict('Slug đã được sử dụng');
      throw ApiError.internal(error.message);
    }
    sendCreated(res, data, 'Tạo thương hiệu thành công');
  } catch (error) {
    next(error);
  }
}

export async function updateBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const input = updateBrandSchema.parse(req.body);

    const { data: existing } = await supabaseAdmin.from('brands').select('id').eq('id', id).single();
    if (!existing) throw ApiError.notFound('Thương hiệu không tồn tại');

    const { data, error } = await supabaseAdmin
      .from('brands')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') throw ApiError.conflict('Slug đã được sử dụng');
      throw ApiError.internal(error.message);
    }
    sendSuccess(res, data, 'Cập nhật thương hiệu thành công');
  } catch (error) {
    next(error);
  }
}

export async function deleteBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { data: existing } = await supabaseAdmin.from('brands').select('id').eq('id', id).single();
    if (!existing) throw ApiError.notFound('Thương hiệu không tồn tại');

    const { error } = await supabaseAdmin.from('brands').delete().eq('id', id);
    if (error) throw ApiError.internal(error.message);

    sendSuccess(res, { id }, 'Xóa thương hiệu thành công');
  } catch (error) {
    next(error);
  }
}
