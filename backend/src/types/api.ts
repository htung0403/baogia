import { Request } from 'express';
import { Profile } from './database.js';

/**
 * Authenticated request - has user info attached by auth middleware
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    profile: Profile;
    accessToken: string;
  };
}

/**
 * Standard API response format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * Pagination query params
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}
