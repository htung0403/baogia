import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError, sendSuccess, sendCreated, parsePagination } from '../utils/index.js';
import { AuthenticatedRequest } from '../types/api.js';
import { AuditService } from '../services/audit.service.js';
import {
  assignStageSchema, funnelQuerySchema, createActivitySchema,
  createQuoteSchema, createContractSchema,
  createColumnSchema, updateColumnSchema, createStageSchema, updateStageSchema
} from '../validators/index.js';

function getPeriodRange(period: string): { from?: string; to?: string } {
  const now = new Date();
  const ictOffset = 7 * 60;
  const ict = new Date(now.getTime() + ictOffset * 60 * 1000);

  if (period === 'this_month') {
    const from = new Date(Date.UTC(ict.getUTCFullYear(), ict.getUTCMonth(), 1) - ictOffset * 60 * 1000);
    return { from: from.toISOString() };
  }
  if (period === 'last_month') {
    const firstOfThisMonth = new Date(Date.UTC(ict.getUTCFullYear(), ict.getUTCMonth(), 1));
    const firstOfLastMonth = new Date(Date.UTC(ict.getUTCFullYear(), ict.getUTCMonth() - 1, 1));
    return {
      from: new Date(firstOfLastMonth.getTime() - ictOffset * 60 * 1000).toISOString(),
      to:   new Date(firstOfThisMonth.getTime() - ictOffset * 60 * 1000).toISOString(),
    };
  }
  return {};
}

export async function getBoardData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { count: totalCustomers, error: countErr } = await supabaseAdmin
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);
    if (countErr) throw ApiError.internal(countErr.message);

    const total = totalCustomers ?? 0;

    const { data: columns, error: colErr } = await supabaseAdmin
      .from('pipeline_columns')
      .select('id, name, color, sort_order')
      .order('sort_order');
    if (colErr) throw ApiError.internal(colErr.message);

    const { data: stages, error: stgErr } = await supabaseAdmin
      .from('pipeline_stages')
      .select('id, column_id, name, description, color, sort_order')
      .order('sort_order');
    if (stgErr) throw ApiError.internal(stgErr.message);

    const { data: pipelineRows, error: pipeErr } = await supabaseAdmin
      .from('customer_pipeline')
      .select('stage_id, customers!inner(id, customer_name, email, phone_number, deleted_at)')
      .is('customers.deleted_at', null);
    if (pipeErr) throw ApiError.internal(pipeErr.message);

    const stageCountMap: Record<string, number> = {};
    const stageCustomersMap: Record<string, any[]> = {};
    for (const row of (pipelineRows ?? [])) {
      const sid = row.stage_id as string;
      stageCountMap[sid] = (stageCountMap[sid] ?? 0) + 1;
      if (!stageCustomersMap[sid]) stageCustomersMap[sid] = [];
      if (row.customers) stageCustomersMap[sid].push(row.customers);
    }

    const result = (columns ?? []).map(col => ({
      ...col,
      stages: (stages ?? [])
        .filter(s => s.column_id === col.id)
        .map(s => {
          const count = stageCountMap[s.id] ?? 0;
          const percent = total > 0 ? Math.round((count / total) * 10000) / 100 : 0;
          return { ...s, count, percent, customers: stageCustomersMap[s.id] || [] };
        }),
    }));

    sendSuccess(res, { columns: result, total_customers: total });
  } catch (error) {
    next(error);
  }
}

export async function assignCustomerToStage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { customerId } = req.params;
    const { stage_id } = assignStageSchema.parse(req.body);

    const { data: customer, error: custErr } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .is('deleted_at', null)
      .single();
    if (custErr || !customer) throw ApiError.notFound('Khách hàng không tồn tại');

    const { data: stage, error: stgErr } = await supabaseAdmin
      .from('pipeline_stages')
      .select('id')
      .eq('id', stage_id)
      .single();
    if (stgErr || !stage) throw ApiError.notFound('Stage không tồn tại');

    const { data: existing } = await supabaseAdmin
      .from('customer_pipeline')
      .select('id, stage_id')
      .eq('customer_id', customerId)
      .single();

    const fromStageId = existing ? (existing.stage_id as string) : null;

    if (existing) {
      await supabaseAdmin
        .from('customer_pipeline')
        .update({ stage_id, assigned_at: new Date().toISOString(), assigned_by: user.id })
        .eq('customer_id', customerId);
    } else {
      await supabaseAdmin
        .from('customer_pipeline')
        .insert({ customer_id: customerId, stage_id, assigned_by: user.id });
    }

    await supabaseAdmin
      .from('customer_stage_history')
      .insert({
        customer_id: customerId,
        from_stage_id: fromStageId,
        to_stage_id: stage_id,
        moved_by: user.id,
      });

    await AuditService.log({
      actorId: user.id,
      action: 'update',
      entityType: 'customer',
      entityId: customerId,
      newData: { stage_id },
      ipAddress: req.ip,
    });

    sendCreated(res, { customer_id: customerId, stage_id }, 'Cập nhật hành trình thành công');
  } catch (error) {
    next(error);
  }
}

export async function getFunnelData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = funnelQuerySchema.parse(req.query);
    const { assigned_to, period, all_kh } = params;

    const dateRange = all_kh ? {} : getPeriodRange(period);

    let custQuery = supabaseAdmin
      .from('customers')
      .select('id, source, created_at')
      .is('deleted_at', null);

    if (!all_kh) {
      if (dateRange.from) custQuery = custQuery.gte('created_at', dateRange.from);
      if (dateRange.to)   custQuery = custQuery.lt('created_at', dateRange.to);
      if (assigned_to)    custQuery = custQuery.eq('assigned_to', assigned_to);
    }

    const { data: custRows, error: custErr } = await custQuery;
    if (custErr) throw ApiError.internal(custErr.message);

    const customerIds = (custRows ?? []).map(c => c.id as string);
    const totalCount = customerIds.length;

    const bySourceMap: Record<string, number> = {};
    for (const c of (custRows ?? [])) {
      const src = (c.source as string | null) ?? 'Không rõ';
      bySourceMap[src] = (bySourceMap[src] ?? 0) + 1;
    }
    const bySource = Object.entries(bySourceMap).map(([source, count]) => ({
      source,
      count,
      pct: totalCount > 0 ? Math.round((count / totalCount) * 10000) / 100 : 0,
    }));

    let activities: Array<{ activity_type: string; related_project: string | null }> = [];
    if (customerIds.length > 0) {
      const { data: actData, error: actErr } = await supabaseAdmin
        .from('customer_activities')
        .select('activity_type, related_project')
        .in('customer_id', customerIds);
      if (actErr) throw ApiError.internal(actErr.message);
      activities = actData ?? [];
    }

    const interactionCount = activities.length;
    const interactionByTypeMap: Record<string, number> = {};
    for (const a of activities) {
      const t = a.activity_type as string;
      interactionByTypeMap[t] = (interactionByTypeMap[t] ?? 0) + 1;
    }
    const interactionByType = Object.entries(interactionByTypeMap).map(([type, count]) => ({ type, count }));

    const projectMap: Record<string, number> = {};
    for (const a of activities) {
      const p = (a.related_project as string | null) ?? 'Không rõ';
      projectMap[p] = (projectMap[p] ?? 0) + 1;
    }
    const byProject = Object.entries(projectMap)
      .map(([project, count]) => ({ project, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    let orderCount = 0;
    let onceBuyers = 0;
    let multipleBuyers = 0;
    let paidOrders = 0;
    let unpaidOrders = 0;
    let quotesCount = 0;
    let contractsCount = 0;

    if (customerIds.length > 0) {
      const { data: orders, error: ordErr } = await supabaseAdmin
        .from('orders')
        .select('id, customer_id')
        .in('customer_id', customerIds)
        .is('deleted_at', null);
      if (ordErr) throw ApiError.internal(ordErr.message);

      orderCount = (orders ?? []).length;

      const perCust: Record<string, number> = {};
      for (const o of (orders ?? [])) {
        const cid = o.customer_id as string;
        perCust[cid] = (perCust[cid] ?? 0) + 1;
      }
      for (const cnt of Object.values(perCust)) {
        if (cnt === 1) onceBuyers++;
        else if (cnt > 1) multipleBuyers++;
      }

      const { data: payView, error: pvErr } = await supabaseAdmin
        .from('v_order_payment_summary')
        .select('order_id, payment_status')
        .in('customer_id', customerIds);
      if (!pvErr && payView) {
        for (const row of payView) {
          if (row.payment_status === 'paid') paidOrders++;
          else unpaidOrders++;
        }
      }

      const { count: qc } = await supabaseAdmin
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .in('customer_id', customerIds)
        .is('deleted_at', null);
      quotesCount = qc ?? 0;

      const { count: cc } = await supabaseAdmin
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .in('customer_id', customerIds)
        .is('deleted_at', null);
      contractsCount = cc ?? 0;
    }

    const orderRatio = totalCount > 0 ? Math.round((orderCount / totalCount) * 100) / 100 : 0;

    let revenueTotal = 0;
    let revenuePaid = 0;
    let revenueBySource: Array<{ source: string | null; count: number; pct: number; amount: number }> = [];

    if (customerIds.length > 0) {
      const { data: confirmedOrders, error: revErr } = await supabaseAdmin
        .from('orders')
        .select('id, customer_id, final_amount')
        .in('customer_id', customerIds)
        .eq('status', 'confirmed')
        .is('deleted_at', null);
      if (revErr) throw ApiError.internal(revErr.message);

      revenueTotal = (confirmedOrders ?? []).reduce((sum, o) => sum + ((o.final_amount as number) ?? 0), 0);

      const custSourceMap: Record<string, string | null> = {};
      for (const c of (custRows ?? [])) {
        custSourceMap[c.id as string] = c.source as string | null;
      }
      const revBySourceMap: Record<string, number> = {};
      const revBySourceCount: Record<string, number> = {};
      for (const o of (confirmedOrders ?? [])) {
        const src = custSourceMap[o.customer_id as string] ?? 'Không rõ';
        revBySourceMap[src] = (revBySourceMap[src] ?? 0) + ((o.final_amount as number) ?? 0);
        revBySourceCount[src] = (revBySourceCount[src] ?? 0) + 1;
      }
      revenueBySource = Object.entries(revBySourceMap).map(([source, amount]) => ({
        source,
        count: revBySourceCount[source] ?? 0,
        pct: revenueTotal > 0 ? Math.round((amount / revenueTotal) * 10000) / 100 : 0,
        amount,
      }));

      const { data: payments, error: payErr } = await supabaseAdmin
        .from('payments')
        .select('amount')
        .in('customer_id', customerIds)
        .eq('status', 'completed');
      if (!payErr && payments) {
        revenuePaid = payments.reduce((sum, p) => sum + ((p.amount as number) ?? 0), 0);
      }
    }

    sendSuccess(res, {
      new_customers: { count: totalCount, by_source: bySource },
      interactions:  { count: interactionCount, by_type: interactionByType },
      activities:    { count: interactionCount, by_project: byProject, by_type: interactionByType },
      orders: {
        count: orderCount,
        quotes: quotesCount,
        contracts: contractsCount,
        ratio: orderRatio,
        once: onceBuyers,
        multiple: multipleBuyers,
        paid: paidOrders,
        unpaid: unpaidOrders,
      },
      revenue: {
        total: revenueTotal,
        by_source: revenueBySource,
        paid: revenuePaid,
        unpaid: revenueTotal - revenuePaid,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const input = createActivitySchema.parse(req.body);

    const { data: customer, error: custErr } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('id', input.customer_id)
      .is('deleted_at', null)
      .single();
    if (custErr || !customer) throw ApiError.notFound('Khách hàng không tồn tại');

    const { data, error } = await supabaseAdmin
      .from('customer_activities')
      .insert({
        customer_id:     input.customer_id,
        activity_type:   input.activity_type,
        title:           input.title,
        description:     input.description ?? null,
        assigned_to:     input.assigned_to ?? null,
        related_project: input.related_project ?? null,
        created_by:      user.id,
      })
      .select('*')
      .single();

    if (error) throw ApiError.internal(error.message);

    await AuditService.log({
      actorId: user.id,
      action: 'create',
      entityType: 'customer',
      entityId: input.customer_id,
      newData: data,
      ipAddress: req.ip,
    });

    sendCreated(res, data, 'Thêm hoạt động thành công');
  } catch (error) {
    next(error);
  }
}

export async function listActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { customerId } = req.params;
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);

    const { data, error, count } = await supabaseAdmin
      .from('customer_activities')
      .select('*, profiles:created_by(display_name, avatar_url)', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw ApiError.internal(error.message);

    sendSuccess(res, data ?? [], undefined, 200, {
      page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function listQuotes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const customerId = req.query.customer_id as string | undefined;

    let query = supabaseAdmin
      .from('quotes')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (customerId) query = query.eq('customer_id', customerId);

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw ApiError.internal(error.message);

    sendSuccess(res, data ?? [], undefined, 200, {
      page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function createQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const input = createQuoteSchema.parse(req.body);

    const { data: customer, error: custErr } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('id', input.customer_id)
      .is('deleted_at', null)
      .single();
    if (custErr || !customer) throw ApiError.notFound('Khách hàng không tồn tại');

    const year = new Date().getFullYear();
    const { count: existingCount } = await supabaseAdmin
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01T00:00:00.000Z`)
      .lt('created_at', `${year + 1}-01-01T00:00:00.000Z`);
    const code = `QT/${year}/${String((existingCount ?? 0) + 1).padStart(4, '0')}`;

    const { data, error } = await supabaseAdmin
      .from('quotes')
      .insert({
        customer_id: input.customer_id,
        code,
        title: input.title ?? null,
        amount: input.amount ?? 0,
        status: 'draft',
        notes: input.notes ?? null,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) throw ApiError.internal(error.message);

    await AuditService.log({
      actorId: user.id,
      action: 'create',
      entityType: 'customer',
      entityId: input.customer_id,
      newData: data,
      ipAddress: req.ip,
    });

    sendCreated(res, data, 'Tạo báo giá thành công');
  } catch (error) {
    next(error);
  }
}

export async function listContracts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const customerId = req.query.customer_id as string | undefined;

    let query = supabaseAdmin
      .from('contracts')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (customerId) query = query.eq('customer_id', customerId);

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw ApiError.internal(error.message);

    sendSuccess(res, data ?? [], undefined, 200, {
      page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function createContract(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AuthenticatedRequest).user;
    const input = createContractSchema.parse(req.body);

    const { data: customer, error: custErr } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('id', input.customer_id)
      .is('deleted_at', null)
      .single();
    if (custErr || !customer) throw ApiError.notFound('Khách hàng không tồn tại');

    const year = new Date().getFullYear();
    const { count: existingCount } = await supabaseAdmin
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01T00:00:00.000Z`)
      .lt('created_at', `${year + 1}-01-01T00:00:00.000Z`);
    const code = `CT/${year}/${String((existingCount ?? 0) + 1).padStart(4, '0')}`;

    const { data, error } = await supabaseAdmin
      .from('contracts')
      .insert({
        customer_id: input.customer_id,
        code,
        title: input.title ?? null,
        amount: input.amount ?? 0,
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        notes: input.notes ?? null,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) throw ApiError.internal(error.message);

    await AuditService.log({
      actorId: user.id,
      action: 'create',
      entityType: 'customer',
      entityId: input.customer_id,
      newData: data,
      ipAddress: req.ip,
    });

    sendCreated(res, data, 'Tạo hợp đồng thành công');
  } catch (error) {
    next(error);
  }
}

// ============================================================
// PIPELINE SETTINGS
// ============================================================

export async function createPipelineColumn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createColumnSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from('pipeline_columns')
      .insert(input)
      .select()
      .single();
    if (error) throw ApiError.internal(error.message);
    sendCreated(res, data, 'Tạo cột thành công');
  } catch (error) {
    next(error);
  }
}

export async function updatePipelineColumn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const input = updateColumnSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from('pipeline_columns')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) throw ApiError.internal(error.message);
    if (!data) throw ApiError.notFound('Không tìm thấy cột');
    sendSuccess(res, data, 'Cập nhật cột thành công');
  } catch (error) {
    next(error);
  }
}

export async function deletePipelineColumn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    
    // Check if stages exist for this column
    const { count: stageCount, error: stageErr } = await supabaseAdmin
      .from('pipeline_stages')
      .select('*', { count: 'exact', head: true })
      .eq('column_id', id);
      
    if (stageErr) throw ApiError.internal(stageErr.message);
    if (stageCount && stageCount > 0) {
      throw ApiError.badRequest('Không thể xóa cột vì vẫn còn stages bên trong. Hãy xóa hoặc di chuyển các stage trước.');
    }

    const { error } = await supabaseAdmin
      .from('pipeline_columns')
      .delete()
      .eq('id', id);
    if (error) throw ApiError.internal(error.message);
    sendSuccess(res, { id }, 'Xóa cột thành công');
  } catch (error) {
    next(error);
  }
}

export async function createPipelineStage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createStageSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from('pipeline_stages')
      .insert(input)
      .select()
      .single();
    if (error) throw ApiError.internal(error.message);
    sendCreated(res, data, 'Tạo stage thành công');
  } catch (error) {
    next(error);
  }
}

export async function updatePipelineStage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const input = updateStageSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from('pipeline_stages')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) throw ApiError.internal(error.message);
    if (!data) throw ApiError.notFound('Không tìm thấy stage');
    sendSuccess(res, data, 'Cập nhật stage thành công');
  } catch (error) {
    next(error);
  }
}

export async function deletePipelineStage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    
    // Check if customers are assigned to this stage
    const { count: custCount, error: custErr } = await supabaseAdmin
      .from('customer_pipeline')
      .select('*', { count: 'exact', head: true })
      .eq('stage_id', id);
      
    if (custErr) throw ApiError.internal(custErr.message);
    if (custCount && custCount > 0) {
      throw ApiError.badRequest('Không thể xóa stage vì vẫn còn khách hàng. Hãy di chuyển khách hàng trước.');
    }

    const { error } = await supabaseAdmin
      .from('pipeline_stages')
      .delete()
      .eq('id', id);
    if (error) throw ApiError.internal(error.message);
    sendSuccess(res, { id }, 'Xóa stage thành công');
  } catch (error) {
    next(error);
  }
}
