import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, isToday,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { careScheduleApi, customerApi } from '@/api/client';
import type { CareScheduleEvent, Customer } from '@/types';
import { useToast } from '@/components/ui/toast';
import { ChevronLeft, ChevronRight, X, Check, CalendarClock, Plus } from 'lucide-react';
import { DateTimePicker24h } from '@/components/ui/DateTimePicker';

export default function CareCalendarPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [actionEvent, setActionEvent] = useState<{ event: CareScheduleEvent; type: 'done' | 'reschedule' } | null>(null);
  const [doneNotes, setDoneNotes] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<{
    customer_id: string;
    scheduled_date: Date | undefined;
    notes: string;
  }>({
    customer_id: '',
    scheduled_date: undefined,
    notes: '',
  });

  const monthKey = format(currentMonth, 'yyyy-MM');

  const { data: res, isLoading } = useQuery({
    queryKey: ['care-events', monthKey],
    queryFn: () => careScheduleApi.listEvents({ month: monthKey }),
  });
  const events: CareScheduleEvent[] = res?.data?.data ?? [];

  const { data: customerRes } = useQuery({
    queryKey: ['customers-list-all'],
    queryFn: () => customerApi.list({ limit: 1000 }),
    enabled: showAddModal,
  });
  const customers: Customer[] = customerRes?.data?.data ?? [];

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CareScheduleEvent[]>();
    events.forEach(event => {
      const hasTime = event.scheduled_date.includes('T') && !event.scheduled_date.endsWith('00:00:00.000Z');
      const dateStr = hasTime
        ? format(new Date(event.scheduled_date), 'yyyy-MM-dd')
        : event.scheduled_date.split('T')[0];

      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(event);
    });
    return map;
  }, [events]);

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof careScheduleApi.updateEvent>[1] }) =>
      careScheduleApi.updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care-events', monthKey] });
      setActionEvent(null);
      toast.success('Cập nhật lịch chăm sóc thành công');
    },
    onError: (error: any) => {
      toast.error('Lỗi', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const createEventMutation = useMutation({
    mutationFn: () => careScheduleApi.createEvent({
      customer_id: addForm.customer_id,
      scheduled_date: addForm.scheduled_date!.toISOString(),
      notes: addForm.notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care-events'] });
      setShowAddModal(false);
      setAddForm({ customer_id: '', scheduled_date: undefined, notes: '' });
      toast.success('Thêm lịch chăm sóc thành công');
    },
    onError: (error: any) => {
      toast.error('Lỗi', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const handleSkip = (event: CareScheduleEvent) => {
    if (window.confirm(`Bỏ qua lịch chăm sóc cho "${event.customers?.customer_name}"?`)) {
      updateEventMutation.mutate({ id: event.id, data: { status: 'skipped' } });
    }
  };

  const firstDay = startOfMonth(currentMonth);
  const lastDay = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });
  const startPad = (getDay(firstDay) + 6) % 7;

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const totalEvents = events.length;
  const doneCount = events.filter(e => e.status === 'done').length;
  const pendingCount = events.filter(e => e.status === 'pending').length;

  const selectedDayEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lịch chăm sóc khách hàng</h1>
        <p className="text-[14px] text-slate-500 mt-1">Xem và quản lý lịch chăm sóc theo tháng</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-800">{isLoading ? '—' : totalEvents}</div>
          <div className="text-[13px] text-slate-500 mt-0.5">Tổng lịch tháng này</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-emerald-600">{isLoading ? '—' : doneCount}</div>
          <div className="text-[13px] text-slate-500 mt-0.5">Đã chăm sóc</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-500">{isLoading ? '—' : pendingCount}</div>
          <div className="text-[13px] text-slate-500 mt-0.5">Chờ xử lý</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm lịch chăm sóc
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="h-8 px-3 text-[12px] font-medium border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer text-slate-600"
          >
            Hôm nay
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <h2 className="text-[15px] font-bold text-slate-800 min-w-[140px] text-center capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: vi })}
          </h2>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="flex gap-4 text-[12px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Chờ xử lý</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Đã CS</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-300" />
          <span>Bỏ qua</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span>Dời lịch</span>
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100">
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-bold text-slate-500 uppercase">
              {d}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-[13px] text-slate-400">Đang tải lịch...</div>
        ) : (
          <div className="grid grid-cols-7">
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[100px] border-b border-r border-slate-100 bg-slate-50/30" />
            ))}

            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDate.get(dateStr) ?? [];
              const isSelected = selectedDate === dateStr;
              const isTodayDay = isToday(day);

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={[
                    'min-h-[100px] border-b border-r border-slate-100 p-1.5 cursor-pointer transition-colors',
                    isTodayDay ? 'bg-indigo-50' : 'hover:bg-slate-50',
                    isSelected ? 'ring-2 ring-inset ring-indigo-400' : '',
                  ].join(' ')}
                >
                  <div className={[
                    'text-[12px] font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                    isTodayDay ? 'bg-indigo-600 text-white' : 'text-slate-700',
                  ].join(' ')}>
                    {format(day, 'd')}
                  </div>

                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(event => (
                      <div
                        key={event.id}
                        className={[
                          'flex items-center gap-1 rounded px-1 py-0.5 text-[10px] truncate',
                          event.status === 'done'
                            ? 'bg-emerald-50 text-emerald-700'
                            : event.status === 'skipped'
                            ? 'bg-slate-100 text-slate-500'
                            : event.status === 'rescheduled'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700',
                        ].join(' ')}
                      >
                        <span className={[
                          'w-1.5 h-1.5 rounded-full flex-shrink-0',
                          event.status === 'done'
                            ? 'bg-emerald-400'
                            : event.status === 'skipped'
                            ? 'bg-slate-300'
                            : event.status === 'rescheduled'
                            ? 'bg-blue-400'
                            : 'bg-amber-400',
                        ].join(' ')} />
                        <span className="truncate">{event.customers?.customer_name ?? '—'}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-slate-400 px-1">+{dayEvents.length - 3} thêm</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedDate && selectedDayEvents.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-slate-800">
              Lịch chăm sóc ngày {format(new Date(selectedDate + 'T00:00:00'), 'dd/MM/yyyy')}
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="p-1 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {selectedDayEvents.map(event => (
              <div key={event.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] text-slate-900 truncate">
                    {event.customers?.customer_name ?? '—'}
                  </div>
                  <div className="text-[12px] text-slate-500">
                    {event.care_schedule_steps?.name ?? '—'} • {event.care_schedule_settings?.customer_groups?.name ?? '—'}
                  </div>
                  {event.profiles?.display_name && (
                    <div className="text-[11px] text-slate-400">Phụ trách: {event.profiles.display_name}</div>
                  )}
                </div>

                <span className={[
                  'text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0',
                  event.status === 'done'
                    ? 'bg-emerald-100 text-emerald-700'
                    : event.status === 'skipped'
                    ? 'bg-slate-100 text-slate-500'
                    : event.status === 'rescheduled'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-amber-100 text-amber-700',
                ].join(' ')}>
                  {event.status === 'done'
                    ? 'Đã CS'
                    : event.status === 'skipped'
                    ? 'Bỏ qua'
                    : event.status === 'rescheduled'
                    ? 'Dời lịch'
                    : 'Chờ xử lý'}
                </span>

                {(event.status === 'pending' || event.status === 'rescheduled') && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setActionEvent({ event, type: 'done' }); setDoneNotes(''); }}
                      className="flex items-center gap-1 h-7 px-2 text-[11px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                      title="Đánh dấu đã chăm sóc"
                    >
                      <Check className="w-3 h-3" /> Đã CS
                    </button>
                    <button
                      onClick={() => handleSkip(event)}
                      className="flex items-center gap-1 h-7 px-2 text-[11px] font-medium bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                      title="Bỏ qua"
                    >
                      <X className="w-3 h-3" /> Bỏ qua
                    </button>
                    <button
                      onClick={() => { setActionEvent({ event, type: 'reschedule' }); setRescheduleDate(''); }}
                      className="flex items-center gap-1 h-7 px-2 text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                      title="Dời lịch"
                    >
                      <CalendarClock className="w-3 h-3" /> Dời lịch
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedDate && selectedDayEvents.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-4 flex items-center justify-between">
          <p className="text-[13px] text-slate-500">
            Không có lịch chăm sóc ngày {format(new Date(selectedDate + 'T00:00:00'), 'dd/MM/yyyy')}
          </p>
          <button
            onClick={() => setSelectedDate(null)}
            className="p-1 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      )}

      {actionEvent?.type === 'done' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
          <div className="bg-card border rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-[14px] font-semibold">Xác nhận đã chăm sóc</h2>
              <button
                onClick={() => setActionEvent(null)}
                className="p-1 hover:bg-accent rounded-md cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[13px] text-slate-600">
                Khách hàng: <strong>{actionEvent.event.customers?.customer_name}</strong>
              </p>
              <p className="text-[13px] text-slate-600">
                Nội dung: <strong>{actionEvent.event.care_schedule_steps?.name}</strong>
              </p>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium block">Ghi chú</label>
                <textarea
                  value={doneNotes}
                  onChange={e => setDoneNotes(e.target.value)}
                  placeholder="Ghi chú kết quả chăm sóc..."
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button
                onClick={() => setActionEvent(null)}
                className="h-8 px-3 text-[12px] font-medium border rounded-md hover:bg-accent transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => updateEventMutation.mutate({
                  id: actionEvent.event.id,
                  data: { status: 'done', notes: doneNotes || null },
                })}
                disabled={updateEventMutation.isPending}
                className="h-8 px-3 text-[12px] font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                {updateEventMutation.isPending ? 'Đang lưu...' : 'Xác nhận đã CS'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {actionEvent?.type === 'reschedule' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
          <div className="bg-card border rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-[14px] font-semibold">Dời lịch chăm sóc</h2>
              <button
                onClick={() => setActionEvent(null)}
                className="p-1 hover:bg-accent rounded-md cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[13px] text-slate-600">
                Khách hàng: <strong>{actionEvent.event.customers?.customer_name}</strong>
              </p>
              <p className="text-[13px] text-slate-600">
                Nội dung: <strong>{actionEvent.event.care_schedule_steps?.name}</strong>
              </p>
              <p className="text-[13px] text-slate-500">
                Lịch hiện tại: {format(new Date(actionEvent.event.scheduled_date + 'T00:00:00'), 'dd/MM/yyyy')}
              </p>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium block">Ngày mới</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                  min={todayStr}
                  className="w-full px-3 py-2 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button
                onClick={() => setActionEvent(null)}
                className="h-8 px-3 text-[12px] font-medium border rounded-md hover:bg-accent transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (!rescheduleDate) return;
                  updateEventMutation.mutate({
                    id: actionEvent.event.id,
                    data: { scheduled_date: rescheduleDate },
                  });
                }}
                disabled={updateEventMutation.isPending || !rescheduleDate}
                className="h-8 px-3 text-[12px] font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                {updateEventMutation.isPending ? 'Đang lưu...' : 'Xác nhận dời lịch'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50/50">
              <h3 className="text-[14px] font-bold text-slate-800">Thêm lịch chăm sóc</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700">Khách hàng *</label>
                <select
                  value={addForm.customer_id}
                  onChange={(e) => setAddForm({ ...addForm, customer_id: e.target.value })}
                  className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Chọn khách hàng...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_name} {c.phone_number ? `- ${c.phone_number}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700">Ngày giờ hẹn *</label>
                <DateTimePicker24h
                  value={addForm.scheduled_date}
                  onChange={(date) => setAddForm({ ...addForm, scheduled_date: date })}
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700">Nội dung chăm sóc</label>
                <input
                  type="text"
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  placeholder="Nhập nội dung cần chăm sóc..."
                  className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t bg-slate-50/50">
              <button
                onClick={() => setShowAddModal(false)}
                className="h-8 px-3 text-[12px] font-medium border border-slate-200 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => createEventMutation.mutate()}
                disabled={createEventMutation.isPending || !addForm.customer_id || !addForm.scheduled_date}
                className="h-8 px-4 text-[12px] font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                {createEventMutation.isPending ? 'Đang lưu...' : 'Lưu lại'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
