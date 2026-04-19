import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError } from '../utils/errors.js';
import type { CustomerFinancial } from '../types/database.js';

// ============================================================
// FINANCIAL SERVICE
// ============================================================

export class FinancialService {
  /**
   * Get financial summary for a single customer.
   * Uses v_customer_financials (or materialized view for performance).
   */
  static async getCustomerSummary(customerId: string): Promise<CustomerFinancial> {
    // Prefer real-time view for customer-specific queries (fast with index)
    const { data, error } = await supabaseAdmin
      .from('v_customer_financials')
      .select('*')
      .eq('customer_id', customerId)
      .single();

    if (error) throw ApiError.internal(error.message);
    if (!data) {
      // Customer exists but has no financial activity — return zeroes
      return {
        customer_id:         customerId,
        total_orders_amount: 0,
        total_paid:          0,
        total_debt:          0,
        credit_balance:      0,
        last_payment_date:   null,
      };
    }

    return data as CustomerFinancial;
  }

  /**
   * Revenue analytics grouped by day or month.
   * Only counts confirmed orders.
   */
  static async getRevenueByPeriod(params: {
    period: 'daily' | 'monthly';
    date_from?: string;
    date_to?: string;
  }) {
    const trunc = params.period === 'monthly' ? 'month' : 'day';

    // Use raw query via RPC since Supabase JS doesn't support date_trunc natively
    // We'll query orders and group in JS for portability
    let query = supabaseAdmin
      .from('orders')
      .select('order_date, final_amount')
      .eq('status', 'confirmed')
      .is('deleted_at', null)
      .order('order_date', { ascending: true });

    if (params.date_from) query = query.gte('order_date', params.date_from);
    if (params.date_to)   query = query.lte('order_date', params.date_to);

    const { data, error } = await query;
    if (error) throw ApiError.internal(error.message);

    // Group by period in application layer
    const buckets = new Map<string, { revenue: number; order_count: number }>();

    for (const row of data ?? []) {
      const d = new Date(row.order_date);
      const key = trunc === 'month'
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : d.toISOString().slice(0, 10);

      const current = buckets.get(key) ?? { revenue: 0, order_count: 0 };
      buckets.set(key, {
        revenue:     current.revenue + Number(row.final_amount),
        order_count: current.order_count + 1,
      });
    }

    return Array.from(buckets.entries()).map(([period, v]) => ({
      period,
      revenue:     v.revenue,
      order_count: v.order_count,
    }));
  }

  /**
   * Top customers ranked by total confirmed revenue.
   */
  static async getTopCustomersByRevenue(limit = 10) {
    const { data, error } = await supabaseAdmin
      .from('v_customer_financials')
      .select(`
        customer_id,
        total_orders_amount,
        total_paid,
        total_debt,
        customers:customer_id (customer_name, phone_number)
      `)
      .order('total_orders_amount', { ascending: false })
      .limit(limit);

    if (error) throw ApiError.internal(error.message);
    return data ?? [];
  }

  /**
   * Customers with highest outstanding debt.
   */
  static async getTopCustomersByDebt(limit = 10) {
    const { data, error } = await supabaseAdmin
      .from('v_customer_financials')
      .select(`
        customer_id,
        total_orders_amount,
        total_paid,
        total_debt,
        last_payment_date,
        customers:customer_id (customer_name, phone_number)
      `)
      .gt('total_debt', 0)
      .order('total_debt', { ascending: false })
      .limit(limit);

    if (error) throw ApiError.internal(error.message);
    return data ?? [];
  }

  /**
   * Overall financial KPIs for the dashboard.
   */
  static async getOverallKPIs() {
    const { data, error } = await supabaseAdmin
      .from('v_customer_financials')
      .select('total_orders_amount, total_paid, total_debt, credit_balance');

    if (error) throw ApiError.internal(error.message);

    const rows = data ?? [];
    return {
      total_revenue:      rows.reduce((s, r) => s + Number(r.total_orders_amount), 0),
      total_collected:    rows.reduce((s, r) => s + Number(r.total_paid), 0),
      total_outstanding:  rows.reduce((s, r) => s + Math.max(0, Number(r.total_debt)), 0),
      total_credits:      rows.reduce((s, r) => s + Number(r.credit_balance), 0),
      customers_in_debt:  rows.filter(r => Number(r.total_debt) > 0).length,
    };
  }
}
