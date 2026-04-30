import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { ToastProvider } from '@/components/ui/toast';

// Layouts
import AdminLayout from '@/components/layout/AdminLayout';
import PortalLayout from '@/components/layout/PortalLayout';
import ProtectedRoute from '@/components/shared/ProtectedRoute';

// Auth pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));

// Admin pages
const AdminDashboard = lazy(() => import('@/pages/admin/DashboardPage'));
const ProductsPage = lazy(() => import('@/pages/admin/ProductsPage'));
const PriceListsPage = lazy(() => import('@/pages/admin/PriceListsPage'));
const PriceListDetailPage = lazy(() => import('@/pages/admin/PriceListDetailPage'));
const CustomersPage = lazy(() => import('@/pages/admin/CustomersPage'));
const CustomerDetailPage = lazy(() => import('@/pages/admin/CustomerDetailPage'));
const AnalyticsPage = lazy(() => import('@/pages/admin/AnalyticsPage'));
const OrdersPage = lazy(() => import('@/pages/admin/OrdersPage'));
const PaymentsPage = lazy(() => import('@/pages/admin/PaymentsPage'));
const FinancialDashboardPage = lazy(() => import('@/pages/admin/FinancialDashboardPage'));
const EmployeesPage = lazy(() => import('@/pages/admin/EmployeesPage'));
const CustomerGroupsPage = lazy(() => import('@/pages/admin/CustomerGroupsPage'));
const CareSettingsPage = lazy(() => import('@/pages/admin/CareSettingsPage'));
const CareCalendarPage = lazy(() => import('@/pages/admin/CareCalendarPage'));

// Portal pages
const PortalDashboard = lazy(() => import('@/pages/portal/PortalDashboard'));
const PortalPriceListsPage = lazy(() => import('@/pages/portal/PortalPriceListsPage'));
const PortalPriceListView = lazy(() => import('@/pages/portal/PortalPriceListView'));
const PortalHistoryPage = lazy(() => import('@/pages/portal/PortalHistoryPage'));

// TanStack Query client with cache rules
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 min default
      gcTime: 10 * 60 * 1000, // 10 min
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
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
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
            <Route path="/admin/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/admin/analytics" element={<AnalyticsPage />} />
            <Route path="/admin/orders" element={<OrdersPage />} />
            <Route path="/admin/payments" element={<PaymentsPage />} />
            <Route path="/admin/financial" element={<FinancialDashboardPage />} />
            <Route path="/admin/employees" element={<EmployeesPage />} />
            <Route path="/admin/customer-groups" element={<CustomerGroupsPage />} />
            <Route path="/admin/care-settings" element={<CareSettingsPage />} />
            <Route path="/admin/care-calendar" element={<CareCalendarPage />} />
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
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
