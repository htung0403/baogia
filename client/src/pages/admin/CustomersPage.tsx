import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { customerApi, profilesApi, pipelineApi } from '@/api/client';
import { formatDate, formatPhoneE164 } from '@/lib/utils';
import type { Customer, BoardResponse, FunnelResponse, StaffProfile, PipelineColumn } from '@/types';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
  ExternalLink,
  Filter,
  Download,
} from 'lucide-react';

// ============================================================
// Color maps: MUST be static objects (not dynamic strings)
// so Tailwind includes them in the build output
// ============================================================
const BORDER_COLOR: Record<string, string> = {
  blue: 'border-blue-500', indigo: 'border-indigo-500', green: 'border-green-500',
  cyan: 'border-cyan-500', orange: 'border-orange-500', purple: 'border-purple-500',
  teal: 'border-teal-500', amber: 'border-amber-500', red: 'border-red-500',
  yellow: 'border-yellow-400', slate: 'border-slate-400', emerald: 'border-emerald-500',
};
const BG_COLOR: Record<string, string> = {
  blue: 'bg-blue-50', indigo: 'bg-indigo-50', green: 'bg-green-50',
  cyan: 'bg-cyan-50', orange: 'bg-orange-50', purple: 'bg-purple-50',
  teal: 'bg-teal-50', amber: 'bg-amber-50', red: 'bg-red-50',
  yellow: 'bg-yellow-50', slate: 'bg-slate-50', emerald: 'bg-emerald-50',
};

// ============================================================
// Main Page
// ============================================================
export default function CustomersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'list' | 'journey' | 'conversion'>('list');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Staff list for assigned_to filter (shared cache with Tab 3)
  const { data: staffRes } = useQuery({
    queryKey: ['profiles-staff'],
    queryFn: () => profilesApi.list({ role: 'admin,staff' }),
    staleTime: 5 * 60 * 1000,
  });
  const staffList: StaffProfile[] = staffRes?.data?.data ?? [];

  // Customer list query (only runs when on Tab 1)
  const { data: res, isLoading } = useQuery({
    queryKey: ['customers', { page, search, assignedToFilter }],
    queryFn: () => customerApi.list({
      page, limit: 20,
      ...(search ? { search } : {}),
      ...(assignedToFilter ? { assigned_to: assignedToFilter } : {}),
    }),
    staleTime: 5 * 60 * 1000,
    enabled: activeTab === 'list',
  });

  const customers: Customer[] = res?.data?.data ?? [];
  const meta = res?.data?.meta;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customerApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });

  const saveMutation = useMutation({
    mutationFn: (data: { id?: string; body: Record<string, unknown> }) =>
      data.id ? customerApi.update(data.id, data.body) : customerApi.create(data.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      setEditingCustomer(null);
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Xóa khách hàng "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Khách hàng</h1>

      {/* Tab Bar — same pattern as AnalyticsPage.tsx */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
        {(['list', 'journey', 'conversion'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[13px] font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === tab
                ? 'bg-white shadow-sm text-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}>
            {tab === 'list' ? 'Danh sách khách hàng'
              : tab === 'journey' ? 'Hành trình khách hàng'
              : 'Tỷ lệ chuyển đổi'}
          </button>
        ))}
      </div>

      {/* Tab 1: Customer List */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          <p className="text-[14px] text-slate-500 mt-1">Quản lý danh sách khách hàng ({meta?.total ?? 0})</p>

          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên khách hàng, số điện thoại..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full h-10 pl-10 pr-4 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Người phụ trách filter */}
              <select
                value={assignedToFilter}
                onChange={(e) => { setAssignedToFilter(e.target.value); setPage(1); }}
                className="h-10 px-3 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="">Tất cả người phụ trách</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.display_name}</option>
                ))}
              </select>
            </div>

            {/* Thêm mới button */}
            <button
              onClick={() => { setEditingCustomer(null); setShowForm(true); }}
              className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              Thêm khách hàng
            </button>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b bg-slate-50/50">
                    <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Khách hàng</th>
                    <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Số điện thoại</th>
                    <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Email</th>
                    <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Địa chỉ</th>
                    <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Người phụ trách</th>
                    <th className="text-center py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Tài khoản</th>
                    <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Ngày tạo</th>
                    <th className="text-right py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px] w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={8} className="py-4 px-4">
                          <div className="h-6 bg-slate-50 animate-pulse rounded-lg" />
                        </td>
                      </tr>
                    ))
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-[14px] text-slate-400">
                        Không tìm thấy khách hàng nào
                      </td>
                    </tr>
                  ) : (
                    customers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => navigate(`/admin/customers/${customer.id}`)}>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                              <Building2 className="w-4.5 h-4.5 text-indigo-600" />
                            </div>
                            <span className="font-bold text-slate-900">{customer.customer_name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-slate-500 tabular-nums">{customer.phone_number || '-'}</td>
                        <td className="py-4 px-4 text-slate-500">{customer.email || '-'}</td>
                        <td className="py-4 px-4 text-slate-500">{customer.address || '-'}</td>
                        <td className="py-4 px-4 text-slate-500">{customer.assigned_profile?.display_name || '-'}</td>
                        <td className="py-4 px-4 text-center">
                          {customer.profile_id ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <div className="w-1 h-1 rounded-full bg-emerald-500" />
                              Đã tạo
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              Chưa có
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-[12px] text-slate-400 tabular-nums">
                          {formatDate(customer.created_at)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/admin/customers/${customer.id}`); }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                              title="Xem chi tiết"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingCustomer(customer); setShowForm(true); }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                              title="Chỉnh sửa"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(customer.id, customer.customer_name); }}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t">
                <p className="text-[12px] text-muted-foreground">
                  Trang {meta.page} / {meta.totalPages} ({meta.total} khách hàng)
                </p>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1 hover:bg-accent rounded-md disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                    disabled={page === meta.totalPages}
                    className="p-1 hover:bg-accent rounded-md disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Journey */}
      {activeTab === 'journey' && <CustomerJourneyTab />}

      {/* Tab 3: Conversion */}
      {activeTab === 'conversion' && <ConversionFunnelTab staffList={staffList} />}

      {/* Customer Form Modal — UNCHANGED */}
      {showForm && (
        <CustomerFormModal
          customer={editingCustomer}
          onSave={(data) => saveMutation.mutate({ id: editingCustomer?.id, body: data })}
          onClose={() => { setShowForm(false); setEditingCustomer(null); }}
          isLoading={saveMutation.isPending}
        />
      )}
    </div>
  );
}

// ============================================================
// Shared: ToggleSwitch
// ============================================================
function ToggleSwitch({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button type="button" role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
          checked ? 'bg-indigo-600' : 'bg-slate-300'
        }`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-1'
        }`} />
      </button>
      <span className="text-[13px] text-slate-600">{label}</span>
    </label>
  );
}

// ============================================================
// Tab 2: Customer Journey (Hành trình khách hàng)
// ============================================================
function CustomerJourneyTab() {
  const [dndMode, setDndMode]     = useState(false);  // cosmetic only
  const [showAll, setShowAll]     = useState(true);   // cosmetic only
  const [showAllKH, setShowAllKH] = useState(false);  // cosmetic only

  const { data: boardRes, isLoading } = useQuery({
    queryKey: ['pipeline-board'],
    queryFn: () => pipelineApi.getBoard(),
    staleTime: 60_000,
  });
  const board: BoardResponse = boardRes?.data?.data ?? { columns: [], total_customers: 0 };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-[13px] font-bold text-slate-700">Hành trình khách hàng</span>
        <ToggleSwitch label="Bật / Tắt chế độ kéo thả" checked={dndMode} onChange={setDndMode} />
        <ToggleSwitch label="Tất cả" checked={showAll} onChange={setShowAll} />
        <ToggleSwitch label="Tất cả KH" checked={showAllKH} onChange={setShowAllKH} />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => alert('Tính năng đang phát triển')}
            className="h-8 px-3 text-[12px] font-medium border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Sửa tiện ích
          </button>
        </div>
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-4 min-w-[1000px] w-full">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex-1 min-w-[120px] max-w-sm h-48 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-3 min-w-[1000px] w-full pb-4">
            {board.columns.map(col => <KanbanColumn key={col.id} column={col} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ column }: { column: PipelineColumn }) {
  return (
    <div className="flex flex-col gap-2 flex-1 min-w-[120px] max-w-sm">
      <div className="text-[12px] font-bold text-slate-600 px-1 pb-1 border-b border-slate-200">
        {column.name}
      </div>
      {column.stages.map(stage => (
        <div key={stage.id}
          className={`${BG_COLOR[stage.color] ?? 'bg-slate-50'} border-l-4 ${BORDER_COLOR[stage.color] ?? 'border-slate-400'} rounded-lg p-3`}>
          <p className="text-[12px] font-bold text-slate-800 leading-tight">{stage.name}</p>
          {stage.description && (
            <p className="text-[11px] text-slate-500 mt-0.5 leading-tight line-clamp-2">{stage.description}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[20px] font-bold text-slate-900">{stage.count}</span>
            <span className="text-[11px] text-slate-400">({stage.percent.toFixed(2)}%)</span>
          </div>
        </div>
      ))}
      <button className="flex items-center justify-center h-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg border border-dashed border-slate-300 text-xl transition-colors cursor-pointer">
        +
      </button>
    </div>
  );
}

// ============================================================
// Tab 3: Conversion Funnel (Tỷ lệ chuyển đổi)
// ============================================================
function ConversionFunnelTab({ staffList }: { staffList: StaffProfile[] }) {
  const [assignedTo, setAssignedTo] = useState('');
  const [period, setPeriod] = useState<'this_month' | 'last_month' | 'all'>('this_month');
  const [allKH, setAllKH] = useState(false);

  const queryParams = allKH
    ? { all_kh: true }
    : { ...(assignedTo ? { assigned_to: assignedTo } : {}), period };

  const { data: funnelRes, isLoading } = useQuery({
    queryKey: ['pipeline-funnel', queryParams],
    queryFn: () => pipelineApi.getFunnel(queryParams),
    staleTime: 30_000,
  });
  const funnel: FunnelResponse | null = funnelRes?.data?.data ?? null;

  return (
    <div className="space-y-4">
      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-[13px] font-bold text-slate-700">
          <Filter className="w-4 h-4" />
          Lọc báo cáo
        </div>
        {!allKH && (
          <>
            <select value={assignedTo} onChange={e => { setAssignedTo(e.target.value); }}
              className="h-8 px-3 text-[13px] border border-slate-200 rounded-lg bg-white cursor-pointer">
              <option value="">Chọn người phụ trách</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
            </select>
            <select value={period} onChange={e => setPeriod(e.target.value as 'this_month' | 'last_month' | 'all')}
              className="h-8 px-3 text-[13px] border border-slate-200 rounded-lg bg-white cursor-pointer">
              <option value="this_month">🕐 Thời gian: Tháng này</option>
              <option value="last_month">Tháng trước</option>
              <option value="all">Tất cả</option>
            </select>
          </>
        )}
        <ToggleSwitch label="Tất cả KH" checked={allKH} onChange={setAllKH} />
        <div className="ml-auto">
          <button className="h-8 w-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer" title="Tải xuống">
            <Download className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      <p className="text-[14px] font-bold text-slate-700">Tỷ lệ chuyển đổi</p>

      {/* Funnel steps */}
      {isLoading ? (
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-1 min-w-[180px] h-64 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : funnel ? (
        <div className="flex gap-2 overflow-x-auto">
          <FunnelStep step={1} name="Khách hàng mới" count={funnel.new_customers.count}
            rows={funnel.new_customers.by_source.map(s => ({
              label: s.source ?? 'Không rõ',
              value: `${s.count} (${s.pct.toFixed(2)} %)`,
            }))} />
          <FunnelStep step={2} name="Tương tác" count={funnel.interactions.count}
            rows={funnel.interactions.by_type.map(t => ({ label: t.type, value: t.count }))} />
          <FunnelStep step={3} name="Hoạt động" count={funnel.activities.count}
            rows={[
              { label: 'Theo dự án', value: '' },
              ...funnel.activities.by_project.slice(0,5).map(p => ({ label: p.project ?? 'Không rõ', value: p.count })),
              { label: 'Theo loại công việc', value: '' },
              ...funnel.activities.by_type.map(t => ({ label: t.type, value: t.count })),
            ]} />
          <FunnelStep step={4} name="Đơn hàng" count={funnel.orders.count}
            rows={[
              { label: 'Đơn hàng', value: funnel.orders.count },
              { label: 'Báo giá', value: funnel.orders.quotes },
              { label: 'Hợp đồng', value: funnel.orders.contracts },
              { label: 'Tỷ lệ số ĐH / Số KH mua hàng', value: '' },
              { label: 'Tỷ lệ', value: funnel.orders.ratio.toFixed(2) },
              { label: 'Tần suất mua hàng', value: '' },
              { label: 'Một lần', value: funnel.orders.once },
              { label: 'Nhiều lần', value: funnel.orders.multiple },
              { label: 'Thanh toán', value: '' },
              { label: 'Đã thanh toán', value: funnel.orders.paid },
              { label: 'Chưa thanh toán', value: funnel.orders.unpaid },
            ]} />
          <FunnelStep step={5} name="Doanh thu" count={funnel.revenue.total} isRevenue
            rows={[
              ...funnel.revenue.by_source.map(s => ({
                label: s.source ?? 'Không rõ',
                value: `${s.amount?.toLocaleString('vi-VN') ?? 0} (${s.pct.toFixed(2)}%)`,
              })),
              { label: 'Thanh toán', value: '' },
              { label: 'Đã thanh toán',   value: `${funnel.revenue.paid.toLocaleString('vi-VN')} (${funnel.revenue.total ? ((funnel.revenue.paid/funnel.revenue.total)*100).toFixed(2) : 0}%)` },
              { label: 'Chưa thanh toán', value: `${funnel.revenue.unpaid.toLocaleString('vi-VN')} (${funnel.revenue.total ? ((funnel.revenue.unpaid/funnel.revenue.total)*100).toFixed(2) : 0}%)` },
            ]} />
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400">Chưa có dữ liệu</div>
      )}
    </div>
  );
}

function FunnelStep({ step, name, count, rows, isRevenue }: {
  step: number;
  name: string;
  count: number;
  rows: { label: string; value: string | number }[];
  isRevenue?: boolean;
}) {
  return (
    <div className={`flex-1 min-w-[200px] rounded-xl p-4 flex flex-col gap-3 ${
      isRevenue ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200'
    }`}>
      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
          isRevenue ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-600'
        }`}>{step}</span>
        <span className={`text-[13px] font-bold ${isRevenue ? 'text-white' : 'text-slate-700'}`}>{name}</span>
      </div>
      <p className={`text-[24px] font-bold tabular-nums ${isRevenue ? 'text-white' : 'text-slate-900'}`}>
        {isRevenue ? count.toLocaleString('vi-VN') : count}
      </p>
      <div className="space-y-1 mt-auto">
        {rows.map((row, i) =>
          row.value === '' ? (
            <p key={i} className={`text-[11px] font-bold uppercase tracking-wider pt-2 ${isRevenue ? 'text-slate-300' : 'text-slate-400'}`}>
              {row.label}
            </p>
          ) : (
            <div key={i} className="flex justify-between text-[12px]">
              <span className={isRevenue ? 'text-slate-300' : 'text-slate-500'}>{row.label}</span>
              <span className={`font-bold ${isRevenue ? 'text-white' : 'text-slate-800'}`}>{row.value}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ============================================================
// Customer Form Modal — DO NOT MODIFY THIS SECTION
// ============================================================
function CustomerFormModal({
  customer,
  onSave,
  onClose,
  isLoading,
}: {
  customer: Customer | null;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const isEdit = !!customer;
  const [formData, setFormData] = useState({
    customer_name: customer?.customer_name ?? '',
    phone_number: customer?.phone_number ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    notes: customer?.notes ?? '',
    create_account: false,
    account_phone: '',
    account_password: '',
  });

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      
      // Auto-fill logic: If enabling account creation and account_phone is empty, 
      // take the value from phone_number
      if (field === 'create_account' && value === true && !next.account_phone) {
        next.account_phone = prev.phone_number;
      }
      
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = {
      customer_name: formData.customer_name,
      phone_number: formData.phone_number || null,
      email: formData.email || null,
      address: formData.address || null,
      notes: formData.notes || null,
    };

    if (!isEdit && formData.create_account) {
      data.create_account = true;
      data.account_phone = formatPhoneE164(formData.account_phone);
      data.account_password = formData.account_password;
    }

    onSave(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-[14px] font-semibold">
            {isEdit ? 'Sửa khách hàng' : 'Thêm khách hàng mới'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-md cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Tên khách hàng *</label>
            <input
              type="text"
              value={formData.customer_name}
              onChange={(e) => updateField('customer_name', e.target.value)}
              required
              className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Số điện thoại</label>
              <input
                type="text"
                value={formData.phone_number}
                onChange={(e) => updateField('phone_number', e.target.value)}
                className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Địa chỉ</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
              className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Ghi chú</label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* Create Account Option (only for new customers) */}
          {!isEdit && (
            <div className="border rounded-md p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.create_account}
                  onChange={(e) => updateField('create_account', e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-border"
                />
                <span className="text-[13px] font-medium">Tạo tài khoản đăng nhập</span>
              </label>

              {formData.create_account && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-muted-foreground">SĐT đăng nhập *</label>
                      <input
                        type="tel"
                        value={formData.account_phone}
                        onChange={(e) => updateField('account_phone', e.target.value)}
                        required={formData.create_account}
                        className="w-full h-7 px-2.5 text-[12px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Mật khẩu *</label>
                    <input
                      type="password"
                      value={formData.account_password}
                      onChange={(e) => updateField('account_password', e.target.value)}
                      required={formData.create_account}
                      minLength={6}
                      className="w-full h-7 px-2.5 text-[12px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 text-[12px] font-medium border rounded-md hover:bg-accent transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="h-8 px-3 text-[12px] font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer"
            >
              {isLoading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
