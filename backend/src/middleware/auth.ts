import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError } from '../utils/errors.js';
import { AuthenticatedRequest } from '../types/api.js';

/**
 * Authentication middleware
 * Verifies Supabase JWT token and attaches user + profile to request.
 * 
 * Flow:
 *   1. Extract Bearer token from Authorization header
 *   2. Verify token via Supabase Auth
 *   3. Fetch user profile (role, display_name, etc.)
 *   4. Attach to req.user
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    // Fetch profile with role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw ApiError.unauthorized('User profile not found. Contact admin.');
    }

    if (!profile.is_active) {
      throw ApiError.forbidden('Account is deactivated. Contact admin.');
    }

    // Attach to request
    (req as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email!,
      profile,
      accessToken: token,
    };

    next();
  } catch (error) {
    next(error);
  }
}
