import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';

/**
 * Global error handler middleware.
 * Must be registered LAST in the middleware chain.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Already sent response
  if (res.headersSent) {
    return;
  }

  // Known operational error
  if (err instanceof ApiError) {
    sendError(res, err.statusCode, err.message);
    return;
  }

  // Zod validation error
  if (err.name === 'ZodError') {
    const zodErr = err as unknown as { errors: Array<{ path: string[]; message: string }> };
    const messages = zodErr.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    sendError(res, 400, `Validation error: ${messages}`);
    return;
  }

  // Unknown error
  console.error('[ERROR]', err);
  sendError(
    res,
    500,
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error'
  );
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}
