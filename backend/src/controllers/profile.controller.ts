import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError, sendSuccess } from '../utils/index.js';

/**
 * GET /profiles
 * List active profiles filtered by role (for staff dropdowns)
 * Query: ?role=admin,staff (comma-separated)
 */
export async function listProfiles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rolesParam = req.query.role as string | undefined;
    const roles = rolesParam
      ? rolesParam.split(',').map(r => r.trim()).filter(Boolean)
      : ['admin', 'staff'];

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, role, avatar_url, is_active')
      .eq('is_active', true)
      .in('role', roles)
      .order('display_name');

    if (error) throw ApiError.internal(error.message);

    sendSuccess(res, data ?? []);
  } catch (error) {
    next(error);
  }
}
