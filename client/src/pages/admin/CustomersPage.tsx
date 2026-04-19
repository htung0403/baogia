import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { customerApi } from '@/api/client';
import { formatDate, formatPhoneE164 } from '@/lib/utils';
import type { Customer } from '@/types';
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
} from 'lucide-react';

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['customers', { page, search }],
    queryFn: () => customerApi.list({ page, limit: 20, ...(search ? { search } : {}) }),
    staleTime: 5 * 60 * 1000,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Khách hàng</h1>
          <p className="text-[14px] text-slate-500 mt-1">Quản lý danh sách khách hàng ({meta?.total ?? 0})</p>
        </div>
        <button
          onClick={() => { setEditingCustomer(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Thêm khách hàng
        </button>
      </div>

      {/* Search & Stats */}
      <div className="flex flex-col sm:flex-row gap-3">
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

      {/* Customer Form Modal */}
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
// Customer Form Modal
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
