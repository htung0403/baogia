import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError } from '../utils/errors.js';
import type { Order, OrderWithDetails, OrderPaymentSummary } from '../types/database.js';
import type { CreateOrderInput, UpdateOrderInput } from '../validators/index.js';

// ============================================================
// CODE GENERATOR
// ============================================================

/**
 * Generate a unique human-readable order code: DH-YYYYMMDD-NNN
 */
async function generateOrderCode(): Promise<string> {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `DH-${datePart}-`;

  // Count today's orders to get the sequence number
  const { count } = await supabaseAdmin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .like('code', `${prefix}%`);

  const seq = String((count ?? 0) + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

// ============================================================
// ORDER SERVICE
// ============================================================

export class OrderService {
  /**
   * Create a new draft order with items.
   * Uses fn_create_order RPC for atomicity (order + items in one transaction).
   */
  static async createOrder(input: CreateOrderInput, userId: string): Promise<Order> {
    const code = await generateOrderCode();
    const orderDate = input.order_date ?? new Date().toISOString();

    const { data: orderId, error } = await supabaseAdmin.rpc('fn_create_order', {
      p_customer_id:     input.customer_id,
      p_created_by:      userId,
      p_code:            code,
      p_order_date:      orderDate,
      p_discount_amount: input.discount_amount ?? 0,
      p_notes:           input.notes ?? null,
      p_items:           input.items,
    });

    if (error) {
      // Surface plpgsql RAISE EXCEPTION messages to the client
      throw ApiError.badRequest(error.message);
    }

    // Fetch the created order
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) throw ApiError.internal('Order created but could not be fetched');
    return order as Order;
  }

  /**
   * Get a single order with items and payment summary.
   */
  static async getOrder(id: string): Promise<OrderWithDetails> {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        customers:customer_id (customer_name, phone_number),
        created_by_profile:created_by (display_name)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !order) throw ApiError.notFound('Đơn hàng không tồn tại');

    // Fetch items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: true });

    if (itemsError) throw ApiError.internal(itemsError.message);

    // Fetch payment summary from view
    const { data: pSummary } = await supabaseAdmin
      .from('v_order_payment_summary')
      .select('*')
      .eq('order_id', id)
      .single();

    const payment_summary: OrderPaymentSummary = pSummary ?? {
      order_id:       id,
      order_status:   order.status,
      final_amount:   order.final_amount,
      total_paid:     0,
      remaining:      order.final_amount,
      payment_status: order.status === 'draft' ? 'not_applicable' : 'unpaid',
    };

    return {
      ...order,
      items: items ?? [],
      payment_summary,
      customer: (order as any).customers,
      created_by_profile: (order as any).created_by_profile,
    } as OrderWithDetails;
  }

  /**
   * List orders with filters + pagination.
   */
  static async listOrders(params: {
    customer_id?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.min(100, params.limit ?? 20);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('orders')
      .select(`
        *,
        customers:customer_id (customer_name, phone_number)
      `, { count: 'exact' })
      .is('deleted_at', null);

    if (params.customer_id) query = query.eq('customer_id', params.customer_id);
    if (params.status)      query = query.eq('status', params.status);
    if (params.date_from)   query = query.gte('order_date', params.date_from);
    if (params.date_to)     query = query.lte('order_date', params.date_to);
    if (params.search) {
      query = query.ilike('code', `%${params.search}%`);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: orders, error, count } = await query;
    if (error) throw ApiError.internal(error.message);
    if (!orders || orders.length === 0) {
      return {
        data: [],
        meta: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
      };
    }

    // 2. Fetch payment summaries for these orders
    const orderIds = orders.map(o => o.id);
    const { data: summaries, error: summaryError } = await supabaseAdmin
      .from('v_order_payment_summary')
      .select('order_id, payment_status, total_paid, remaining')
      .in('order_id', orderIds);

    if (summaryError) throw ApiError.internal(summaryError.message);

    // 3. Merge data
    const summaryMap = new Map(summaries?.map(s => [s.order_id, s]));
    const mergedData = orders.map(order => ({
      ...order,
      v_order_payment_summary: [summaryMap.get(order.id)].filter(Boolean)
    }));

    return {
      data: mergedData,
      meta: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    };
  }

  /**
   * Update a draft order. Atomically replaces all items via RPC.
   */
  static async updateOrder(id: string, input: UpdateOrderInput): Promise<Order> {
    const { error } = await supabaseAdmin.rpc('fn_update_order', {
      p_order_id:        id,
      p_discount_amount: input.discount_amount ?? 0,
      p_notes:           input.notes ?? null,
      p_items:           input.items,
    });

    if (error) throw ApiError.badRequest(error.message);

    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !order) throw ApiError.internal('Could not fetch updated order');
    return order as Order;
  }

  /**
   * Confirm an order (draft → confirmed). Uses fn_confirm_order RPC with row lock.
   */
  static async confirmOrder(id: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin.rpc('fn_confirm_order', {
      p_order_id: id,
      p_user_id:  userId,
    });

    if (error) throw ApiError.badRequest(error.message);
  }

  /**
   * Cancel an order. Uses fn_cancel_order RPC — rejects if payments exist.
   */
  static async cancelOrder(id: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin.rpc('fn_cancel_order', {
      p_order_id: id,
      p_user_id:  userId,
    });

    if (error) throw ApiError.badRequest(error.message);
  }

  /**
   * Soft-delete an order (admin only, draft/cancelled orders only).
   */
  static async deleteOrder(id: string): Promise<void> {
    // Verify it's not confirmed before deleting
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('status')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!order) throw ApiError.notFound('Đơn hàng không tồn tại');
    if (order.status === 'confirmed') {
      throw ApiError.badRequest('Cannot delete a confirmed order. Cancel it first.');
    }

    const { error } = await supabaseAdmin
      .from('orders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw ApiError.internal(error.message);
  }
}
