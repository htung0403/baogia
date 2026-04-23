import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { customerApi, profilesApi, pipelineApi } from '@/api/client';
import { formatDate, formatPhoneE164 } from '@/lib/utils';
import type { Customer, BoardResponse, FunnelResponse, StaffProfile } from '@/types';
import PipelineSettingsModal from './PipelineSettingsModal';
import { useToast } from '@/components/ui/toast';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
  Filter,
  Download,
  MessageSquare,
} from 'lucide-react';
import TiptapEditor from '@/components/ui/TiptapEditor';

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
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'list' | 'journey' | 'conversion'>('list');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [quickExchangeCustomer, setQuickExchangeCustomer] = useState<Customer | null>(null);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Đã xóa khách hàng');
    },
    onError: (error: any) => {
      toast.error('Không thể xóa khách hàng', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: { id?: string; body: Record<string, unknown> }) =>
      data.id ? customerApi.update(data.id, data.body) : customerApi.create(data.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      setEditingCustomer(null);
      toast.success('Lưu khách hàng thành công');
    },
    onError: (error: any) => {
      toast.error('Không thể lưu khách hàng', error?.response?.data?.message || 'Vui lòng thử lại');
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
                    <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Chăm sóc cuối</th>
                    <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Trao đổi gần nhất</th>
                    <th className="text-center py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Tài khoản</th>
                    <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Ngày tạo</th>
                    <th className="text-right py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px] w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={9} className="py-4 px-4">
                          <div className="h-6 bg-slate-50 animate-pulse rounded-lg" />
                        </td>
                      </tr>
                    ))
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-[14px] text-slate-400">
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
                        <td className="py-4 px-4 text-[12px] text-slate-400 tabular-nums">
                          {customer.last_activity_at ? formatDate(customer.last_activity_at) : '—'}
                        </td>
                        <td className="py-4 px-4 text-[12px] text-slate-500 max-w-[200px]">
                          <div className="line-clamp-2" title={customer.latest_trao_doi?.replace(/<[^>]+>/g, '') || ''}>
                            {customer.latest_trao_doi ? customer.latest_trao_doi.replace(/<[^>]+>/g, '') : '—'}
                          </div>
                        </td>
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
                              onClick={(e) => { e.stopPropagation(); setQuickExchangeCustomer(customer); }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                              title="Trao đổi nhanh"
                            >
                              <MessageSquare className="w-4 h-4" />
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

      {quickExchangeCustomer && (
        <QuickExchangeModal
          customer={quickExchangeCustomer}
          onClose={() => setQuickExchangeCustomer(null)}
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
  const navigate = useNavigate();
  const [dndMode, setDndMode]     = useState(false);  // cosmetic only
  const [showAll, setShowAll]     = useState(true);   // cosmetic only
  const [showAllKH, setShowAllKH] = useState(false);  // cosmetic only
  const [showPipelineSettings, setShowPipelineSettings] = useState(false);
  const [draggingCustomer, setDraggingCustomer] = useState<{ customerId: string; fromStageId: string } | null>(null);
  const toast = useToast();
  
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const { data: allRes } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customerApi.list({ page: 1, limit: 1000 }),
    staleTime: 5 * 60 * 1000,
  });
  const allCustomers: Customer[] = allRes?.data?.data ?? [];

  const { data: boardRes, isLoading } = useQuery({
    queryKey: ['pipeline-board'],
    queryFn: () => pipelineApi.getBoard(),
    staleTime: 60_000,
  });
  const board: BoardResponse = boardRes?.data?.data ?? { columns: [], total_customers: 0 };

  const assignMutation = useMutation({
    mutationFn: (data: { customerId: string; stageId: string }) => 
      pipelineApi.assignStage(data.customerId, data.stageId),
    onMutate: async ({ customerId, stageId }) => {
      await queryClient.cancelQueries({ queryKey: ['pipeline-board'] });
      const previousBoard = queryClient.getQueryData(['pipeline-board']);

      queryClient.setQueryData(['pipeline-board'], (old: any) => {
        const oldColumns = old?.data?.data?.columns;
        if (!Array.isArray(oldColumns)) return old;

        let movedCustomer: any = null;

        const columnsWithoutCustomer = oldColumns.map((col: any) => ({
          ...col,
          stages: (col.stages || []).map((stage: any) => {
            const customers = stage.customers || [];
            const existing = customers.find((c: any) => c.id === customerId);
            if (existing) movedCustomer = existing;
            const filtered = customers.filter((c: any) => c.id !== customerId);
            return {
              ...stage,
              customers: filtered,
              count: filtered.length,
            };
          }),
        }));

        if (!movedCustomer) return old;

        const nextColumns = columnsWithoutCustomer.map((col: any) => ({
          ...col,
          stages: (col.stages || []).map((stage: any) => {
            if (stage.id !== stageId) return stage;
            const nextCustomers = [movedCustomer, ...(stage.customers || [])];
            return {
              ...stage,
              customers: nextCustomers,
              count: nextCustomers.length,
            };
          }),
        }));

        return {
          ...old,
          data: {
            ...old.data,
            data: {
              ...old.data.data,
              columns: nextColumns,
            },
          },
        };
      });

      return { previousBoard };
    },
    onSuccess: () => {
      toast.success('Chuyển trạng thái khách hàng thành công');
    },
    onError: (_err, _vars, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(['pipeline-board'], context.previousBoard);
      }
      toast.error('Không thể cập nhật stage khách hàng', 'Vui lòng thử lại');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-board'] });
    },
  });

  const handleCustomerDragStart = (customerId: string, fromStageId: string) => {
    if (!dndMode) return;
    setDraggingCustomer({ customerId, fromStageId });
  };

  const handleCustomerDropToStage = (toStageId: string) => {
    if (!draggingCustomer) return;
    if (draggingCustomer.fromStageId !== toStageId) {
      assignMutation.mutate({ customerId: draggingCustomer.customerId, stageId: toStageId });
    }
    setDraggingCustomer(null);
  };

  const handleCustomerDragEnd = () => {
    setDraggingCustomer(null);
  };

  const saveMutation = useMutation({
    mutationFn: (data: { body: Record<string, unknown> }) => customerApi.create(data.body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-board'] });
      const newCustomerId = (res.data as any)?.data?.id;
      if (newCustomerId && selectedStage) {
        assignMutation.mutate({ customerId: newCustomerId, stageId: selectedStage });
      }
      setShowForm(false);
      setSelectedStage(null);
      toast.success('Tạo khách hàng thành công');
    },
    onError: (error: any) => {
      toast.error('Không thể tạo khách hàng', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const assignedCustomerIds = new Set<string>();
  board.columns.forEach(col => {
    col.stages.forEach(stage => {
      stage.customers?.forEach((c: any) => assignedCustomerIds.add(c.id));
    });
  });
  const unassignedCustomers = allCustomers.filter(c => !assignedCustomerIds.has(c.id));

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
            onClick={() => setShowPipelineSettings(true)}
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
            <div key={i} className="shrink-0 w-[300px] h-[500px] bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-4 pb-4 items-start w-max">
            {board.columns.map(col => (
              <div key={col.id} className="flex flex-col gap-3 min-w-[300px] w-[300px] shrink-0">
                <div className="text-[14px] font-bold text-slate-700 px-1 border-b border-slate-200 pb-2">
                  {col.name}
                </div>
                <div className="flex flex-col gap-4">
                  {col.stages.map(stage => (
                    <KanbanStageBlock 
                      key={stage.id} 
                      stage={stage}
                      allCustomers={unassignedCustomers}
                      dndEnabled={dndMode}
                      onAssign={(cId, sId) => assignMutation.mutate({ customerId: cId, stageId: sId })}
                      onCreateNew={(sId) => { setSelectedStage(sId); setShowForm(true); }}
                      onCustomerClick={(id) => navigate(`/admin/customers/${id}`)}
                      onCustomerDragStart={handleCustomerDragStart}
                      onCustomerDropToStage={handleCustomerDropToStage}
                      onCustomerDragEnd={handleCustomerDragEnd}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {showForm && (
        <CustomerFormModal
          customer={null}
          onSave={(data) => saveMutation.mutate({ body: data })}
          onClose={() => { setShowForm(false); setSelectedStage(null); }}
          isLoading={saveMutation.isPending}
        />
      )}

      {showPipelineSettings && (
        <PipelineSettingsModal onClose={() => setShowPipelineSettings(false)} />
      )}
    </div>
  );
}

function KanbanStageBlock({ 
  stage, 
  allCustomers, 
  dndEnabled,
  onAssign, 
  onCreateNew,
  onCustomerClick,
  onCustomerDragStart,
  onCustomerDropToStage,
  onCustomerDragEnd,
}: { 
  stage: any, 
  allCustomers: Customer[], 
  dndEnabled: boolean,
  onAssign: (cId: string, sId: string) => void, 
  onCreateNew: (sId: string) => void,
  onCustomerClick: (id: string) => void,
  onCustomerDragStart: (customerId: string, fromStageId: string) => void,
  onCustomerDropToStage: (toStageId: string) => void,
  onCustomerDragEnd: () => void,
}) {
  const [isDropOver, setIsDropOver] = useState(false);

  return (
    <div className="flex flex-col gap-2 w-full shrink-0">
      <div className="flex flex-col bg-slate-100/50 border border-slate-200 rounded-xl">
        <div className={`${BG_COLOR[stage.color] ?? 'bg-slate-50'} border-t-4 ${BORDER_COLOR[stage.color] ?? 'border-slate-400'} p-3 border-b border-slate-200 rounded-t-xl`}>
          <div className="flex justify-between items-start">
            <p className="text-[13px] font-bold text-slate-800 leading-tight">{stage.name}</p>
            <span className="text-[11px] font-bold bg-white px-2 py-0.5 rounded-full text-slate-600 shadow-sm">
              {stage.count}
            </span>
          </div>
          {stage.description && (
            <p className="text-[11px] text-slate-500 mt-1 leading-tight line-clamp-2">{stage.description}</p>
          )}
        </div>
        
        <div
          className={`flex flex-col gap-2 p-2 min-h-[100px] transition-colors ${isDropOver ? 'bg-indigo-50/70' : ''}`}
          onDragOver={(e) => {
            if (!dndEnabled) return;
            e.preventDefault();
            setIsDropOver(true);
          }}
          onDragLeave={() => {
            if (!dndEnabled) return;
            setIsDropOver(false);
          }}
          onDrop={(e) => {
            if (!dndEnabled) return;
            e.preventDefault();
            setIsDropOver(false);
            onCustomerDropToStage(stage.id);
          }}
        >
          {stage.customers && stage.customers.length > 0 && stage.customers.map((c: any) => (
            <div 
              key={c.id} 
              draggable={dndEnabled}
              onDragStart={() => onCustomerDragStart(c.id, stage.id)}
              onDragEnd={onCustomerDragEnd}
              onClick={() => onCustomerClick(c.id)}
              className={`bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm flex flex-col gap-0.5 hover:border-indigo-300 hover:shadow transition-all ${dndEnabled ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
            >
              <span className="text-[13px] font-bold text-slate-800">{c.customer_name}</span>
              {c.phone_number && <span className="text-[11px] text-slate-500">{c.phone_number}</span>}
              {c.email && <span className="text-[11px] text-slate-500">{c.email}</span>}
            </div>
          ))}
          
          <StageAddButton 
            stageId={stage.id}
            allCustomers={allCustomers}
            onAssign={onAssign}
            onCreateNew={onCreateNew}
          />
        </div>
      </div>
    </div>
  );
}

function StageAddButton({ 
  stageId, 
  allCustomers, 
  onAssign, 
  onCreateNew 
}: { 
  stageId: string, 
  allCustomers: Customer[], 
  onAssign: (cId: string, sId: string) => void, 
  onCreateNew: (sId: string) => void 
}) {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-center h-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg border border-dashed border-slate-300 text-xl transition-colors cursor-pointer"
      >
        +
      </button>
      
      {open && (
        <div className="absolute top-9 left-0 w-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-2 flex flex-col gap-2">
          <button 
            onClick={() => { setOpen(false); onCreateNew(stageId); }}
            className="text-left text-[13px] px-2 py-1.5 hover:bg-slate-50 rounded text-blue-600 font-medium cursor-pointer"
          >
            + Tạo mới khách hàng
          </button>
          
          <div className="h-px bg-slate-100 my-1" />
          
          <select 
            className="w-full border border-slate-200 rounded p-1.5 text-[13px] text-slate-700 outline-none cursor-pointer bg-white"
            onChange={(e) => {
              if (e.target.value) {
                onAssign(e.target.value, stageId);
                setOpen(false);
                e.target.value = '';
              }
            }}
            defaultValue=""
          >
            <option value="" disabled>Chọn KH hiện có...</option>
            {allCustomers.map(c => (
              <option key={c.id} value={c.id}>{c.customer_name}</option>
            ))}
          </select>
        </div>
      )}
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

// ============================================================
// Quick Exchange Modal
// ============================================================
function QuickExchangeModal({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [content, setContent] = useState('');

  const createActivity = useMutation({
    mutationFn: (htmlContent: string) =>
      pipelineApi.createActivity({
        customer_id: customer.id,
        activity_type: 'trao_doi',
        title: 'Trao đổi',
        description: htmlContent,
      }),
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['activities', customer.id] });
      toast.success('Đã gửi trao đổi nhanh');
      onClose();
    },
    onError: (error: any) => {
      toast.error('Không thể gửi trao đổi', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim() || content === '<p></p>') return;
    createActivity.mutate(content);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-slate-800">
                Trao đổi nhanh
              </h2>
              <p className="text-[12px] text-slate-500">
                KH: {customer.customer_name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
            <TiptapEditor 
              content={content} 
              onChange={setContent} 
              placeholder="Nhập nội dung trao đổi..."
              className="border-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-[13px] font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={createActivity.isPending || !content.trim() || content === '<p></p>'}
              className="h-9 px-5 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
            >
              {createActivity.isPending ? 'Đang gửi...' : 'Gửi trao đổi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
