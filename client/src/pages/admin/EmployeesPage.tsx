import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, profilesApi } from '@/api/client';
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/store/auth.store';
import type { StaffProfile } from '@/types';
import { Edit, MoreHorizontal, Plus, Search, Shield, Trash2, UserCheck, UserX, X } from 'lucide-react';

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.profile.role === 'admin';

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<StaffProfile | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const { data: profilesRes, isLoading } = useQuery({
    queryKey: ['profiles-admin', { showInactive, search }],
    queryFn: () =>
      profilesApi.list({
        role: 'admin,staff',
        include_inactive: showInactive,
        ...(search.trim() ? { search: search.trim() } : {}),
      }),
    staleTime: 60_000,
  });

  const employees: StaffProfile[] = profilesRes?.data?.data ?? [];

  const updateMutation = useMutation({
    mutationFn: (params: { id: string; data: { display_name?: string; role?: 'admin' | 'staff'; is_active?: boolean } }) =>
      profilesApi.update(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles-admin'] });
      queryClient.invalidateQueries({ queryKey: ['profiles-staff'] });
      toast.success('Cập nhật nhân viên thành công');
    },
    onError: (error: any) => {
      toast.error('Không thể cập nhật nhân viên', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const activeCount = useMemo(() => employees.filter((p) => p.is_active).length, [employees]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Nhân viên</h1>
          <p className="text-[14px] text-slate-500 mt-1">Quản lý tài khoản admin/staff ({employees.length})</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Thêm nhân viên
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Đang hoạt động</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Tổng tài khoản</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">{employees.length}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên nhân viên..."
              className="w-full h-9 pl-9 pr-3 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-[13px] text-slate-600 select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            Hiển thị tài khoản đã vô hiệu hóa
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b bg-slate-50/50">
                <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Tên hiển thị</th>
                <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Vai trò</th>
                <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Trạng thái</th>
                <th className="text-right py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px] w-24">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={4} className="py-4 px-4"><div className="h-6 bg-slate-50 animate-pulse rounded-lg" /></td>
                  </tr>
                ))
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-[14px] text-slate-400">Không có nhân viên nào</td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4 font-semibold text-slate-800">{employee.display_name}</td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${employee.role === 'admin' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200'}`}>
                        <Shield className="w-3 h-3" />
                        {employee.role === 'admin' ? 'Admin' : 'Staff'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {employee.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <UserCheck className="w-3 h-3" />
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                          <UserX className="w-3 h-3" />
                          Vô hiệu
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="relative flex justify-end">
                        <button
                          disabled={!isAdmin || updateMutation.isPending}
                          onClick={() => setOpenActionMenuId((prev) => (prev === employee.id ? null : employee.id))}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {openActionMenuId === employee.id && (
                          <div className="absolute right-0 top-9 z-20 w-48 rounded-lg border border-slate-200 bg-white shadow-lg p-1.5 space-y-1">
                            <button
                              disabled={employee.id === currentUser?.id}
                              onClick={() => {
                                setEditingEmployee(employee);
                                setOpenActionMenuId(null);
                              }}
                              className="w-full h-8 px-2.5 text-left text-[12px] rounded-md hover:bg-indigo-50 text-slate-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              Sửa
                            </button>

                            <button
                              disabled={employee.id === currentUser?.id || !employee.is_active}
                              onClick={() => {
                                if (!confirm(`Xóa nhân viên "${employee.display_name}"?`)) return;
                                updateMutation.mutate({ id: employee.id, data: { is_active: false } });
                                setOpenActionMenuId(null);
                              }}
                              className="w-full h-8 px-2.5 text-left text-[12px] rounded-md hover:bg-rose-50 text-rose-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Xóa
                            </button>

                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateEmployeeModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['profiles-admin'] });
            queryClient.invalidateQueries({ queryKey: ['profiles-staff'] });
          }}
        />
      )}

      {editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
          isLoading={updateMutation.isPending}
          onClose={() => setEditingEmployee(null)}
          onSave={(data) => {
            updateMutation.mutate(
              { id: editingEmployee.id, data },
              { onSuccess: () => setEditingEmployee(null) }
            );
          }}
        />
      )}
    </div>
  );
}

function EditEmployeeModal({
  employee,
  isLoading,
  onClose,
  onSave,
}: {
  employee: StaffProfile;
  isLoading: boolean;
  onClose: () => void;
  onSave: (data: { display_name?: string; role?: 'admin' | 'staff'; is_active?: boolean }) => void;
}) {
  const [formData, setFormData] = useState({
    display_name: employee.display_name,
    role: employee.role as 'admin' | 'staff',
    is_active: employee.is_active,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      display_name: formData.display_name.trim(),
      role: formData.role,
      is_active: formData.is_active,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-[15px] font-bold text-slate-800">Sửa nhân viên</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Tên hiển thị *</label>
            <input
              required
              value={formData.display_name}
              onChange={(e) => setFormData((p) => ({ ...p, display_name: e.target.value }))}
              className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Vai trò *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value as 'staff' | 'admin' }))}
              className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg"
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-2 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300"
            />
            Tài khoản đang hoạt động
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              Hủy
            </button>
            <button type="submit" disabled={isLoading} className="px-4 py-2 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {isLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function CreateEmployeeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [formData, setFormData] = useState({
    display_name: '',
    phone_number: '',
    password: '',
    role: 'staff' as 'staff' | 'admin',
  });

  const createMutation = useMutation({
    mutationFn: () => authApi.register(formData),
    onSuccess: () => {
      toast.success('Tạo nhân viên thành công');
      onCreated();
      onClose();
    },
    onError: (error: any) => {
      toast.error('Không thể tạo nhân viên', error?.response?.data?.error || error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-[15px] font-bold text-slate-800">Thêm nhân viên</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Tên hiển thị *</label>
            <input
              required
              value={formData.display_name}
              onChange={(e) => setFormData((p) => ({ ...p, display_name: e.target.value }))}
              className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Số điện thoại *</label>
            <input
              required
              value={formData.phone_number}
              onChange={(e) => setFormData((p) => ({ ...p, phone_number: e.target.value }))}
              className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Mật khẩu *</label>
            <input
              required
              type="password"
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
              className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Vai trò *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value as 'staff' | 'admin' }))}
              className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg"
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              Hủy
            </button>
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {createMutation.isPending ? 'Đang tạo...' : 'Tạo nhân viên'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
