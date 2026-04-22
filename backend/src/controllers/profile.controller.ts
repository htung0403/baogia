import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError, sendSuccess } from '../utils/index.js';
import { updateProfileSchema } from '../validators/index.js';
import { AuthenticatedRequest } from '../types/api.js';

/**
 * GET /profiles
 * List active profiles filtered by role (for staff dropdowns)
 * Query: ?role=admin,staff (comma-separated)
 */
export async function listProfiles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rolesParam = req.query.role as string | undefined;
    const includeInactive = req.query.include_inactive === 'true';
    const search = req.query.search as string | undefined;
    const roles = rolesParam
      ? rolesParam.split(',').map(r => r.trim()).filter(Boolean)
      : ['admin', 'staff'];

    let query = supabaseAdmin
      .from('profiles')
      .select('id, display_name, role, avatar_url, is_active')
      .in('role', roles)
      .order('display_name');

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (search) {
      query = query.ilike('display_name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw ApiError.internal(error.message);

    sendSuccess(res, data ?? []);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /profiles/:id
 * Update employee profile (admin only)
 */
export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const input = updateProfileSchema.parse(req.body);

    if (Object.keys(input).length === 0) {
      throw ApiError.badRequest('Không có dữ liệu cập nhật');
    }

    if (id === actor.id && input.is_active === false) {
      throw ApiError.badRequest('Bạn không thể tự vô hiệu hóa tài khoản của chính mình');
    }

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, display_name, is_active')
      .eq('id', id)
      .single();

    if (existingErr || !existing) {
      throw ApiError.notFound('Nhân viên không tồn tại');
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(input)
      .eq('id', id)
      .select('id, display_name, role, avatar_url, is_active, created_at, updated_at')
      .single();

    if (error || !data) {
      throw ApiError.internal(error?.message || 'Không thể cập nhật nhân viên');
    }

    sendSuccess(res, data, 'Cập nhật nhân viên thành công');
  } catch (error) {
    next(error);
  }
}
