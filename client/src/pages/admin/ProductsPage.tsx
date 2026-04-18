import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi, uploadApi } from '@/api/client';
import { formatCurrency } from '@/lib/utils';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
  Package,
} from 'lucide-react';
import type { Product } from '@/types';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['products', { page, search }],
    queryFn: () => productApi.list({ page, limit: 20, ...(search ? { search } : {}) }),
    staleTime: 5 * 60 * 1000,
  });

  const products: Product[] = res?.data?.data ?? [];
  const meta = res?.data?.meta;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  const saveMutation = useMutation({
    mutationFn: (data: { id?: string; body: Record<string, unknown> }) =>
      data.id ? productApi.update(data.id, data.body) : productApi.create(data.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowForm(false);
      setEditingProduct(null);
    },
  });

  const handleSave = (formData: Record<string, unknown>) => {
    saveMutation.mutate({
      id: editingProduct?.id,
      body: formData,
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Xóa sản phẩm "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sản phẩm</h1>
          <p className="text-[14px] text-slate-500 mt-1">Quản lý danh mục & giá sản phẩm ({meta?.total ?? 0})</p>
        </div>
        <button
          onClick={() => { setEditingProduct(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Thêm sản phẩm
        </button>
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
                <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px] w-28">SKU</th>
                <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Tên sản phẩm</th>
                <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Danh mục</th>
                <th className="text-right py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Giá cơ bản</th>
                <th className="text-center py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">ĐVT</th>
                <th className="text-center py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Trạng thái</th>
                <th className="text-right py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px] w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="py-4 px-4">
                      <div className="h-10 bg-slate-50 animate-pulse rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[14px] text-slate-400">
                    Không tìm thấy sản phẩm nào
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/80 transition-colors group">
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
                          onClick={() => { setEditingProduct(product); setShowForm(true); }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Edit className="w-4 h-4" />
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
          product={editingProduct}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingProduct(null); }}
          isLoading={saveMutation.isPending}
        />
      )}
    </div>
  );
}

// ============================================================
// Product Form Modal
// ============================================================
function ProductFormModal({
  product,
  onSave,
  onClose,
  isLoading,
}: {
  product: Product | null;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    unit: product?.unit ?? 'cái',
    base_price: product?.base_price ?? 0,
    is_active: product?.is_active ?? true,
    image_urls: product?.image_urls ?? [] as string[],
  });
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      base_price: Number(formData.base_price),
    });
  };

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-[14px] font-semibold">
            {product ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-md cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
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
              <label className="text-[13px] font-medium">SKU *</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => updateField('sku', e.target.value)}
                required
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
              <input
                type="number"
                value={formData.base_price}
                onChange={(e) => updateField('base_price', e.target.value)}
                min="0"
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
              {isLoading ? 'Đang lưu...' : product ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
