import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/types';

const API_BASE_URL = '/api';

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
    if (error.response?.status === 401 && !originalRequest._retry) {
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
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
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
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  getMe: () =>
    api.get('/auth/me'),

  logout: () =>
    api.post('/auth/logout'),

  register: (data: { email: string; password: string; display_name: string; role: string }) =>
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
