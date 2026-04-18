import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors.js';
import { AuthenticatedRequest } from '../types/api.js';
import { Role } from '../types/database.js';

/**
 * Role-based access control middleware factory.
 * Must be used AFTER authenticate middleware.
 *
 * @param allowedRoles - Roles that can access this route
 * 
 * Usage:
 *   router.get('/admin-only', authenticate, requireRole('admin'), handler);
 *   router.get('/staff-area', authenticate, requireRole('admin', 'staff'), handler);
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(user.profile.role)) {
      return next(
        ApiError.forbidden(
          `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${user.profile.role}`
        )
      );
    }

    next();
  };
}

/**
 * Shorthand: require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Shorthand: require admin or staff role
 */
export const requireAdminOrStaff = requireRole('admin', 'staff');
