import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { priceListApi } from '@/api/client';
import { formatDate } from '@/lib/utils';
import type { PriceList } from '@/types';
import {
  Plus,
  Search,
  Trash2,
  FileSpreadsheet,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowUpRight,
  Clock,
  FilePenLine,
  Rocket,
  Archive,
} from 'lucide-react';

export default function PriceListsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: res, isLoading } = useQuery({
    queryKey: ['price-lists', { page, search, status: statusFilter }],
    queryFn: () => priceListApi.list({
      page,
      limit: 20,
      ...(search ? { search } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    staleTime: 60 * 1000,
  });

  const priceLists: (PriceList & { version_count: number; customer_count: number })[] = res?.data?.data ?? [];
  const meta = res?.data?.meta;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => priceListApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price-lists'] }),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; description?: string }) => priceListApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['price-lists'] });
      setShowCreateForm(false);
      if (res.data?.data?.id) {
        navigate(`/admin/price-lists/${res.data.data.id}`);
      }
    },
  });


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bảng giá</h1>
          <p className="text-[14px] text-slate-500 mt-1">Quản lý & thiết lập các bảng báo giá ({meta?.total ?? 0})</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Tạo bảng giá
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên bảng giá..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-10 pl-10 pr-4 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
        <div className="flex w-full sm:w-auto items-center gap-1 p-1 border border-slate-200 rounded-lg bg-white">
          {[
            { value: '', label: 'Tất cả' },
            { value: 'draft', label: 'Nháp', icon: FilePenLine },
            { value: 'published', label: 'Xuất bản', icon: Rocket },
            { value: 'archived', label: 'Lưu trữ', icon: Archive },
          ].map((opt) => {
            const Icon = opt.icon;
            const active = statusFilter === opt.value;
            return (
              <button
                key={opt.value || 'all'}
                type="button"
                onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                className={`h-8 px-3 text-[12px] font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : priceLists.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-slate-300 rounded-xl">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <FileSpreadsheet className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-[15px] font-bold text-slate-900">Chưa có bảng giá nào</h3>
          <p className="text-[13px] text-slate-400 mt-1 max-w-[280px] mx-auto">Hãy bắt đầu bằng việc tạo bảng giá đầu tiên để gửi cho khách hàng của bạn.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {priceLists.map((pl) => (
            <div
              key={pl.id}
              className="group relative bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/5 transition-all overflow-hidden"
              onClick={() => navigate(`/admin/price-lists/${pl.id}`)}
            >
              {/* Status Indicator Bar */}
              <div className={`absolute top-0 left-0 w-full h-1 ${
                pl.status === 'published' ? 'bg-emerald-500' : 
                pl.status === 'draft' ? 'bg-amber-500' : 'bg-slate-400'
              }`} />

              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                    {pl.title}
                  </h3>
                  {pl.description ? (
                    <p className="text-[12px] text-slate-500 mt-1 line-clamp-2 min-h-[32px]">
                      {pl.description}
                    </p>
                  ) : (
                    <p className="text-[12px] text-slate-300 italic mt-1 min-h-[32px]">Không có mô tả</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 ml-3 shrink-0">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                    pl.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                    pl.status === 'draft' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                    'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    {pl.status === 'draft' ? 'Nháp' : pl.status === 'published' ? 'Xuất bản' : 'Lưu trữ'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Phiên bản</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-5 h-5 rounded bg-white flex items-center justify-center border border-slate-200 shadow-sm">
                      <FileSpreadsheet className="w-3 h-3 text-indigo-500" />
                    </div>
                    <span className="text-[13px] font-bold text-slate-700">{pl.version_count}</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Khách hàng</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-5 h-5 rounded bg-white flex items-center justify-center border border-slate-200 shadow-sm">
                      <Users className="w-3 h-3 text-emerald-500" />
                    </div>
                    <span className="text-[13px] font-bold text-slate-700">{pl.customer_count}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span className="text-[11px] font-medium tabular-nums">
                    {formatDate(pl.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      if (confirm(`Xóa bảng giá "${pl.title}"?`)) deleteMutation.mutate(pl.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                    title="Xóa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="w-7 h-7 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-muted-foreground">
            Trang {meta.page} / {meta.totalPages}
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

      {/* Create Form Modal */}
      {showCreateForm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border rounded-lg shadow-lg w-full max-w-md mx-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold">Tạo bảng giá mới</h2>
              <button onClick={() => setShowCreateForm(false)} className="p-1 hover:bg-accent rounded-md cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                createMutation.mutate({
                  title: form.get('title') as string,
                  description: (form.get('description') as string) || undefined,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Tiêu đề *</label>
                <input
                  name="title"
                  required
                  placeholder="VD: Bảng giá Q2/2026"
                  className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Mô tả</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Mô tả ngắn..."
                  className="w-full px-3 py-2 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="h-8 px-3 text-[12px] font-medium border rounded-md hover:bg-accent cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="h-8 px-3 text-[12px] font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
                >
                  {createMutation.isPending ? 'Đang tạo...' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
