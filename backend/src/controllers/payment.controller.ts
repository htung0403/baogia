import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service.js';
import { sendSuccess, sendCreated, parsePagination } from '../utils/index.js';
import { createPaymentSchema } from '../validators/index.js';
import { AuthenticatedRequest } from '../types/api.js';
import { AuditService } from '../services/audit.service.js';

/**
 * POST /payments
 * Record a payment (full or partial, order-specific or general).
 */
export async function recordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user  = (req as AuthenticatedRequest).user;
    const input = createPaymentSchema.parse(req.body);

    const payment = await PaymentService.recordPayment(input, user.id);

    await AuditService.log({
      actorId:    user.id,
      action:     'create',
      entityType: 'payment',
      entityId:   payment.id,
      newData:    payment as unknown as Record<string, unknown>,
      ipAddress:  req.ip,
    });

    sendCreated(res, payment, 'Ghi nhận thanh toán thành công');
  } catch (error) {
    next(error);
  }
}

/**
 * GET /payments
 * List payments with optional filters.
 */
export async function listPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { customer_id, order_id, status, date_from, date_to } =
      req.query as Record<string, string | undefined>;

    const result = await PaymentService.listPayments({
      customer_id, order_id, status, date_from, date_to, page, limit,
    });

    sendSuccess(res, result.data, undefined, 200, result.meta);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /customers/:id/payments
 * Get all payments for a specific customer.
 */
export async function getCustomerPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const payments = await PaymentService.getCustomerPayments(id);
    sendSuccess(res, payments);
  } catch (error) {
    next(error);
  }
}
