import { Request, Response, NextFunction } from 'express';
import { FinancialService } from '../services/financial.service.js';
import { ApiError, sendSuccess } from '../utils/index.js';

/**
 * GET /customers/:id/financial-summary
 * Full financial position for a single customer.
 */
export async function getCustomerFinancialSummary(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const summary = await FinancialService.getCustomerSummary(id);
    sendSuccess(res, summary);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /analytics/revenue
 * Revenue grouped by day or month.
 * Query params:
 *   period   = 'daily' | 'monthly'  (default: monthly)
 *   date_from = ISO date string
 *   date_to   = ISO date string
 */
export async function getRevenueAnalytics(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const { period = 'monthly', date_from, date_to } = req.query as Record<string, string>;

    if (period !== 'daily' && period !== 'monthly') {
      throw ApiError.badRequest("period must be 'daily' or 'monthly'");
    }

    const data = await FinancialService.getRevenueByPeriod({ period, date_from, date_to });
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /analytics/top-customers
 * Top customers by revenue or debt.
 * Query params:
 *   by    = 'revenue' | 'debt'  (default: revenue)
 *   limit = number               (default: 10, max: 50)
 */
export async function getTopCustomers(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const { by = 'revenue' } = req.query as Record<string, string>;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    let data;
    if (by === 'debt') {
      data = await FinancialService.getTopCustomersByDebt(limit);
    } else {
      data = await FinancialService.getTopCustomersByRevenue(limit);
    }

    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /analytics/kpis
 * Overall financial KPIs for the admin dashboard.
 */
export async function getFinancialKPIs(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const kpis = await FinancialService.getOverallKPIs();
    sendSuccess(res, kpis);
  } catch (error) {
    next(error);
  }
}
