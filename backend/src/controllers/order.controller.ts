import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/order.service.js';
import { ApiError, sendSuccess, sendCreated, parsePagination } from '../utils/index.js';
import { createOrderSchema, updateOrderSchema } from '../validators/index.js';
import { AuthenticatedRequest } from '../types/api.js';
import { AuditService } from '../services/audit.service.js';

/**
 * POST /orders
 * Create a new draft order with items.
 */
export async function createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user  = (req as AuthenticatedRequest).user;
    const input = createOrderSchema.parse(req.body);

    const order = await OrderService.createOrder(input, user.id);

    await AuditService.log({
      actorId:    user.id,
      action:     'create',
      entityType: 'order',
      entityId:   order.id,
      newData:    order as unknown as Record<string, unknown>,
      ipAddress:  req.ip,
    });

    sendCreated(res, order, 'Tạo đơn hàng thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * GET /orders
 * List orders with optional filters.
 */
export async function listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { customer_id, status, date_from, date_to, search } = req.query as Record<string, string | undefined>;

    const result = await OrderService.listOrders({
      customer_id, status, date_from, date_to, search, page, limit,
    });

    sendSuccess(res, result.data, undefined, 200, result.meta);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /orders/:id
 * Get order details with items and payment summary.
 */
export async function getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const order  = await OrderService.getOrder(id);
    sendSuccess(res, order);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /orders/:id
 * Update a draft order (items + discount).
 */
export async function updateOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user  = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const input = updateOrderSchema.parse(req.body);

    const order = await OrderService.updateOrder(id, input);

    await AuditService.log({
      actorId:    user.id,
      action:     'update',
      entityType: 'order',
      entityId:   id,
      newData:    order as unknown as Record<string, unknown>,
      ipAddress:  req.ip,
    });

    sendSuccess(res, order, 'Cập nhật đơn hàng thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /orders/:id/confirm
 * Confirm an order (draft → confirmed).
 */
export async function confirmOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user  = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    await OrderService.confirmOrder(id, user.id);

    await AuditService.log({
      actorId:    user.id,
      action:     'confirm',
      entityType: 'order',
      entityId:   id,
      ipAddress:  req.ip,
    });

    sendSuccess(res, { id }, 'Xác nhận đơn hàng thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /orders/:id/cancel
 * Cancel an order. Rejects if completed payments exist.
 */
export async function cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user  = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    await OrderService.cancelOrder(id, user.id);

    await AuditService.log({
      actorId:    user.id,
      action:     'cancel',
      entityType: 'order',
      entityId:   id,
      ipAddress:  req.ip,
    });

    sendSuccess(res, { id }, 'Hủy đơn hàng thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /orders/:id
 * Soft-delete a draft or cancelled order (admin only).
 */
export async function deleteOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user  = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    if (user.profile.role !== 'admin') {
      throw ApiError.forbidden('Only admin can delete orders');
    }

    await OrderService.deleteOrder(id);

    await AuditService.log({
      actorId:    user.id,
      action:     'delete',
      entityType: 'order',
      entityId:   id,
      ipAddress:  req.ip,
    });

    sendSuccess(res, { id }, 'Xóa đơn hàng thành công');
  } catch (error) {
    next(error);
  }
}
