import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerGroupApi } from '@/api/client';
import type { CustomerGroup } from '@/types';
import { useToast } from '@/components/ui/toast';
import { Plus, Edit, Trash2, X } from 'lucide-react';

export default function CustomerGroupsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['customer-groups'],
    queryFn: () => customerGroupApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const groups: CustomerGroup[] = res?.data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customerGroupApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-groups'] });
      toast.success('Đã xóa nhóm khách hàng');
    },
    onError: (error: any) => {
      toast.error('Không thể xóa nhóm', error?.response?.data?.message || 'Nhóm có thể đang được sử dụng');
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: { id?: string; body: Record<string, unknown> }) =>
      data.id ? customerGroupApi.update(data.id, data.body) : customerGroupApi.create(data.body as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-groups'] });
      setShowForm(false);
      setEditingGroup(null);
      toast.success('Lưu nhóm khách hàng thành công');
    },
    onError: (error: any) => {
      toast.error('Không thể lưu nhóm', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Xóa nhóm "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Nhóm khách hàng</h1>
          <p className="text-[14px] text-slate-500 mt-1">Quản lý phân nhóm khách hàng ({groups.length})</p>
        </div>
        <button
          onClick={() => { setEditingGroup(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Thêm nhóm
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b bg-slate-50/50">
                <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Tên nhóm</th>
                <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Mã nhóm</th>
                <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Mô tả</th>
                <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Thứ tự</th>
                <th className="text-right py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px] w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="py-4 px-4">
                      <div className="h-6 bg-slate-50 animate-pulse rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-[14px] text-slate-400">
                    Chưa có nhóm khách hàng nào
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <tr key={group.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-4 px-4 font-bold text-slate-900">{group.name}</td>
                    <td className="py-4 px-4">
                      {group.code ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {group.code}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-slate-500 max-w-[300px]">
                      <div className="line-clamp-2">{group.description || '—'}</div>
                    </td>
                    <td className="py-4 px-4 text-slate-500 tabular-nums">{group.sort_order}</td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingGroup(group); setShowForm(true); }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(group.id, group.name)}
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
      </div>

      {showForm && (
        <CustomerGroupFormModal
          group={editingGroup}
          onSave={(data) => saveMutation.mutate({ id: editingGroup?.id, body: data })}
          onClose={() => { setShowForm(false); setEditingGroup(null); }}
          isLoading={saveMutation.isPending}
        />
      )}
    </div>
  );
}

function CustomerGroupFormModal({
  group,
  onSave,
  onClose,
  isLoading,
}: {
  group: CustomerGroup | null;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const isEdit = !!group;
  const [formData, setFormData] = useState({
    name: group?.name ?? '',
    code: group?.code ?? '',
    description: group?.description ?? '',
    sort_order: group?.sort_order ?? 0,
  });

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      code: formData.code || null,
      description: formData.description || null,
      sort_order: Number(formData.sort_order),
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-[14px] font-semibold">
            {isEdit ? 'Sửa nhóm khách hàng' : 'Thêm nhóm khách hàng'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-md cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Tên nhóm *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              placeholder="VD: Đại lý cấp 1"
              className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Mã nhóm</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => updateField('code', e.target.value)}
                placeholder="VD: DL1"
                className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Thứ tự</label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) => updateField('sort_order', e.target.value)}
                min="0"
                className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Mô tả</label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={2}
              placeholder="Mô tả về nhóm khách hàng này..."
              className="w-full px-3 py-2 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

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
    </div>,
    document.body
  );
}
