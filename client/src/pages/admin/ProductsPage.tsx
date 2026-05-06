import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi, uploadApi, customerGroupApi, brandApi, productGroupApi } from '@/api/client';
import { formatCurrency } from '@/lib/utils';
import { SearchableSelectWithCreate } from '@/components/ui/SearchableSelectWithCreate';
import {
  Plus,
  Search,
  Edit,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
  Package,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import type { Product, ProductGroupPrice } from '@/types';
import { useToast } from '@/components/ui/toast';

type SortField = 'name' | 'sku' | 'base_price' | 'unit' | 'is_active' | 'product_categories.name' | 'brands.name' | 'product_groups.name';
type SortOrder = 'asc' | 'desc';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [copyingProduct, setCopyingProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['products', { page, search }],
    queryFn: () => productApi.list({
      page,
      limit: 20,
      ...(search ? { search } : {}),
    }),
    staleTime: 5 * 60 * 1000,
  });

  const products: Product[] = res?.data?.data ?? [];
  const meta = res?.data?.meta;

  const sortedProducts = useMemo(() => {
    const sorted = [...products].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortBy) {
        case 'name':
          aVal = (a.name ?? '').toLowerCase();
          bVal = (b.name ?? '').toLowerCase();
          break;
        case 'sku':
          aVal = (a.sku ?? '').toLowerCase();
          bVal = (b.sku ?? '').toLowerCase();
          break;
        case 'base_price':
          aVal = a.base_price ?? 0;
          bVal = b.base_price ?? 0;
          break;
        case 'unit':
          aVal = (a.unit ?? '').toLowerCase();
          bVal = (b.unit ?? '').toLowerCase();
          break;
        case 'product_categories.name':
          aVal = (a.product_categories?.name ?? '').toLowerCase();
          bVal = (b.product_categories?.name ?? '').toLowerCase();
          break;
        case 'brands.name':
          aVal = (a.brands?.name ?? '').toLowerCase();
          bVal = (b.brands?.name ?? '').toLowerCase();
          break;
        case 'product_groups.name':
          aVal = (a.product_groups?.name ?? '').toLowerCase();
          bVal = (b.product_groups?.name ?? '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [products, sortBy, sortOrder]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, search]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    const total = sortedProducts.length;
    const selected = sortedProducts.filter((p) => selectedIds.has(p.id)).length;
    selectAllRef.current.indeterminate = selected > 0 && selected < total;
  }, [selectedIds, products]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' }),
    onError: () => toast.error('Không thể xóa sản phẩm'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => productApi.delete(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' });
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      toast.success(`Đã xóa ${selectedIds.size} sản phẩm thành công`);
    },
    onError: () => toast.error('Không thể xóa sản phẩm'),
  });

  const saveMutation = useMutation({
    mutationFn: (data: { id?: string; body: Record<string, unknown> }) =>
      data.id ? productApi.update(data.id, data.body) : productApi.create(data.body),
    onSuccess: () => {
      setShowForm(false);
      setEditingProduct(null);
      setCopyingProduct(null);
      toast.success(editingProduct ? 'Cập nhật sản phẩm thành công' : 'Tạo sản phẩm thành công');
      queryClient.refetchQueries({ queryKey: ['products'] });
    },
    onError: (error: any) => {
      toast.error('Không thể lưu sản phẩm', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const handleSave = (formData: Record<string, unknown>) => {
    saveMutation.mutate({
      id: editingProduct ? editingProduct.id : undefined,
      body: formData,
    });
  };

  const handleCopy = (product: Product) => {
    setCopyingProduct(product);
    setEditingProduct(null);
    setShowForm(true);
  };

  const handleDelete = (id: string, name: string) => {
    setProductToDelete({ id, name });
  };

  const confirmSingleDelete = () => {
    if (!productToDelete) return;
    deleteMutation.mutate(productToDelete.id, {
      onSuccess: () => {
        setProductToDelete(null);
        toast.success('Đã xóa sản phẩm thành công');
      },
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sortedProducts.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const allSelected = sortedProducts.length > 0 && sortedProducts.every((p) => selectedIds.has(p.id));

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-0 group-hover/th:opacity-40 transition-opacity" />;
    return sortOrder === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1 text-indigo-600" />
      : <ChevronDown className="w-3 h-3 ml-1 text-indigo-600" />;
  };

  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <th
      onClick={() => handleSort(field)}
      className={`text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px] cursor-pointer select-none hover:bg-slate-100/80 transition-colors group/th ${className ?? ''}`}
    >
      <span className="inline-flex items-center">
        {children}
        <SortIcon field={field} />
      </span>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sản phẩm</h1>
          <p className="text-[14px] text-slate-500 mt-1">Quản lý danh mục & giá sản phẩm ({meta?.total ?? 0})</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm shadow-red-200 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Xóa {selectedIds.size} sản phẩm
            </button>
          )}
          <button
            onClick={() => { setEditingProduct(null); setCopyingProduct(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Thêm sản phẩm
          </button>
        </div>
      </div>

      {/* Search & Stats */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên sản phẩm, mã SKU..."
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
                <th className="py-3.5 px-4 w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer accent-indigo-600"
                  />
                </th>
                <SortableHeader field="sku" className="w-28">Mã SKU</SortableHeader>
                <SortableHeader field="name">Tên sản phẩm</SortableHeader>
                <SortableHeader field="product_categories.name">Danh mục</SortableHeader>
                <SortableHeader field="brands.name">Thương hiệu</SortableHeader>
                <SortableHeader field="product_groups.name">Nhóm hàng</SortableHeader>
                <SortableHeader field="base_price" className="!text-right">Giá cơ bản</SortableHeader>
                <SortableHeader field="unit" className="!text-center">ĐVT</SortableHeader>
                <th className="text-center py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Trạng thái</th>
                <th className="text-right py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px] w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={10} className="py-4 px-4">
                      <div className="h-10 bg-slate-50 animate-pulse rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-[14px] text-slate-400">
                    Không tìm thấy sản phẩm nào
                  </td>
                </tr>
              ) : (
                sortedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-4 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(product.id)}
                        onChange={(e) => handleSelectOne(product.id, e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer accent-indigo-600"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-mono text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                        {product.sku}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {product.image_urls?.[0] ? (
                            <img
                              src={product.image_urls[0]}
                              alt={product.name}
                              className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-300"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-[8px] font-bold text-slate-400">
                              <Package className="w-4 h-4 mb-0.5 opacity-20" />
                              N/A
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-slate-900 line-clamp-2 leading-tight">
                          {product.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {product.product_categories?.name ?? 'Chưa phân loại'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        {product.brands?.name ?? '—'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                        {product.product_groups?.name ?? '—'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-[14px] font-bold text-indigo-600 tabular-nums">
                        {formatCurrency(product.base_price)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center text-slate-500 font-medium">{product.unit}</td>
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          product.is_active
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-red-100 text-red-700 border-red-200'
                        }`}
                      >
                        <div className={`w-1 h-1 rounded-full ${product.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {product.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingProduct(product); setCopyingProduct(null); setShowForm(true); }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopy(product)}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                          title="Sao chép"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id, product.name)}
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
              Trang {meta.page} / {meta.totalPages} ({meta.total} sản phẩm)
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

      {/* Product Form Modal */}
      {showForm && (
        <ProductFormModal
          mode={editingProduct ? 'edit' : copyingProduct ? 'copy' : 'create'}
          initialProduct={editingProduct ?? copyingProduct}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingProduct(null); setCopyingProduct(null); }}
          isLoading={saveMutation.isPending}
        />
      )}

      {/* Single Delete Confirm Dialog */}
      {productToDelete &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
              <div className="flex flex-col items-center px-6 pt-7 pb-5 text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-7 h-7 text-red-500" />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 mb-2">Xác nhận xóa</h3>
                <p className="text-[13px] text-slate-500 leading-relaxed">
                  Bạn có chắc chắn muốn xóa sản phẩm &ldquo;{productToDelete.name}&rdquo; không?
                  <br />
                  Hành động này không thể hoàn tác.
                </p>
              </div>
              <div className="flex items-center gap-2 px-6 pb-6">
                <button
                  type="button"
                  onClick={() => setProductToDelete(null)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 h-10 text-[13px] font-medium border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={confirmSingleDelete}
                  disabled={deleteMutation.isPending}
                  className="flex-1 h-10 text-[13px] font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 shadow-sm shadow-red-200"
                >
                  {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa sản phẩm'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Bulk Delete Confirm Dialog */}
      {showBulkDeleteConfirm &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
              <div className="flex flex-col items-center px-6 pt-7 pb-5 text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-7 h-7 text-red-500" />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 mb-2">Xác nhận xóa</h3>
                <p className="text-[13px] text-slate-500 leading-relaxed">
                  Bạn có chắc chắn muốn xóa {selectedIds.size} sản phẩm đã chọn không?
                  <br />
                  Hành động này không thể hoàn tác.
                </p>
              </div>
              <div className="flex items-center gap-2 px-6 pb-6">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  disabled={bulkDeleteMutation.isPending}
                  className="flex-1 h-10 text-[13px] font-medium border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
                  disabled={bulkDeleteMutation.isPending}
                  className="flex-1 h-10 text-[13px] font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 shadow-sm shadow-red-200"
                >
                  {bulkDeleteMutation.isPending ? 'Đang xóa...' : 'Xóa sản phẩm'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

// ============================================================
// Currency Input
// ============================================================
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

// ============================================================
// Product Form Modal
// ============================================================
function ProductFormModal({
  mode,
  initialProduct,
  onSave,
  onClose,
  isLoading,
}: {
  mode: 'create' | 'edit' | 'copy';
  initialProduct: Product | null;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
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
