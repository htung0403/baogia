import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';

// Layouts
import AdminLayout from '@/components/layout/AdminLayout';
import PortalLayout from '@/components/layout/PortalLayout';
import ProtectedRoute from '@/components/shared/ProtectedRoute';

// Auth pages
import LoginPage from '@/pages/auth/LoginPage';

// Admin pages
import AdminDashboard from '@/pages/admin/DashboardPage';
import ProductsPage from '@/pages/admin/ProductsPage';
import PriceListsPage from '@/pages/admin/PriceListsPage';
import PriceListDetailPage from '@/pages/admin/PriceListDetailPage';
import CustomersPage from '@/pages/admin/CustomersPage';
import AnalyticsPage from '@/pages/admin/AnalyticsPage';

// Portal pages
import PortalDashboard from '@/pages/portal/PortalDashboard';
import PortalPriceListsPage from '@/pages/portal/PortalPriceListsPage';
import PortalPriceListView from '@/pages/portal/PortalPriceListView';
import PortalHistoryPage from '@/pages/portal/PortalHistoryPage';

// TanStack Query client with cache rules
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000, // 1 min default
    },
    mutations: {
      retry: 0,
    },
  },
});

function AppRoutes() {
  const { isAuthenticated, user, fetchMe } = useAuthStore();

  // Re-hydrate auth on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token && !user) {
      fetchMe();
    }
  }, [fetchMe, user]);

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={user?.profile.role === 'customer' ? '/portal' : '/admin'} replace />
          ) : (
            <LoginPage />
          )
        }
      />

      {/* Admin routes */}
      <Route element={<ProtectedRoute allowedRoles={['admin', 'staff']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/products" element={<ProductsPage />} />
          <Route path="/admin/price-lists" element={<PriceListsPage />} />
          <Route path="/admin/price-lists/:id" element={<PriceListDetailPage />} />
          <Route path="/admin/customers" element={<CustomersPage />} />
          <Route path="/admin/analytics" element={<AnalyticsPage />} />
        </Route>
      </Route>

      {/* Customer portal routes */}
      <Route element={<ProtectedRoute allowedRoles={['customer']} />}>
        <Route element={<PortalLayout />}>
          <Route path="/portal" element={<PortalDashboard />} />
          <Route path="/portal/price-lists" element={<PortalPriceListsPage />} />
          <Route path="/portal/price-lists/:id" element={<PortalPriceListView />} />
          <Route path="/portal/history" element={<PortalHistoryPage />} />
        </Route>
      </Route>

      {/* Root redirect */}
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to={user?.profile.role === 'customer' ? '/portal' : '/admin'} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* 404 */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-2">404</h1>
              <p className="text-muted-foreground mb-4">Trang không tồn tại</p>
              <a href="/" className="text-primary underline">Về trang chủ</a>
            </div>
          </div>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
