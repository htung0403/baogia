import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError, sendSuccess, sendCreated, parsePagination } from '../utils/index.js';
import { startSessionSchema, trackItemViewSchema } from '../validators/index.js';
import { AuthenticatedRequest } from '../types/api.js';

// ============================================================
// SESSION TRACKING
// ============================================================

/**
 * POST /tracking/sessions
 * Start a new view session when customer opens a price list
 */
export async function startSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const input = startSessionSchema.parse(req.body);

    // 1. Get customer record
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('profile_id', user.id)
      .is('deleted_at', null)
      .maybeSingle(); // Dùng maybeSingle để tránh lỗi nếu không tìm thấy

    // Nếu là Admin/Staff thì có thể không có hồ sơ khách hàng, ta vẫn cho phép ghi log nếu muốn
    // hoặc bypass nếu không có customer_id
    const customerId = customer?.id;

    // 2. Verify assignment (Chỉ check nếu là khách hàng)
    if (user.profile.role === 'customer') {
      if (!customerId) {
        throw ApiError.forbidden('Không tìm thấy hồ sơ khách hàng');
      }

      // Kiểm tra định dạng UUID để tránh lỗi DB
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.price_list_id);
      if (!isUuid) {
        throw ApiError.badRequest('ID bảng giá không hợp lệ');
      }

      const { data: assignment } = await supabaseAdmin
        .from('price_list_customers')
        .select('id')
        .eq('price_list_id', input.price_list_id)
        .eq('customer_id', customerId)
        .maybeSingle();

      if (!assignment) {
        throw ApiError.forbidden('Bạn không có quyền xem bảng giá này');
      }
    }

    // 3. Get current published version if not specified
    let versionId = input.version_id;
    if (!versionId) {
      const { data: currentVersion } = await supabaseAdmin
        .from('price_list_versions')
        .select('id')
        .eq('price_list_id', input.price_list_id)
        .eq('status', 'published')
        .maybeSingle();
      versionId = currentVersion?.id ?? undefined;
    }

    // 4. Create session — chỉ ghi cho khách hàng thực sự (có customer_id hợp lệ)
    // Admin/Staff không có customer record → bỏ qua, không insert để tránh FK violation
    if (!customerId) {
      if (user.profile.role === 'customer') {
        throw ApiError.forbidden('Không tìm thấy hồ sơ khách hàng để ghi log');
      }
      // Admin/Staff xem thử báo giá → không cần ghi session
      sendCreated(res, { id: null, skipped: true }, 'Admin view – session not recorded');
      return;
    }

    const { data: session, error } = await supabaseAdmin
      .from('view_sessions')
      .insert({
        customer_id: customerId,
        price_list_id: input.price_list_id,
        version_id: versionId ?? null,
        device: input.device ?? null,
        ip_address: req.ip ?? null,
        user_agent: req.headers['user-agent'] ?? null,
      })
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[TRACKING ERROR]', error);
      throw ApiError.internal(error.message);
    }

    sendCreated(res, session, 'Session created');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /tracking/sessions/:sessionId/beacon-end
 * Kết thúc session qua sendBeacon (không cần auth header).
 * An toàn vì sessionId là UUID ngẫu nhiên — không thể đoán được.
 */
export async function beaconEndSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId } = req.params;

    // Fetch session không kiểm tra ownership (đã bypass auth)
    const { data: session } = await supabaseAdmin
      .from('view_sessions')
      .select('id, started_at, ended_at')
      .eq('id', sessionId)
      .maybeSingle();

    // Nếu không tìm thấy hoặc đã kết thúc → bỏ qua silently
    if (!session || session.ended_at) {
      res.status(204).end();
      return;
    }

    const endedAt = new Date();
    const startedAt = new Date(session.started_at);
    const durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

    await supabaseAdmin
      .from('view_sessions')
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq('id', sessionId);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /tracking/sessions/:sessionId/end
 * End a view session (record duration)
 */
export async function endSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { sessionId } = req.params;

    // Get customer record — dùng maybeSingle để không throw nếu admin không có customer record
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('profile_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    // Admin/Staff không có customer record → session của họ không được ghi → bỏ qua gracefully
    if (!customer) {
      sendSuccess(res, null, 'No customer record – session end skipped');
      return;
    }

    // Fetch session — dùng maybeSingle để trả về null thay vì throw khi không tìm thấy
    const { data: session } = await supabaseAdmin
      .from('view_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('customer_id', customer.id)
      .maybeSingle();

    if (!session) throw ApiError.notFound('Session không tồn tại');

    if (session.ended_at) {
      throw ApiError.badRequest('Session đã kết thúc');
    }

    // Calculate duration
    const endedAt = new Date();
    const startedAt = new Date(session.started_at);
    const durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

    const { data: updated, error } = await supabaseAdmin
      .from('view_sessions')
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq('id', sessionId)
      .select('*')
      .maybeSingle();

    if (error) throw ApiError.internal(error.message);

    sendSuccess(res, updated, 'Session ended');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /tracking/sessions/:sessionId/items
 * Track a product view within a session
 */
export async function trackItemView(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId } = req.params;
    const input = trackItemViewSchema.parse({
      ...req.body,
      session_id: sessionId,
    });

    // Verify session exists
    const { data: session } = await supabaseAdmin
      .from('view_sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (!session) throw ApiError.notFound('Session không tồn tại');

    const { data, error } = await supabaseAdmin
      .from('view_session_items')
      .insert({
        session_id: sessionId,
        product_id: input.product_id,
        view_duration_seconds: input.view_duration_seconds,
      })
      .select('*')
      .single();

    if (error) throw ApiError.internal(error.message);

    sendCreated(res, data);
  } catch (error) {
    next(error);
  }
}

// ============================================================
// ANALYTICS (admin/staff only)
// ============================================================

/**
 * GET /tracking/analytics/overview
 * Dashboard overview stats
 */
export async function getAnalyticsOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Parallel queries for dashboard stats
    const [
      totalSessionsRes,
      totalCustomersRes,
      recentSessionsRes,
      topProductsRes,
    ] = await Promise.all([
      // Total sessions
      supabaseAdmin
        .from('view_sessions')
        .select('id', { count: 'exact', head: true }),

      // Active customers who have viewed
      supabaseAdmin
        .from('view_sessions')
        .select('customer_id')
        .limit(10000),

      // Recent sessions
      supabaseAdmin
        .from('view_sessions')
        .select(`
          id, started_at, duration_seconds, device, price_list_id, customer_id,
          customers!left(id, customer_name, phone_number),
          price_lists!left(id, title)
        `)
        .order('started_at', { ascending: false })
        .limit(50),

      // Most viewed products
      supabaseAdmin
        .from('view_session_items')
        .select('product_id, products(name, sku)')
        .limit(10000),
    ]);

    // Count unique customers
    const uniqueCustomers = new Set(
      (totalCustomersRes.data ?? [])
        .filter((s: any) => s.customer_id) // Chỉ đếm nếu có customer_id
        .map((s: any) => s.customer_id)
    ).size;

    // Count product views
    const productViewCounts: Record<string, { count: number; name: string; sku: string }> = {};
    for (const item of topProductsRes.data ?? []) {
      const pid = (item as any).product_id;
      if (!productViewCounts[pid]) {
        productViewCounts[pid] = {
          count: 0,
          name: (item as any).products?.name ?? '',
          sku: (item as any).products?.sku ?? '',
        };
      }
      productViewCounts[pid].count++;
    }

    const topProducts = Object.entries(productViewCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([id, data]) => ({ product_id: id, ...data }));

    sendSuccess(res, {
      total_sessions: totalSessionsRes.count ?? 0,
      unique_customers: uniqueCustomers,
      recent_sessions: recentSessionsRes.data ?? [],
      top_products: topProducts,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /tracking/analytics/customers
 * Customer activity summary
 */
export async function getCustomerActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);

    const { data, error, count } = await supabaseAdmin
      .from('v_customer_activity')
      .select('*', { count: 'exact' })
      .order('last_viewed_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) throw ApiError.internal(error.message);

    sendSuccess(res, data, undefined, 200, {
      page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /tracking/analytics/customers/:customerId
 * Detailed view history for a specific customer
 */
export async function getCustomerViewHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { customerId } = req.params;
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);

    const { data, error, count } = await supabaseAdmin
      .from('view_sessions')
      .select(`
        *,
        price_lists(id, title),
        price_list_versions(id, version_number)
      `, { count: 'exact' })
      .eq('customer_id', customerId)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw ApiError.internal(error.message);

    // For each session, get item views
    const sessionsWithItems = await Promise.all(
      (data ?? []).map(async (session: any) => {
        const { data: items } = await supabaseAdmin
          .from('view_session_items')
          .select('*, products(name, sku)')
          .eq('session_id', session.id)
          .order('viewed_at', { ascending: true });
        return { ...session, viewed_items: items ?? [] };
      })
    );

    sendSuccess(res, sessionsWithItems, undefined, 200, {
      page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /tracking/analytics/me
 * Get view history for the current authenticated customer
 */
export async function getMyViewHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);

    // Get customer record for this user
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('profile_id', user.id)
      .is('deleted_at', null)
      .single();

    if (!customer) {
      // If no customer record, return empty list
      sendSuccess(res, [], undefined, 200, {
        page, limit, total: 0, totalPages: 0,
      });
      return;
    }

    const { data, error, count } = await supabaseAdmin
      .from('view_sessions')
      .select(`
        *,
        price_lists(id, title),
        price_list_versions(id, version_number)
      `, { count: 'exact' })
      .eq('customer_id', customer.id)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw ApiError.internal(error.message);

    // For each session, get item views
    const sessionsWithItems = await Promise.all(
      (data ?? []).map(async (session: any) => {
        const { data: items } = await supabaseAdmin
          .from('view_session_items')
          .select('*, products(name, sku)')
          .eq('session_id', session.id)
          .order('viewed_at', { ascending: true });
        return { ...session, viewed_items: items ?? [] };
      })
    );

    sendSuccess(res, sessionsWithItems, undefined, 200, {
      page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /tracking/analytics/price-lists/:priceListId
 * View stats for a specific price list
 */
export async function getPriceListViewStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { priceListId } = req.params;

    const { data: sessions, error } = await supabaseAdmin
      .from('view_sessions')
      .select(`
        *,
        customers(id, customer_name, phone_number)
      `)
      .eq('price_list_id', priceListId)
      .order('started_at', { ascending: false });

    if (error) throw ApiError.internal(error.message);

    // Summary stats
    const totalSessions = sessions?.length ?? 0;
    const uniqueViewers = new Set((sessions ?? []).map((s: any) => s.customer_id)).size;
    const totalDuration = (sessions ?? []).reduce(
      (sum: number, s: any) => sum + (s.duration_seconds ?? 0), 0
    );
    const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;

    sendSuccess(res, {
      summary: {
        total_sessions: totalSessions,
        unique_viewers: uniqueViewers,
        total_duration_seconds: totalDuration,
        avg_duration_seconds: avgDuration,
      },
      sessions: sessions ?? [],
    });
  } catch (error) {
    next(error);
  }
}
