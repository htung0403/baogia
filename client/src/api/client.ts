import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

/**
 * Axios instance with auth interceptor
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor: attach JWT token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 + refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 and not already retrying, try refresh
    // EXCLUDE login endpoint from redirect logic
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login')) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          if (data.success && data.data) {
            localStorage.setItem('access_token', data.data.access_token);
            localStorage.setItem('refresh_token', data.data.refresh_token);

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${data.data.access_token}`;
            }
            return api(originalRequest);
          }
        } catch {
          // Refresh failed, clear tokens
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('auth-storage');
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('auth-storage');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ============================================================
// API FUNCTIONS
// ============================================================

// --- Auth ---
export const authApi = {
  login: (phone_number: string, password: string) =>
    api.post('/auth/login', { phone_number, password }),

  getMe: () =>
    api.get('/auth/me'),

  logout: () =>
    api.post('/auth/logout'),

  register: (data: { phone_number: string; password: string; display_name: string; role: string }) =>
    api.post('/auth/register', data),
};

// --- Products ---
export const productApi = {
  list: (params?: Record<string, string | number | boolean>) =>
    api.get('/products', { params }),

  get: (id: string) =>
    api.get(`/products/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post('/products', data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/products/${id}`, data),

  delete: (id: string) =>
    api.delete(`/products/${id}`),

  restore: (id: string) =>
    api.post(`/products/${id}/restore`),
};

// --- Customers ---
export const customerApi = {
  list: (params?: Record<string, string | number | boolean>) =>
    api.get('/customers', { params }),

  get: (id: string) =>
    api.get(`/customers/${id}`),

  getStats: (id: string) =>
    api.get(`/customers/${id}/stats`),

  create: (data: Record<string, unknown>) =>
    api.post('/customers', data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/customers/${id}`, data),

  delete: (id: string) =>
    api.delete(`/customers/${id}`),

  restore: (id: string) =>
    api.post(`/customers/${id}/restore`),
};

// --- Price Lists ---
export const priceListApi = {
  list: (params?: Record<string, string | number | boolean>) =>
    api.get('/price-lists', { params }),

  get: (id: string) =>
    api.get(`/price-lists/${id}`),

  create: (data: { title: string; description?: string; customer_ids?: string[] }) =>
    api.post('/price-lists', data),

  update: (id: string, data: { title?: string; description?: string }) =>
    api.put(`/price-lists/${id}`, data),

  delete: (id: string) =>
    api.delete(`/price-lists/${id}`),

  // Versions
  createVersion: (priceListId: string, data: {
    changelog?: string;
    items: Array<{
      product_id: string;
      dealer_price?: number | null;
      retail_price?: number | null;
      public_price?: number | null;
      note?: string;
      sort_order?: number;
    }>;
  }) =>
    api.post(`/price-lists/${priceListId}/versions`, data),

  getVersion: (priceListId: string, versionId: string) =>
    api.get(`/price-lists/${priceListId}/versions/${versionId}`),

  publishVersion: (priceListId: string, versionId: string) =>
    api.post(`/price-lists/${priceListId}/versions/${versionId}/publish`),

  // Customer assignment
  assignCustomers: (priceListId: string, customerIds: string[]) =>
    api.post(`/price-lists/${priceListId}/customers`, { customer_ids: customerIds }),

  unassignCustomer: (priceListId: string, customerId: string) =>
    api.delete(`/price-lists/${priceListId}/customers/${customerId}`),
};

// --- Tracking ---
export const trackingApi = {
  startSession: (data: { price_list_id: string; version_id?: string; device?: string }) =>
    api.post('/tracking/sessions', data),

  endSession: (sessionId: string) =>
    api.put(`/tracking/sessions/${sessionId}/end`),

  trackItemView: (sessionId: string, data: { product_id: string; view_duration_seconds?: number }) =>
    api.post(`/tracking/sessions/${sessionId}/items`, data),

  // Analytics
  getOverview: () =>
    api.get('/tracking/analytics/overview'),

  getCustomerActivity: (params?: Record<string, string | number>) =>
    api.get('/tracking/analytics/customers', { params }),

  getCustomerViewHistory: (customerId: string, params?: Record<string, string | number>) =>
    api.get(`/tracking/analytics/customers/${customerId}`, { params }),

  getMyViewHistory: (params?: Record<string, string | number>) =>
    api.get('/tracking/analytics/me', { params }), // Thử nghiệm endpoint dành riêng cho User hiện tại

  getPriceListViewStats: (priceListId: string) =>
    api.get(`/tracking/analytics/price-lists/${priceListId}`),
};

// --- Upload ---
export const uploadApi = {
  image: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// --- Orders ---
export const orderApi = {
  list: (params?: Record<string, string | number | boolean>) =>
    api.get('/orders', { params }),

  get: (id: string) =>
    api.get(`/orders/${id}`),

  create: (data: {
    customer_id: string;
    order_date?: string;
    discount_amount?: number;
    notes?: string | null;
    items: Array<{
      product_id: string;
      product_name: string;
      product_price_snapshot: number;
      quantity: number;
      unit_price: number;
      notes?: string | null;
    }>;
  }) => api.post('/orders', data),

  update: (id: string, data: {
    discount_amount?: number;
    notes?: string | null;
    items: Array<{
      product_id: string;
      product_name: string;
      product_price_snapshot: number;
      quantity: number;
      unit_price: number;
      notes?: string | null;
    }>;
  }) => api.put(`/orders/${id}`, data),

  confirm: (id: string) =>
    api.post(`/orders/${id}/confirm`),

  cancel: (id: string) =>
    api.post(`/orders/${id}/cancel`),

  delete: (id: string) =>
    api.delete(`/orders/${id}`),
};

// --- Payments ---
export const paymentApi = {
  list: (params?: Record<string, string | number | boolean>) =>
    api.get('/payments', { params }),

  record: (data: {
    customer_id: string;
    order_id?: string | null;
    amount: number;
    payment_method: 'cash' | 'transfer' | 'card' | 'momo';
    notes?: string | null;
  }) => api.post('/payments', data),

  getByCustomer: (customerId: string) =>
    api.get(`/customers/${customerId}/payments`),
};

// --- Financial Analytics ---
export const financialApi = {
  getCustomerSummary: (customerId: string) =>
    api.get(`/customers/${customerId}/financial-summary`),

  getRevenue: (params?: { period?: 'daily' | 'monthly'; date_from?: string; date_to?: string }) =>
    api.get('/analytics/revenue', { params }),

  getTopCustomers: (params?: { by?: 'revenue' | 'debt'; limit?: number }) =>
    api.get('/analytics/top-customers', { params }),

  getKPIs: () =>
    api.get('/analytics/kpis'),
};

// --- Profiles (staff dropdowns) ---
export const profilesApi = {
  list: (params?: { role?: string; include_inactive?: boolean; search?: string }) =>
    api.get('/profiles', { params }),

  update: (id: string, data: { display_name?: string; role?: 'admin' | 'staff' | 'customer'; is_active?: boolean }) =>
    api.put(`/profiles/${id}`, data),
};

// --- Pipeline ---
export const pipelineApi = {
  // Tab 2 — Board
  getBoard: () =>
    api.get('/pipeline/board'),

  assignStage: (customerId: string, stageId: string, note: string) =>
    api.post(`/pipeline/customers/${customerId}/stage`, { stage_id: stageId, note }),

  // Tab 3 — Funnel
  getFunnel: (params?: {
    assigned_to?: string;
    period?: 'this_month' | 'last_month' | 'all';
    all_kh?: boolean;
  }) =>
    api.get('/pipeline/funnel', { params }),

  // Activities
  listActivities: (customerId: string, type?: string) =>
    api.get(`/pipeline/activities/${customerId}`, { params: type ? { type } : undefined }),

  listAppointments: (customerId: string) =>
    api.get(`/pipeline/activities/${customerId}`, { params: { type: 'meeting' } }),

  createActivity: (data: {
    customer_id: string; activity_type: string; title: string;
    description?: string | null; assigned_to?: string | null; related_project?: string | null;
  }) =>
    api.post('/pipeline/activities', data),

  createAppointment: (data: {
    customer_id: string;
    title: string;
    description?: string | null;
    scheduled_at: string;
    status?: 'pending' | 'done' | 'cancelled';
    assigned_to?: string | null;
  }) =>
    api.post('/pipeline/activities', {
      ...data,
      activity_type: 'meeting',
    }),

  updateAppointmentStatus: (activityId: string, status: 'pending' | 'done' | 'cancelled') =>
    api.patch(`/pipeline/activities/${activityId}/status`, { status }),

  // Quotes
  listQuotes: (params?: { customer_id?: string }) =>
    api.get('/pipeline/quotes', { params }),

  createQuote: (data: {
    customer_id: string; title?: string | null; amount?: number; notes?: string | null;
  }) =>
    api.post('/pipeline/quotes', data),

  // Contracts
  listContracts: (params?: { customer_id?: string }) =>
    api.get('/pipeline/contracts', { params }),

  createContract: (data: {
    customer_id: string; title?: string | null; amount?: number;
    start_date?: string | null; end_date?: string | null; notes?: string | null;
  }) =>
    api.post('/pipeline/contracts', data),

  // Settings
  createColumn: (data: { name: string; color?: string | null; sort_order?: number }) =>
    api.post('/pipeline/columns', data),

  updateColumn: (id: string, data: { name?: string; color?: string | null; sort_order?: number }) =>
    api.put(`/pipeline/columns/${id}`, data),

  deleteColumn: (id: string) =>
    api.delete(`/pipeline/columns/${id}`),

  createStage: (data: { column_id: string; name: string; description?: string | null; color?: string | null; sort_order?: number }) =>
    api.post('/pipeline/stages', data),

  updateStage: (id: string, data: { name?: string; description?: string | null; color?: string | null; sort_order?: number }) =>
    api.put(`/pipeline/stages/${id}`, data),

  deleteStage: (id: string) =>
    api.delete(`/pipeline/stages/${id}`),
};

