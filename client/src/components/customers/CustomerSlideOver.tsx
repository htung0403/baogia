import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerGroupApi } from '@/api/client';
import { formatDate, formatPhoneE164 } from '@/lib/utils';
import type { Customer, CustomerGroup, StaffProfile } from '@/types';
import { Check, ChevronDown, Plus, X } from 'lucide-react';

interface CustomerSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  staffList?: StaffProfile[];
  currentUserId?: string;
  onSave: (data: Record<string, unknown>) => void;
  isLoading: boolean;
}

export default function CustomerSlideOver({
  isOpen,
  onClose,
  customer,
  staffList,
  currentUserId,
  onSave,
  isLoading,
}: CustomerSlideOverProps) {
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      // Double RAF: first frame mounts the element at translate-x-full,
      // second frame flips to translate-x-0 so the CSS transition actually runs.
      let raf1: number;
      let raf2: number;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    } else {
      setVisible(false);
      closeTimerRef.current = setTimeout(() => setRendered(false), 300);
      return () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!rendered) return null;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[9998] bg-black/50 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={customer ? 'Sửa khách hàng' : 'Thêm khách hàng mới'}
        className={`fixed inset-y-0 right-0 z-[9999] flex flex-col w-full max-w-lg bg-card border-l border-border shadow-2xl transform transition-transform duration-300 ease-in-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <SlideOverForm
          customer={customer}
          staffList={staffList}
          currentUserId={currentUserId}
          onSave={onSave}
          onClose={onClose}
          isLoading={isLoading}
        />
      </div>
    </>,
    document.body
  );
}

type FormProps = Omit<CustomerSlideOverProps, 'isOpen'>;

function SlideOverForm({
  customer,
  staffList,
  currentUserId,
  onSave,
  onClose,
  isLoading,
}: FormProps) {
  const isEdit = !!customer;
  // @ts-expect-error unused variable
  const createdAtDisplay = customer?.created_at
    ? formatDate(customer.created_at)
    : formatDate(new Date().toISOString());

  const queryClient = useQueryClient();

  const { data: groupsRes } = useQuery({
    queryKey: ['customer-groups'],
    queryFn: () => customerGroupApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const customerGroups: CustomerGroup[] = groupsRes?.data?.data ?? [];

  const [formData, setFormData] = useState({
    customer_name: customer?.customer_name ?? '',
    phone_number: customer?.phone_number ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    notes: customer?.notes ?? '',
    skype: customer?.skype ?? '',
    facebook: customer?.facebook ?? '',
    tiktok_url: customer?.tiktok_url ?? '',
    characteristics: customer?.characteristics ?? '',
    assigned_to: customer?.assigned_to ?? currentUserId ?? '',
    customer_group_id: customer?.customer_group_id ?? '',
    create_account: false,
    account_phone: '',
    account_password: '',
    initial_cost: '',
    initial_cost_description: '',
    initial_cost_type: 'other',
  });

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'create_account' && value === true && !next.account_phone) {
        next.account_phone = prev.phone_number;
      }
      return next;
    });
  };

  const createGroupMutation = useMutation({
    mutationFn: (name: string) =>
      customerGroupApi.create({ name }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['customer-groups'] });
      const newGroup: CustomerGroup | undefined = res?.data?.data ?? res?.data;
      if (newGroup?.id) {
        updateField('customer_group_id', newGroup.id);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = {
      customer_name: formData.customer_name,
      phone_number: formData.phone_number || null,
      email: formData.email || null,
      address: formData.address || null,
      notes: formData.notes || null,
      skype: formData.skype || null,
      facebook: formData.facebook || null,
      tiktok_url: formData.tiktok_url || null,
      characteristics: formData.characteristics || null,
      assigned_to: formData.assigned_to || null,
      customer_group_id: formData.customer_group_id || null,
    };

    if (!isEdit && formData.create_account) {
      data.create_account = true;
      data.account_phone = formatPhoneE164(formData.account_phone);
      data.account_password = formData.account_password;
    }

    if (!isEdit && formData.initial_cost && formData.initial_cost_description) {
      data.initial_cost = Number(formData.initial_cost);
      data.initial_cost_description = formData.initial_cost_description;
      data.initial_cost_type = formData.initial_cost_type;
    }

    onSave(data);
  };

  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">
            {isEdit ? 'Sửa khách hàng' : 'Thêm khách hàng mới'}
          </h2>
          {isEdit && (
            <p className="text-[12px] text-slate-400 mt-0.5">{customer?.customer_name}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form
        id="customer-slide-over-form"
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto px-5 py-5 space-y-5"
      >
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-slate-700">
            Tên khách hàng <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.customer_name}
            onChange={(e) => updateField('customer_name', e.target.value)}
            required
            placeholder="Nhập tên khách hàng..."
            className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-700">Số điện thoại</label>
            <input
              type="text"
              value={formData.phone_number}
              onChange={(e) => updateField('phone_number', e.target.value)}
              className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-slate-700">Địa chỉ</label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => updateField('address', e.target.value)}
            className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-700">Skype</label>
            <input
              type="text"
              value={formData.skype}
              onChange={(e) => updateField('skype', e.target.value)}
              className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-700">Facebook</label>
            <input
              type="text"
              value={formData.facebook}
              onChange={(e) => updateField('facebook', e.target.value)}
              className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-700">TikTok</label>
            <input
              type="text"
              value={formData.tiktok_url}
              onChange={(e) => updateField('tiktok_url', e.target.value)}
              className="w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-700">Người phụ trách</label>
            <StaffSelect
              staffList={staffList ?? []}
              value={formData.assigned_to}
              onChange={(id) => updateField('assigned_to', id)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-700">Nhóm khách</label>
            <GroupSelect
              groups={customerGroups}
              value={formData.customer_group_id}
              onChange={(id) => updateField('customer_group_id', id)}
              onCreate={(name) => createGroupMutation.mutate(name)}
              isCreating={createGroupMutation.isPending}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-slate-700">Ghi chú</label>
          <textarea
            value={formData.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-[13px] border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring resize-none transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-slate-700">Đặc điểm khách hàng</label>
          <textarea
            value={formData.characteristics}
            onChange={(e) => updateField('characteristics', e.target.value)}
            rows={3}
            placeholder="Sở thích, đặc điểm nhận dạng, lưu ý đặc biệt..."
            className="w-full px-3 py-2 text-[13px] border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring resize-none transition-all"
          />
        </div>

        {!isEdit && (
          <div className="border border-border rounded-xl p-4 space-y-3 bg-slate-50/60">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.create_account}
                onChange={(e) => updateField('create_account', e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border accent-indigo-600"
              />
              <span className="text-[13px] font-medium text-slate-700">Tạo tài khoản đăng nhập</span>
            </label>

            {formData.create_account && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-500">SĐT đăng nhập *</label>
                  <input
                    type="tel"
                    value={formData.account_phone}
                    onChange={(e) => updateField('account_phone', e.target.value)}
                    required={formData.create_account}
                    className="w-full h-8 px-2.5 text-[12px] border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-500">Mật khẩu *</label>
                  <input
                    type="password"
                    value={formData.account_password}
                    onChange={(e) => updateField('account_password', e.target.value)}
                    required={formData.create_account}
                    minLength={6}
                    className="w-full h-8 px-2.5 text-[12px] border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                  />
                </div>
              </div>
            )}
          </div>
        )}



        <div className="h-2" />
      </form>

      <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-4 border-t bg-card">
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-4 text-[13px] font-medium border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer"
        >
          Hủy
        </button>
        <button
          type="submit"
          form="customer-slide-over-form"
          disabled={isLoading}
          className="h-9 px-5 text-[13px] font-bold text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer shadow-sm"
        >
          {isLoading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo mới'}
        </button>
      </div>
    </>
  );
}

interface GroupSelectProps {
  groups: CustomerGroup[];
  value: string;
  onChange: (id: string) => void;
  onCreate: (name: string) => void;
  isCreating?: boolean;
}

function GroupSelect({ groups, value, onChange, onCreate, isCreating }: GroupSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedGroup = groups.find((g) => g.id === value);

  const filtered = search.trim()
    ? groups.filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase()))
    : groups;

  const exactMatch = groups.some(
    (g) => g.name.toLowerCase() === search.trim().toLowerCase(),
  );

  const showCreate = search.trim().length > 0 && !exactMatch;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  const handleCreate = () => {
    if (!search.trim() || isCreating) return;
    onCreate(search.trim());
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={handleOpen}
        className="w-full h-9 px-3 flex items-center justify-between text-[13px] border border-border rounded-lg bg-background hover:border-ring/60 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all text-left"
      >
        <span className={selectedGroup ? 'text-foreground' : 'text-muted-foreground'}>
          {selectedGroup ? selectedGroup.name : 'Chọn nhóm khách...'}
        </span>
        <span className="flex items-center gap-0.5 shrink-0">
          {selectedGroup && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Xóa nhóm"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute z-[10000] top-full left-0 mt-1 w-full bg-white border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="px-2 py-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filtered.length === 1 && !showCreate) {
                    handleSelect(filtered[0].id);
                  } else if (showCreate) {
                    handleCreate();
                  }
                }
                if (e.key === 'Escape') {
                  setOpen(false);
                  setSearch('');
                }
              }}
              placeholder="Tìm hoặc nhập tên nhóm..."
              className="w-full h-7 px-2 text-[12px] border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            />
          </div>

          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 && !showCreate && (
              <li className="px-3 py-2 text-[12px] text-muted-foreground text-center">
                Không tìm thấy nhóm nào
              </li>
            )}
            {filtered.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(g.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] hover:bg-accent transition-colors text-left"
                >
                  <span>{g.name}</span>
                  {g.id === value && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </button>
              </li>
            ))}

            {showCreate && (
              <li>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-primary hover:bg-primary/5 transition-colors text-left font-medium disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isCreating ? 'Đang tạo...' : `Tạo nhóm khách mới "${search.trim()}"`}
                  </span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

interface StaffSelectProps {
  staffList: StaffProfile[];
  value: string;
  onChange: (id: string) => void;
}

function StaffSelect({ staffList, value, onChange }: StaffSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedStaff = staffList.find((s) => s.id === value);

  const filtered = search.trim()
    ? staffList.filter((s) => s.display_name.toLowerCase().includes(search.trim().toLowerCase()))
    : staffList;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={handleOpen}
        className="w-full h-9 px-3 flex items-center justify-between text-[13px] border border-border rounded-lg bg-background hover:border-ring/60 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all text-left"
      >
        <span className={selectedStaff ? 'text-foreground' : 'text-muted-foreground'}>
          {selectedStaff ? selectedStaff.display_name : 'Chọn người phụ trách...'}
        </span>
        <span className="flex items-center gap-0.5 shrink-0">
          {selectedStaff && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Xóa người phụ trách"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute z-[10000] top-full left-0 mt-1 w-full bg-white border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="px-2 py-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filtered.length === 1) {
                    handleSelect(filtered[0].id);
                  }
                }
                if (e.key === 'Escape') {
                  setOpen(false);
                  setSearch('');
                }
              }}
              placeholder="Tìm người phụ trách..."
              className="w-full h-7 px-2 text-[12px] border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            />
          </div>

          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-[12px] text-muted-foreground text-center">
                Không tìm thấy người phụ trách nào
              </li>
            )}
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(s.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] hover:bg-accent transition-colors text-left"
                >
                  <span>{s.display_name}</span>
                  {s.id === value && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
