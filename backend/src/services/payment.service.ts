import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError } from '../utils/errors.js';
import type { Payment } from '../types/database.js';
import type { CreatePaymentInput } from '../validators/index.js';

// ============================================================
// CODE GENERATOR
// ============================================================

async function generatePaymentCode(): Promise<string> {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `TT-${datePart}-`;

  const { count } = await supabaseAdmin
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .like('code', `${prefix}%`);

  const seq = String((count ?? 0) + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

// ============================================================
// PAYMENT SERVICE
// ============================================================

export class PaymentService {
  /**
   * Record a payment.
   * Uses fn_record_payment RPC:
   *   - SELECT FOR UPDATE on customer_credits prevents race conditions
   *   - Validates order status if order_id provided
   *   - Auto-updates customer credit balance for overpayments
   */
  static async recordPayment(input: CreatePaymentInput, userId: string): Promise<Payment> {
    const code = await generatePaymentCode();

    const { data: paymentId, error } = await supabaseAdmin.rpc('fn_record_payment', {
      p_customer_id:    input.customer_id,
      p_order_id:       input.order_id ?? null,
      p_code:           code,
      p_amount:         input.amount,
      p_payment_method: input.payment_method,
      p_notes:          input.notes ?? null,
      p_created_by:     userId,
    });

    if (error) throw ApiError.badRequest(error.message);

    // Optionally refresh the materialized view (fire-and-forget)
    supabaseAdmin.rpc('fn_refresh_financials').then(({ error: rErr }) => {
      if (rErr) console.warn('[FINANCIAL] Could not refresh mv_customer_financials:', rErr.message);
    });

    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) throw ApiError.internal('Payment created but could not be fetched');
    return payment as Payment;
  }

  /**
   * List payments with filters + pagination.
   */
  static async listPayments(params: {
    customer_id?: string;
    order_id?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }) {
    const page   = Math.max(1, params.page  ?? 1);
    const limit  = Math.min(100, params.limit ?? 20);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('payments')
      .select(`
        *,
        customers:customer_id (customer_name, phone_number),
        orders:order_id (code, status)
      `, { count: 'exact' });

    if (params.customer_id) query = query.eq('customer_id', params.customer_id);
    if (params.order_id)    query = query.eq('order_id', params.order_id);
    if (params.status)      query = query.eq('status', params.status);
    if (params.date_from)   query = query.gte('paid_at', params.date_from);
    if (params.date_to)     query = query.lte('paid_at', params.date_to);

    query = query.order('paid_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw ApiError.internal(error.message);

    return {
      data: data ?? [],
      meta: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    };
  }

  /**
   * Get all payments for a specific customer.
   */
  static async getCustomerPayments(customerId: string): Promise<Payment[]> {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select(`*, orders:order_id (code, status, final_amount)`)
      .eq('customer_id', customerId)
      .order('paid_at', { ascending: false });

    if (error) throw ApiError.internal(error.message);
    return (data ?? []) as unknown as Payment[];
  }
}
