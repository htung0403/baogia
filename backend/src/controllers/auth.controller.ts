import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { loginSchema, registerSchema } from '../validators/index.js';
import { AuthenticatedRequest } from '../types/api.js';

/**
 * POST /auth/login
 * Login with email/password via Supabase Auth
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw ApiError.unauthorized('Email hoặc mật khẩu không đúng');
    }

    // Fetch profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      throw ApiError.internal('Profile not found after login');
    }

    if (!profile.is_active) {
      throw ApiError.forbidden('Tài khoản đã bị vô hiệu hóa');
    }

    sendSuccess(res, {
      user: {
        id: data.user.id,
        email: data.user.email,
        profile,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    }, 'Đăng nhập thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/register
 * Register a new user (admin only in production)
 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, display_name, role } = registerSchema.parse(req.body);

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name,
        role,
      },
    });

    if (error) {
      if (error.message.includes('already')) {
        throw ApiError.conflict('Email đã được sử dụng');
      }
      throw ApiError.badRequest(error.message);
    }

    // Profile is auto-created by the database trigger (handle_new_user)
    // Fetch it to confirm
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    sendSuccess(res, {
      user: {
        id: data.user.id,
        email: data.user.email,
        profile,
      },
    }, 'Đăng ký thành công', 201);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /auth/me
 * Get current user profile
 */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;

    // Also fetch customer record if role is customer
    let customer = null;
    if (user.profile.role === 'customer') {
      const { data } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('profile_id', user.id)
        .is('deleted_at', null)
        .single();
      customer = data;
    }

    sendSuccess(res, {
      id: user.id,
      email: user.email,
      profile: user.profile,
      customer,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/refresh
 * Refresh access token
 */
export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      throw ApiError.badRequest('refresh_token is required');
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    sendSuccess(res, {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/logout
 * Logout (invalidate session server-side)
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;

    await supabaseAdmin.auth.admin.signOut(user.id);

    sendSuccess(res, null, 'Đăng xuất thành công');
  } catch (error) {
    next(error);
  }
}
