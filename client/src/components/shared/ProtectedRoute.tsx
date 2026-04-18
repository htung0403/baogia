import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import type { Role } from '@/types';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
}

/**
 * Route protection component
 * - Redirects to /login if not authenticated
 * - Redirects to appropriate dashboard if role not allowed
 */
export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.profile.role)) {
    // Redirect to correct dashboard
    if (user.profile.role === 'customer') {
      return <Navigate to="/portal" replace />;
    }
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}
