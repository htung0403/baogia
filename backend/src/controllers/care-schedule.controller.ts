import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError, sendSuccess, sendCreated } from '../utils/index.js';
import { AuthenticatedRequest } from '../types/api.js';
import {
  createCareSettingSchema,
  updateCareSettingSchema,
  generateCareEventsSchema,
  updateCareEventSchema,
} from '../validators/index.js';

export async function listCareSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('care_schedule_settings')
      .select('*, customer_groups(id, name, code), care_schedule_steps(*)')
      .order('created_at', { ascending: false });

    if (error) throw ApiError.internal(error.message);
    sendSuccess(res, data ?? []);
  } catch (error) {
    next(error);
  }
}

export async function getCareSettingByGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { groupId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('care_schedule_settings')
      .select('*, customer_groups(id, name, code), care_schedule_steps(*)')
      .eq('customer_group_id', groupId)
      .single();

    if (error || !data) throw ApiError.notFound('Chưa có cài đặt chăm sóc cho nhóm này');
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function createCareSetting(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createCareSettingSchema.parse(req.body);
    const user = (req as AuthenticatedRequest).user;

    const { data: setting, error: settingErr } = await supabaseAdmin
      .from('care_schedule_settings')
      .insert({
        customer_group_id: input.customer_group_id,
        cycle_days: input.cycle_days,
        is_active: input.is_active ?? true,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (settingErr) {
      if (settingErr.code === '23505') throw ApiError.conflict('Nhóm này đã có cài đặt chăm sóc');
      throw ApiError.internal(settingErr.message);
    }

    const stepsToInsert = input.steps.map((step, index) => ({
      setting_id: setting.id,
      name: step.name,
      description: step.description ?? null,
      days_offset: step.days_offset,
      sort_order: step.sort_order ?? index,
    }));

    const { error: stepsErr } = await supabaseAdmin
      .from('care_schedule_steps')
      .insert(stepsToInsert);

    if (stepsErr) throw ApiError.internal(stepsErr.message);

    const { data: full, error: fullErr } = await supabaseAdmin
      .from('care_schedule_settings')
      .select('*, customer_groups(id, name, code), care_schedule_steps(*)')
      .eq('id', setting.id)
      .single();

    if (fullErr) throw ApiError.internal(fullErr.message);
    sendCreated(res, full, 'Tạo cài đặt chăm sóc thành công');
  } catch (error) {
    next(error);
  }
}

export async function updateCareSetting(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const input = updateCareSettingSchema.parse(req.body);

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('care_schedule_settings')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) throw ApiError.notFound('Cài đặt chăm sóc không tồn tại');

    const updateFields: Record<string, unknown> = {};
    if (input.cycle_days !== undefined) updateFields.cycle_days = input.cycle_days;
    if (input.is_active !== undefined) updateFields.is_active = input.is_active;

    if (Object.keys(updateFields).length > 0) {
      const { error: updateErr } = await supabaseAdmin
        .from('care_schedule_settings')
        .update(updateFields)
        .eq('id', id);

      if (updateErr) throw ApiError.internal(updateErr.message);
    }

    if (input.steps !== undefined) {
      const { error: deleteErr } = await supabaseAdmin
        .from('care_schedule_steps')
        .delete()
        .eq('setting_id', id);

      if (deleteErr) throw ApiError.internal(deleteErr.message);

      const stepsToInsert = input.steps.map((step, index) => ({
        setting_id: id,
        name: step.name,
        description: step.description ?? null,
        days_offset: step.days_offset,
        sort_order: step.sort_order ?? index,
      }));

      const { error: stepsErr } = await supabaseAdmin
        .from('care_schedule_steps')
        .insert(stepsToInsert);

      if (stepsErr) throw ApiError.internal(stepsErr.message);
    }

    const { data: full, error: fullErr } = await supabaseAdmin
      .from('care_schedule_settings')
      .select('*, customer_groups(id, name, code), care_schedule_steps(*)')
      .eq('id', id)
      .single();

    if (fullErr) throw ApiError.internal(fullErr.message);
    sendSuccess(res, full, 'Cập nhật cài đặt chăm sóc thành công');
  } catch (error) {
    next(error);
  }
}

export async function deleteCareSetting(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('care_schedule_settings')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) throw ApiError.notFound('Cài đặt chăm sóc không tồn tại');

    const { error: eventsErr } = await supabaseAdmin
      .from('care_schedule_events')
      .delete()
      .eq('setting_id', id)
      .in('status', ['pending', 'rescheduled']);

    if (eventsErr) throw ApiError.internal(eventsErr.message);

    const { error } = await supabaseAdmin
      .from('care_schedule_settings')
      .delete()
      .eq('id', id);

    if (error) throw ApiError.internal(error.message);
    sendSuccess(res, { id }, 'Xóa cài đặt chăm sóc thành công');
  } catch (error) {
    next(error);
  }
}

export async function generateCareEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = generateCareEventsSchema.parse(req.body);
    const { customer_group_id, horizon_days } = input;
    const horizonDays = horizon_days ?? 90;

    const { data: setting, error: settingErr } = await supabaseAdmin
      .from('care_schedule_settings')
      .select('*, care_schedule_steps(*)')
      .eq('customer_group_id', customer_group_id)
      .single();

    if (settingErr || !setting) throw ApiError.badRequest('Chưa có cài đặt chăm sóc cho nhóm này');
    if (!setting.is_active) throw ApiError.badRequest('Cài đặt chăm sóc không hoạt động');

    const steps = (setting.care_schedule_steps as Array<{ id: string; days_offset: number; sort_order: number }>) ?? [];
    if (steps.length === 0) throw ApiError.badRequest('Cài đặt chưa có bước chăm sóc nào');

    const { data: customers, error: custErr } = await supabaseAdmin
      .from('customers')
      .select('id, assigned_to, created_at')
      .eq('customer_group_id', customer_group_id)
      .is('deleted_at', null);

    if (custErr) throw ApiError.internal(custErr.message);
    if (!customers || customers.length === 0) {
      return sendSuccess(res, { generated: 0, customers: 0, message: 'Không có khách hàng trong nhóm này' });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('care_schedule_events')
      .delete()
      .eq('setting_id', setting.id)
      .in('status', ['pending', 'rescheduled']);

    if (deleteErr) throw ApiError.internal(deleteErr.message);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + horizonDays);

    const allEvents: Array<Record<string, unknown>> = [];

    for (const customer of customers) {
      const { data: lastDone } = await supabaseAdmin
        .from('care_schedule_events')
        .select('scheduled_date')
        .eq('customer_id', customer.id)
        .eq('setting_id', setting.id)
        .eq('status', 'done')
        .order('scheduled_date', { ascending: false })
        .limit(1)
        .single();

      let anchorDate: Date;
      if (lastDone?.scheduled_date) {
        anchorDate = new Date(lastDone.scheduled_date);
      } else {
        anchorDate = new Date(customer.created_at);
      }
      anchorDate.setHours(0, 0, 0, 0);

      let cycleStart = new Date(anchorDate);
      cycleStart.setDate(cycleStart.getDate() + setting.cycle_days);

      while (cycleStart <= horizon) {
        for (const step of steps) {
          const eventDate = new Date(cycleStart);
          eventDate.setDate(eventDate.getDate() + step.days_offset);

          if (eventDate >= today && eventDate <= horizon) {
            allEvents.push({
              customer_id: customer.id,
              step_id: step.id,
              setting_id: setting.id,
              assigned_to: customer.assigned_to ?? null,
              scheduled_date: eventDate.toISOString().split('T')[0],
              status: 'pending',
            });
          }
        }
        cycleStart = new Date(cycleStart);
        cycleStart.setDate(cycleStart.getDate() + setting.cycle_days);
      }
    }

    let totalInserted = 0;
    const chunkSize = 100;
    for (let i = 0; i < allEvents.length; i += chunkSize) {
      const chunk = allEvents.slice(i, i + chunkSize);
      const { error: insertErr } = await supabaseAdmin
        .from('care_schedule_events')
        .insert(chunk);

      if (insertErr) throw ApiError.internal(insertErr.message);
      totalInserted += chunk.length;
    }

    sendSuccess(res, { generated: totalInserted, customers: customers.length });
  } catch (error) {
    next(error);
  }
}

export async function listCareEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { month, group_id, assigned_to, status } = req.query as Record<string, string>;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw ApiError.badRequest('Tham số month không hợp lệ (định dạng: YYYY-MM)');
    }

    const [year, monthNum] = month.split('-').map(Number);
    const firstDay = new Date(year, monthNum - 1, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, monthNum, 0).toISOString().split('T')[0];

    let query = supabaseAdmin
      .from('care_schedule_events')
      .select(`
        *,
        customers(id, customer_name, phone_number, customer_group_id),
        care_schedule_steps(id, name, description, days_offset),
        care_schedule_settings(id, cycle_days, customer_groups(id, name)),
        profiles!assigned_to(display_name)
      `)
      .gte('scheduled_date', firstDay)
      .lte('scheduled_date', lastDay)
      .order('scheduled_date', { ascending: true });

    if (group_id) {
      query = query.eq('care_schedule_settings.customer_group_id', group_id);
    }
    if (assigned_to) {
      query = query.eq('assigned_to', assigned_to);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw ApiError.internal(error.message);
    sendSuccess(res, data ?? []);
  } catch (error) {
    next(error);
  }
}

export async function updateCareEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const input = updateCareEventSchema.parse(req.body);
    const user = (req as AuthenticatedRequest).user;

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('care_schedule_events')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) throw ApiError.notFound('Lịch chăm sóc không tồn tại');

    const updateFields: Record<string, unknown> = {};

    if (input.status === 'done') {
      updateFields.status = 'done';
      updateFields.completed_at = new Date().toISOString();
      updateFields.completed_by = user.id;
      if (input.notes !== undefined) updateFields.notes = input.notes;
    } else if (input.status === 'skipped') {
      updateFields.status = 'skipped';
      updateFields.completed_at = new Date().toISOString();
      updateFields.completed_by = user.id;
    }

    if (input.scheduled_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newDate = new Date(input.scheduled_date);
      if (newDate < today) {
        throw ApiError.badRequest('Ngày dời lịch phải là ngày trong tương lai');
      }
      if (!existing.original_date) {
        updateFields.original_date = existing.scheduled_date;
      }
      updateFields.scheduled_date = input.scheduled_date;
      updateFields.status = 'rescheduled';
    }

    if (Object.keys(updateFields).length === 0) {
      return sendSuccess(res, existing);
    }

    const { data, error } = await supabaseAdmin
      .from('care_schedule_events')
      .update(updateFields)
      .eq('id', id)
      .select(`
        *,
        customers(id, customer_name, phone_number, customer_group_id),
        care_schedule_steps(id, name, description, days_offset),
        care_schedule_settings(id, cycle_days, customer_groups(id, name)),
        profiles!assigned_to(display_name)
      `)
      .single();

    if (error) throw ApiError.internal(error.message);
    sendSuccess(res, data, 'Cập nhật lịch chăm sóc thành công');
  } catch (error) {
    next(error);
  }
}
