import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { productApi, uploadApi, customerGroupApi, brandApi, productGroupApi } from '@/api/client';
import { formatCurrency } from '@/lib/utils';
import { SearchableSelectWithCreate } from '@/components/ui/SearchableSelectWithCreate';
import { X, Upload } from 'lucide-react';
import type { Product, ProductGroupPrice } from '@/types';
import { useToast } from '@/components/ui/toast';

interface ProductFormModalProps {
  mode: 'create' | 'edit' | 'copy';
  initialProduct: Product | null;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
  isLoading: boolean;
}

export default function ProductFormModal({
  mode,
  initialProduct,
  onSave,
  onClose,
  isLoading,
}: ProductFormModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'info' | 'prices'>('info');
  const [formData, setFormData] = useState({
    sku: mode === 'edit' ? (initialProduct?.sku ?? '') : '',
    name: initialProduct?.name ?? '',
    description: initialProduct?.description ?? '',
    unit: initialProduct?.unit ?? 'cái',
    base_price: initialProduct?.base_price ?? 0,
    is_active: initialProduct?.is_active ?? true,
    image_urls: initialProduct?.image_urls ?? [] as string[],
    brand_id: initialProduct?.brand_id ?? '',
    product_group_id: initialProduct?.product_group_id ?? '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [groupPrices, setGroupPrices] = useState<Array<{ customer_group_id: string; price: number }>>([]);
  const [brandSelectOpen, setBrandSelectOpen] = useState(false);
  const [productGroupSelectOpen, setProductGroupSelectOpen] = useState(false);
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);
  const [isCreatingProductGroup, setIsCreatingProductGroup] = useState(false);

  const { data: groupsRes } = useQuery({
    queryKey: ['customer-groups'],
    queryFn: () => customerGroupApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const groups = (groupsRes?.data?.data ?? []) as Array<{ id: string; name: string; code: string | null }>;

  const { data: brandsRes } = useQuery({
    queryKey: ['brands'],
    queryFn: () => brandApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const brands = (brandsRes?.data?.data ?? []) as Array<{ id: string; name: string }>;

  const { data: productGroupsRes } = useQuery({
    queryKey: ['product-groups'],
    queryFn: () => productGroupApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const productGroups = (productGroupsRes?.data?.data ?? []) as Array<{ id: string; name: string }>;

  const handleCreateBrand = async (name: string) => {
    setIsCreatingBrand(true);
    try {
      const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const res = await brandApi.create({ name, slug });
      const newItem = res.data?.data as { id: string; name: string } | undefined;
      if (newItem) {
        queryClient.setQueryData(['brands'], (old: any) => {
          const body = old?.data;
          return { ...old, data: { ...body, data: [...(body?.data ?? []), newItem] } };
        });
        updateField('brand_id', newItem.id);
        setBrandSelectOpen(false);
        toast.success(`Đã tạo thương hiệu "${newItem.name}"`);
      }
    } catch (err: any) {
      toast.error('Không thể tạo thương hiệu', err?.response?.data?.message);
    } finally {
      setIsCreatingBrand(false);
    }
  };

  const handleCreateProductGroup = async (name: string) => {
    setIsCreatingProductGroup(true);
    try {
      const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const res = await productGroupApi.create({ name, slug });
      const newItem = res.data?.data as { id: string; name: string } | undefined;
      if (newItem) {
        queryClient.setQueryData(['product-groups'], (old: any) => {
          const body = old?.data;
          return { ...old, data: { ...body, data: [...(body?.data ?? []), newItem] } };
        });
        updateField('product_group_id', newItem.id);
        setProductGroupSelectOpen(false);
        toast.success(`Đã tạo nhóm hàng "${newItem.name}"`);
      }
    } catch (err: any) {
      toast.error('Không thể tạo nhóm hàng', err?.response?.data?.message);
    } finally {
      setIsCreatingProductGroup(false);
    }
  };

  const { data: pricesRes } = useQuery({
    queryKey: ['product-group-prices', initialProduct?.id],
    queryFn: () => productApi.listGroupPrices(initialProduct!.id),
    enabled: !!initialProduct?.id,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (pricesRes?.data?.data) {
      const existing = (pricesRes.data.data as ProductGroupPrice[]).map((p) => ({
        customer_group_id: p.customer_group_id,
        price: p.price,
      }));
      setGroupPrices(existing);
    } else if (mode === 'create') {
      setGroupPrices([]);
    }
  }, [pricesRes, mode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      ...formData,
      base_price: Number(formData.base_price),
      brand_id: formData.brand_id || null,
      product_group_id: formData.product_group_id || null,
    };
    if (!payload.sku) delete payload.sku;
    if (groupPrices.length > 0) {
      payload.group_prices = groupPrices;
    }
    onSave(payload);
  };

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateGroupPrice = (groupId: string, price: number) => {
    setGroupPrices((prev) => {
      const existing = prev.find((p) => p.customer_group_id === groupId);
      if (existing) {
        return prev.map((p) => (p.customer_group_id === groupId ? { ...p, price } : p));
      }
      return [...prev, { customer_group_id: groupId, price }];
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { data: res } = await uploadApi.image(file);
      if (res.success && res.data?.url) {
        updateField('image_urls', [res.data.url]);
      }
    } catch (err) {
      alert('Upload ảnh thất bại');
    } finally {
      setIsUploading(false);
    }
  };

  const tabClass = (tab: string) =>
    `px-3 py-2 text-[12px] font-medium rounded-md transition-colors cursor-pointer ${
      activeTab === tab
        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-transparent'
    }`;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-[14px] font-semibold">
            {mode === 'edit' ? 'Sửa sản phẩm' : mode === 'copy' ? 'Sao chép sản phẩm' : 'Thêm sản phẩm mới'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-md cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => setActiveTab('info')} className={tabClass('info')}>
              Thông tin
            </button>
            <button type="button" onClick={() => setActiveTab('prices')} className={tabClass('prices')}>
              Giá theo nhóm
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {activeTab === 'info' && (
            <>
              <div className="space-y-2">
                <label className="text-[13px] font-medium">Hình ảnh sản phẩm</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 border border-dashed rounded-lg flex items-center justify-center overflow-hidden bg-muted/30 text-muted-foreground">
                    {formData.image_urls[0] ? (
                      <img src={formData.image_urls[0]} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium border rounded-md cursor-pointer hover:bg-accent transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      {isUploading ? 'Đang upload...' : 'Chọn ảnh'}
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-1.5">Định dạng: JPG, PNG, WEBP.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium">SKU {mode === 'edit' ? '*' : '(Tự động nếu để trống)'}</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => updateField('sku', e.target.value)}
                    placeholder={mode === 'edit' ? undefined : 'Để trống để tự động tạo'}
                    required={mode === 'edit'}
                    className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium">Đơn vị tính</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => updateField('unit', e.target.value)}
                    className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium">Thương hiệu</label>
                  <SearchableSelectWithCreate
                    options={brands.map((b) => ({ id: b.id, name: b.name }))}
                    value={formData.brand_id}
                    onChange={(id) => updateField('brand_id', id)}
                    onCreate={handleCreateBrand}
                    isCreating={isCreatingBrand}
                    placeholder="— Chọn —"
                    searchPlaceholder="Tìm hoặc nhập thương hiệu mới..."
                    open={brandSelectOpen}
                    onOpenChange={setBrandSelectOpen}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium">Nhóm hàng</label>
                  <SearchableSelectWithCreate
                    options={productGroups.map((pg) => ({ id: pg.id, name: pg.name }))}
                    value={formData.product_group_id}
                    onChange={(id) => updateField('product_group_id', id)}
                    onCreate={handleCreateProductGroup}
                    isCreating={isCreatingProductGroup}
                    placeholder="— Chọn —"
                    searchPlaceholder="Tìm hoặc nhập nhóm hàng mới..."
                    open={productGroupSelectOpen}
                    onOpenChange={setProductGroupSelectOpen}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Tên sản phẩm *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  required
                  className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium">Giá cơ bản (VNĐ) *</label>
                  <CurrencyInput
                    value={formData.base_price}
                    onChange={(val) => updateField('base_price', val)}
                    required
                    className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium">Trạng thái</label>
                  <select
                    value={formData.is_active ? 'true' : 'false'}
                    onChange={(e) => updateField('is_active', e.target.value === 'true')}
                    className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                  >
                    <option value="true">Hoạt động</option>
                    <option value="false">Tạm ngưng</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {activeTab === 'prices' && (
            <div className="space-y-3">
              <p className="text-[12px] text-slate-500">
                Để trống giá nếu sản phẩm không áp dụng cho nhóm khách hàng này.
              </p>
              {groups.length === 0 ? (
                <p className="text-[13px] text-slate-400 text-center py-4">Chưa có nhóm khách hàng nào</p>
              ) : (
                groups.map((group) => {
                  const existing = groupPrices.find((p) => p.customer_group_id === group.id);
                  return (
                    <div key={group.id} className="flex items-center gap-3">
                      <span className="flex-1 text-[13px] font-medium text-slate-700">{group.name}</span>
                      <CurrencyInput
                        value={existing?.price ?? 0}
                        onChange={(val) => updateGroupPrice(group.id, val)}
                        placeholder="Giá (VNĐ)"
                        className="w-32 h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                      />
                    </div>
                  );
                })
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
              {isLoading ? 'Đang lưu...' : mode === 'edit' ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function CurrencyInput({
  value,
  onChange,
  placeholder,
  required,
  className,
}: {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fmt = (n: number) => formatCurrency(n).replace(/\s?₫/, '').trim();

  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = fmt(value ?? 0);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    const num = digits ? parseInt(digits, 10) : 0;
    e.target.value = fmt(num);
    onChange(num);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      defaultValue={fmt(value ?? 0)}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      className={className}
    />
  );
}
