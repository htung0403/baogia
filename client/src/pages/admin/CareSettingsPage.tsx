import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { careScheduleApi, customerGroupApi } from '@/api/client';
import type { CareScheduleSetting, CustomerGroup } from '@/types';
import { useToast } from '@/components/ui/toast';
import { Plus, Edit, Trash2, X, Settings, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

type StepFormItem = { name: string; description: string; days_offset: number; sort_order: number };

export default function CareSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingSettingId, setEditingSettingId] = useState<string | null>(null);
  const [settingToDelete, setSettingToDelete] = useState<CareScheduleSetting | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: res, isLoading } = useQuery({
    queryKey: ['care-settings'],
    queryFn: () => careScheduleApi.listSettings(),
    staleTime: 5 * 60 * 1000,
  });
  const settings: CareScheduleSetting[] = res?.data?.data ?? [];

  const { data: groupsRes } = useQuery({
    queryKey: ['customer-groups'],
    queryFn: () => customerGroupApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const groups: CustomerGroup[] = groupsRes?.data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof careScheduleApi.createSetting>[0]) =>
      careScheduleApi.createSetting(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care-settings'] });
      setShowForm(false);
      setEditingSettingId(null);
      toast.success('Tạo cài đặt chăm sóc thành công');
    },
    onError: (error: any) => {
      toast.error('Không thể tạo cài đặt', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof careScheduleApi.updateSetting>[1] }) =>
      careScheduleApi.updateSetting(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care-settings'] });
      setShowForm(false);
      setEditingSettingId(null);
      toast.success('Cập nhật cài đặt chăm sóc thành công');
    },
    onError: (error: any) => {
      toast.error('Không thể cập nhật', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => careScheduleApi.deleteSetting(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care-settings'] });
      setSettingToDelete(null);
      toast.success('Đã xóa cài đặt chăm sóc');
    },
    onError: (error: any) => {
      toast.error('Không thể xóa', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const generateMutation = useMutation({
    mutationFn: (customer_group_id: string) =>
      careScheduleApi.generateEvents({ customer_group_id }),
    onSuccess: (result) => {
      const data = result?.data?.data;
      toast.success(`Đã tạo ${data?.generated ?? 0} lịch chăm sóc cho ${data?.customers ?? 0} khách hàng`);
    },
    onError: (error: any) => {
      toast.error('Không thể tạo lịch', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const editingSetting = editingSettingId ? settings.find((s) => s.id === editingSettingId) ?? null : null;

  const handleSave = (data: {
    customer_group_id: string;
    cycle_days: number;
    is_active: boolean;
    steps: StepFormItem[];
  }) => {
    const steps = data.steps.map((s, i) => ({ ...s, sort_order: i + 1 }));
    if (editingSettingId) {
      updateMutation.mutate({ id: editingSettingId, data: { cycle_days: data.cycle_days, is_active: data.is_active, steps } });
    } else {
      createMutation.mutate({ customer_group_id: data.customer_group_id, cycle_days: data.cycle_days, is_active: data.is_active, steps });
    }
  };

  const usedGroupIds = new Set(settings.map((s) => s.customer_group_id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cài đặt chăm sóc</h1>
          <p className="text-[14px] text-slate-500 mt-1">Quản lý chu kỳ và bước chăm sóc theo nhóm ({settings.length})</p>
        </div>
        <button
          onClick={() => { setEditingSettingId(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Thêm cài đặt
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl shadow-sm h-24 animate-pulse" />
          ))}
        </div>
      ) : settings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm py-16 text-center">
          <Settings className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-[14px] text-slate-400">
            Chưa có cài đặt chăm sóc nào. Nhấn &apos;+ Thêm cài đặt&apos; để bắt đầu.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {settings.map((setting) => {
            const group = setting.customer_groups;
            const steps = [...(setting.care_schedule_steps ?? [])].sort((a, b) => a.sort_order - b.sort_order);
            const isExpanded = expandedIds.has(setting.id);

            return (
              <div key={setting.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3.5 gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleExpand(setting.id)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[14px] text-slate-900">{group?.name ?? '—'}</span>
                        {group?.code && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {group.code}
                          </span>
                        )}
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${setting.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {setting.is_active ? 'Hoạt động' : 'Tạm dừng'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[12px] text-slate-500">
                        <span>Chu kỳ: {setting.cycle_days} ngày</span>
                        <span>•</span>
                        <span>{steps.length} bước chăm sóc</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditingSettingId(setting.id); setShowForm(true); }}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                      title="Sửa"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSettingToDelete(setting)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => generateMutation.mutate(setting.customer_group_id)}
                      disabled={generateMutation.isPending}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      title="Tạo lịch"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
                      Tạo lịch
                    </button>
                  </div>
                </div>

                {isExpanded && steps.length > 0 && (
                  <div className="border-t bg-slate-50/60 px-4 py-3">
                    <ul className="space-y-1.5">
                      {steps.map((step, idx) => (
                        <li key={step.id} className="text-[12px] text-slate-600">
                          <span className="font-medium">• Bước {idx + 1}: {step.name}</span>
                          <span className="text-slate-400"> — Ngày {step.days_offset}</span>
                          {step.description && (
                            <span className="text-slate-400"> · {step.description}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <CareSettingFormModal
          setting={editingSetting}
          groups={groups}
          usedGroupIds={usedGroupIds}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingSettingId(null); }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {settingToDelete && (
        <DeleteConfirmModal
          setting={settingToDelete}
          onConfirm={() => deleteMutation.mutate(settingToDelete.id)}
          onClose={() => setSettingToDelete(null)}
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

function CareSettingFormModal({
  setting,
  groups,
  usedGroupIds,
  onSave,
  onClose,
  isLoading,
}: {
  setting: CareScheduleSetting | null;
  groups: CustomerGroup[];
  usedGroupIds: Set<string>;
  onSave: (data: { customer_group_id: string; cycle_days: number; is_active: boolean; steps: StepFormItem[] }) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const isEdit = !!setting;

  const initSteps = (): StepFormItem[] => {
    const existing = setting?.care_schedule_steps;
    if (existing && existing.length > 0) {
      return [...existing]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({ name: s.name, description: s.description ?? '', days_offset: s.days_offset, sort_order: s.sort_order }));
    }
    return [{ name: '', description: '', days_offset: 0, sort_order: 1 }];
  };

  const [groupId, setGroupId] = useState(setting?.customer_group_id ?? '');
  const [cycleDays, setCycleDays] = useState(setting?.cycle_days ?? 30);
  const [isActive, setIsActive] = useState(setting?.is_active ?? true);
  const [steps, setSteps] = useState<StepFormItem[]>(initSteps);

  const availableGroups = groups.filter((g) => !usedGroupIds.has(g.id) || g.id === setting?.customer_group_id);

  const addStep = () => {
    setSteps((prev) => [...prev, { name: '', description: '', days_offset: 0, sort_order: prev.length + 1 }]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof StepFormItem, value: string | number) => {
    setSteps((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ customer_group_id: groupId, cycle_days: Number(cycleDays), is_active: isActive, steps });
  };

  const editGroupName = setting?.customer_groups?.name ?? '';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <h2 className="text-[14px] font-semibold">
            {isEdit ? 'Sửa cài đặt chăm sóc' : 'Thêm cài đặt chăm sóc'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-md cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Nhóm khách hàng *</label>
            {isEdit ? (
              <div className="w-full h-8 px-3 text-[13px] border rounded-md bg-muted flex items-center text-slate-600">
                {editGroupName}
              </div>
            ) : (
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                required
                className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Chọn nhóm —</option>
                {availableGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}{g.code ? ` [${g.code}]` : ''}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Chu kỳ chăm sóc *</label>
              <div className="relative">
                <input
                  type="number"
                  value={cycleDays}
                  onChange={(e) => setCycleDays(Number(e.target.value))}
                  min={1}
                  required
                  className="w-full h-8 px-3 pr-10 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">ngày</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Trạng thái</label>
              <label className="flex items-center gap-2 h-8 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-[13px] text-slate-700">Hoạt động</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium">Bước chăm sóc *</label>
              <span className="text-[11px] text-slate-400">{steps.length} bước</span>
            </div>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-2 items-start p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-400 mt-1.5 w-5 shrink-0">#{idx + 1}</div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={step.name}
                      onChange={(e) => updateStep(idx, 'name', e.target.value)}
                      required
                      placeholder="Tên bước *"
                      className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={step.description}
                        onChange={(e) => updateStep(idx, 'description', e.target.value)}
                        placeholder="Mô tả (tùy chọn)"
                        className="flex-1 h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <div className="relative shrink-0 w-24">
                        <input
                          type="number"
                          value={step.days_offset}
                          onChange={(e) => updateStep(idx, 'days_offset', Number(e.target.value))}
                          min={0}
                          className="w-full h-8 px-3 pr-7 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">ng</span>
                      </div>
                    </div>
                  </div>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(idx)}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded cursor-pointer shrink-0 mt-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addStep}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-indigo-700 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer w-full justify-center"
            >
              <Plus className="w-3.5 h-3.5" />
              Thêm bước
            </button>
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

function DeleteConfirmModal({
  setting,
  onConfirm,
  onClose,
  isLoading,
}: {
  setting: CareScheduleSetting;
  onConfirm: () => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const groupName = setting.customer_groups?.name ?? 'nhóm này';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-[14px] font-semibold">Xác nhận xóa</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-md cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] text-slate-600">
            Bạn có chắc muốn xóa cài đặt chăm sóc cho nhóm{' '}
            <span className="font-semibold text-slate-900">{groupName}</span>?
          </p>
          <p className="text-[12px] text-slate-400 mt-1">Hành động này không thể hoàn tác.</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 text-[12px] font-medium border rounded-md hover:bg-accent transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="h-8 px-3 text-[12px] font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-40 transition-colors cursor-pointer"
          >
            {isLoading ? 'Đang xóa...' : 'Xóa'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
