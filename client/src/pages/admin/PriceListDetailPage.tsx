import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/toast';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { priceListApi, productApi, customerApi, customerGroupApi } from '@/api/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PriceListDetail, PriceListItem, PriceListVersion, Product } from '@/types';
import {
  ArrowLeft,
  Plus,
  Send,
  Users,
  History,
  Save,
  X,
  Search,
  Check,
  AlertTriangle,
  Download,
  Pencil,
  Trash2,
  Eye,
} from 'lucide-react';

export default function PriceListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showAddProducts, setShowAddProducts] = useState(false);
  const [showAssignCustomers, setShowAssignCustomers] = useState(false);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [changelog, setChangelog] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [versionToDelete, setVersionToDelete] = useState<{ id: string; version_number: number } | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['price-list', id],
    queryFn: () => priceListApi.get(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });

  const detail: PriceListDetail | null = res?.data?.data ?? null;

  const activeVersionId: string | null = selectedVersionId ?? detail?.versions?.[0]?.id ?? null;

  const { data: versionRes } = useQuery({
    queryKey: ['price-list-version', id, activeVersionId],
    queryFn: () => priceListApi.getVersion(id!, activeVersionId!),
    enabled: !!id && !!activeVersionId,
    staleTime: 60 * 1000,
  });

  const displayItems: PriceListItem[] = versionRes?.data?.data?.items ?? detail?.items ?? [];

  const handleExportExcel = () => {
    if (!detail || displayItems.length === 0) return;

    const headers = ['STT', 'Thiết bị', 'SKU', 'DVT', 'Giá đại lý', 'Giá bán lẻ thấp nhất', 'Giá niêm yết truyền thông, MXH', 'Ghi chú'];
    const rows = displayItems.map((item, index) => [
      index + 1,
      item.product_name_snapshot,
      item.product_sku_snapshot,
      item.product_unit_snapshot,
      item.dealer_price,
      item.retail_price,
      item.public_price,
      item.note || '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bang_gia_${detail.title.replace(/\s+/g, '_')}_v${detail.current_version?.version_number || 1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const publishMutation = useMutation({
    mutationFn: ({ priceListId, versionId }: { priceListId: string; versionId: string }) =>
      priceListApi.publishVersion(priceListId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-list', id] });
    },
  });

  const createVersionMutation = useMutation({
    mutationFn: (data: { changelog?: string; items: DraftItem[] }) =>
      priceListApi.createVersion(id!, {
        changelog: data.changelog || undefined,
        items: data.items.map((item, index) => ({
          product_id: item.product_id,
          dealer_price: item.dealer_price || null,
          retail_price: item.retail_price || null,
          public_price: item.public_price || null,
          note: item.note || undefined,
          sort_order: index,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-list', id] });
      setIsBuilding(false);
      setDraftItems([]);
      setChangelog('');
      toast.success('Tạo phiên bản thành công');
    },
    onError: (error: any) => toast.error('Lỗi tạo phiên bản', error?.response?.data?.message || 'Vui lòng thử lại'),
  });

  const updateVersionMutation = useMutation({
    mutationFn: (data: { changelog?: string; items: DraftItem[] }) =>
      priceListApi.updateVersion(id!, editingVersionId!, {
        changelog: data.changelog || undefined,
        items: data.items.map((item, index) => ({
          product_id: item.product_id,
          dealer_price: item.dealer_price || null,
          retail_price: item.retail_price || null,
          public_price: item.public_price || null,
          note: item.note || undefined,
          sort_order: index,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-list', id] });
      queryClient.invalidateQueries({ queryKey: ['price-list-version', id] });
      setIsBuilding(false);
      setDraftItems([]);
      setChangelog('');
      setEditingVersionId(null);
      toast.success('Cập nhật phiên bản thành công');
    },
    onError: (error: any) => toast.error('Lỗi cập nhật phiên bản', error?.response?.data?.message || 'Vui lòng thử lại'),
  });

  const deleteVersionMutation = useMutation({
    mutationFn: (versionId: string) => priceListApi.deleteVersion(id!, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-list', id] });
      queryClient.invalidateQueries({ queryKey: ['price-list-version', id] });
      setVersionToDelete(null);
      toast.success('Đã xóa phiên bản');
    },
    onError: (error: any) => toast.error('Lỗi xóa phiên bản', error?.response?.data?.message || 'Vui lòng thử lại'),
  });

  const assignMutation = useMutation({
    mutationFn: (customerIds: string[]) => priceListApi.assignCustomers(id!, customerIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-list', id] });
      setShowAssignCustomers(false);
    },
  });

  const handleStartBuilding = () => {
    setEditingVersionId(null);
    if (displayItems.length > 0) {
      setDraftItems(
        displayItems.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name_snapshot,
          product_sku: item.product_sku_snapshot,
          product_image: item.product_image_snapshot,
          product_unit: item.product_unit_snapshot,
          dealer_price: item.dealer_price ?? 0,
          retail_price: item.retail_price ?? 0,
          public_price: item.public_price ?? 0,
          note: item.note ?? '',
        }))
      );
    }
    setIsBuilding(true);
  };

  const handleEditVersion = async (v: PriceListVersion) => {
    try {
      const res = await priceListApi.getVersion(id!, v.id);
      const items: PriceListItem[] = res?.data?.data?.items ?? [];
      setDraftItems(
        items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name_snapshot,
          product_sku: item.product_sku_snapshot,
          product_image: item.product_image_snapshot,
          product_unit: item.product_unit_snapshot,
          dealer_price: item.dealer_price ?? 0,
          retail_price: item.retail_price ?? 0,
          public_price: item.public_price ?? 0,
          note: item.note ?? '',
        }))
      );
      setChangelog(v.changelog ?? '');
      setEditingVersionId(v.id);
      setIsBuilding(true);
    } catch (error: any) {
      toast.error('Lỗi tải phiên bản', error?.response?.data?.message || 'Vui lòng thử lại');
    }
  };

  const handleAddProducts = (products: Product[]) => {
    const existing = new Set(draftItems.map((i) => i.product_id));
    const newItems: DraftItem[] = products
      .filter((p) => !existing.has(p.id))
      .map((p) => ({
        product_id: p.id,
        product_name: p.name,
        product_sku: p.sku,
        product_image: p.image_urls?.[0] ?? null,
        product_unit: p.unit,
        dealer_price: p.base_price,
        retail_price: 0,
        public_price: 0,
        note: '',
      }));
    setDraftItems((prev) => [...prev, ...newItems]);
    setShowAddProducts(false);
  };

  const handleUpdateDraftItem = (index: number, field: keyof DraftItem, value: unknown) => {
    setDraftItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveDraftItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveVersion = () => {
    if (draftItems.length === 0) return;
    if (editingVersionId) {
      updateVersionMutation.mutate({ changelog, items: draftItems });
    } else {
      createVersionMutation.mutate({ changelog, items: draftItems });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-16">
        <p className="text-[13px] text-muted-foreground">Bảng giá không tồn tại</p>
        <button onClick={() => navigate('/admin/price-lists')} className="mt-3 text-[13px] text-primary underline cursor-pointer">
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Admin Actions Bar */}
      <div className="flex items-center justify-between border-b pb-4 bg-background sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => navigate('/admin/price-lists')}
            className="p-1.5 hover:bg-accent rounded-md shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight truncate">{detail.title}</h1>
            <div className="flex items-center gap-2 mt-0.5 text-[12px] text-muted-foreground">
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium ${
                detail.status === 'published' ? 'bg-emerald-50 text-emerald-700' :
                detail.status === 'draft' ? 'bg-amber-50 text-amber-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {detail.status}
              </span>
              {detail.current_version && (
                <span>v{detail.current_version.version_number}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium border rounded-md hover:bg-accent transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Xuất Excel
          </button>
          <button
            onClick={() => setShowAssignCustomers(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium border rounded-md hover:bg-accent transition-colors cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            Gán khách ({detail.assigned_customers?.length ?? 0})
          </button>
          {!isBuilding && (
            <button
              onClick={handleStartBuilding}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tạo phiên bản mới
            </button>
          )}
        </div>
      </div>

      {/* Version Builder Alert */}
      {isBuilding && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-[13px] font-medium text-amber-800">
                {editingVersionId
                  ? `Đang chỉnh sửa phiên bản v${detail.versions.find((v: PriceListVersion) => v.id === editingVersionId)?.version_number} (${draftItems.length} thiết bị)`
                  : `Đang thiết lập phiên bản mới (${draftItems.length} thiết bị)`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowAddProducts(true)}
                className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium border border-amber-300 rounded-md hover:bg-amber-100 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Thêm TB
              </button>
              <button
                onClick={() => { setIsBuilding(false); setDraftItems([]); setChangelog(''); setEditingVersionId(null); }}
                className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] border rounded-md hover:bg-accent cursor-pointer"
              >
                <X className="w-3 h-3" />
                Hủy
              </button>
              <button
                onClick={handleSaveVersion}
                disabled={draftItems.length === 0 || createVersionMutation.isPending || updateVersionMutation.isPending}
                className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
              >
                <Save className="w-3 h-3" />
                {editingVersionId ? 'Lưu cập nhật' : 'Lưu phiên bản'}
              </button>
            </div>
          </div>
          <input
            type="text"
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            placeholder="Ghi chú thay đổi (VD: Cập nhật giá Q2/2026)..."
            className="w-full h-7 px-2.5 text-[12px] border border-amber-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>
      )}

      {/* THE QUOTATION VIEW (Matching Image Design) */}
      <div className="bg-white border-[1px] border-black rounded-sm overflow-hidden text-black font-sans shadow-sm">
        {/* Quotation Header */}
        <div className="p-6 border-b border-black">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <h2 className="text-xl font-bold uppercase tracking-wide">BẢNG BÁO GIÁ ĐẠI LÝ 2026</h2>
              <div className="mt-4 space-y-1 text-[13px]">
                <p><span className="font-semibold">Kinh doanh:</span> Nguyễn Văn Tập - 0962.864.222</p>
                <p><span className="font-semibold">Áp dụng từ:</span> {formatDate(detail.created_at)}</p>
              </div>
            </div>
            <div className="text-right flex-1">
              <h2 className="text-xl font-bold uppercase tracking-wide">CÔNG TY TNHH THƯƠNG MẠI ĐIỆN TỬ TLINK</h2>
              <p className="mt-4 text-[13px] italic"><span className="font-semibold not-italic">Địa chỉ:</span> Xuân Lai, Gia Bình, Bắc Ninh</p>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <p className="text-[12px] text-justify leading-relaxed">
              <span className="font-bold">Lưu ý:</span> Báo giá này dành riêng cho Quý Đại lý, mang tính nội bộ. Quý Đại lý vui lòng KHÔNG công khai dưới mọi hình thức để đảm bảo quyền lợi cho cả hai bên.
            </p>
            <div className="flex flex-col gap-1 mt-2">
              <div className="inline-flex items-center gap-2">
                <span className="w-40 h-5 bg-[#00AEEF] flex items-center justify-center text-[10px] font-bold text-white border border-black/20">Phần tô màu xanh</span>
                <span className="text-[11px]">là giá Đại lý niêm yết trên các phương tiện truyền thông và MXH</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <span className="w-40 h-5 bg-[#FFD700] flex items-center justify-center text-[10px] font-bold border border-black/20">Phần tô màu vàng</span>
                <span className="text-[11px]">là những sản phẩm thay đổi giá</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <span className="w-40 h-5 bg-[#F7941D] flex items-center justify-center text-[10px] font-bold text-white border border-black/20">Phần tô màu cam</span>
                <span className="text-[11px]">là những sản phẩm mới ra mắt</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quotation Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#D1D3D4] border-b border-black">
                <th className="border-r border-black py-2 px-1 font-bold w-12 text-center uppercase">STT</th>
                <th className="border-r border-black py-2 px-3 font-bold min-w-[220px] text-center uppercase">Thiết bị</th>
                <th className="border-r border-black py-2 px-3 font-bold w-[280px] text-center uppercase">Hình ảnh</th>
                <th className="border-r border-black py-2 px-3 font-bold w-32 text-center uppercase">Giá đại lý</th>
                <th className="border-r border-black py-2 px-3 font-bold w-32 text-center uppercase leading-tight">Giá bán lẻ<br/>thấp nhất</th>
                <th className="border-r border-black py-2 px-3 font-bold w-36 text-center uppercase leading-tight">Giá niêm yết<br/>truyền thông, MXH</th>
                <th className="py-2 px-3 font-bold w-28 text-center uppercase">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {/* Table Body Groups could go here - for now flat list */}
              <tr className="bg-[#E6E7E8] border-b border-black">
                <td colSpan={7} className="py-1 px-3 font-bold italic uppercase">MAIN - CÔNG SUẤT</td>
              </tr>

              {isBuilding ? (
                draftItems.map((item, index) => (
                  <tr key={item.product_id} className="border-b border-black hover:bg-gray-50 transition-colors group">
                    <td className="border-r border-black py-4 px-1 text-center font-semibold">{index + 1}</td>
                    <td className="border-r border-black py-4 px-3 align-top">
                      <div className="font-bold text-[14px] leading-snug">{item.product_name}</div>
                      <div className="text-[11px] mt-1.5 whitespace-pre-wrap text-gray-700 leading-normal">
                        - Loại: {item.product_unit || 'TB'}<br/>
                        - SKU: {item.product_sku}
                      </div>
                    </td>
                    <td className="border-r border-black py-2 px-2 text-center">
                      <div className="relative group/img inline-block">
                        {item.product_image ? (
                          <img src={item.product_image} alt="" className="max-h-32 max-w-full object-contain mx-auto" />
                        ) : (
                          <div className="w-40 h-24 bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 border border-dashed border-gray-300">Không có ảnh</div>
                        )}
                        <button
                          onClick={() => handleRemoveDraftItem(index)}
                          className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="border-r border-black py-2 px-1">
                      <CurrencyInput
                        value={item.dealer_price}
                        onChange={(val) => handleUpdateDraftItem(index, 'dealer_price', val)}
                        className="w-full h-8 text-right font-bold tabular-nums focus:outline-none focus:bg-amber-50 border-none px-2"
                      />
                    </td>
                    <td className="border-r border-black py-2 px-1">
                      <CurrencyInput
                        value={item.retail_price}
                        onChange={(val) => handleUpdateDraftItem(index, 'retail_price', val)}
                        className="w-full h-8 text-right font-bold tabular-nums focus:outline-none border-none px-2"
                      />
                    </td>
                    <td className="border-r border-black py-2 px-1 bg-[#00AEEF]/10">
                      <CurrencyInput
                        value={item.public_price}
                        onChange={(val) => handleUpdateDraftItem(index, 'public_price', val)}
                        className="w-full h-8 text-right font-bold tabular-nums focus:outline-none bg-transparent border-none px-2 text-[#0071BC]"
                      />
                    </td>
                    <td className="py-2 px-1">
                      <input
                        type="text"
                        value={item.note}
                        onChange={(e) => handleUpdateDraftItem(index, 'note', e.target.value)}
                        placeholder="..."
                        className="w-full h-8 text-[11px] focus:outline-none border-none px-2"
                      />
                    </td>
                  </tr>
                ))
              ) : (
                displayItems.map((item, index) => (
                  <tr key={item.id} className="border-b border-black hover:bg-gray-50 transition-colors">
                    <td className="border-r border-black py-6 px-1 text-center font-semibold align-middle">{index + 1}</td>
                    <td className="border-r border-black py-6 px-4 align-top max-w-[240px]">
                      <div className="font-bold text-[14px] leading-tight mb-2">{item.product_name_snapshot}</div>
                      <div className="text-[11px] text-gray-800 leading-normal">
                        - SKU: {item.product_sku_snapshot}<br/>
                        - ĐVT: {item.product_unit_snapshot}
                      </div>
                    </td>
                    <td className="border-r border-black py-3 px-3 text-center align-middle">
                      {item.product_image_snapshot ? (
                        <img src={item.product_image_snapshot} alt="" className="max-h-40 max-w-full object-contain mx-auto" />
                      ) : (
                        <div className="w-32 h-20 bg-gray-100 flex items-center justify-center mx-auto rounded border border-dashed border-gray-300">N/A</div>
                      )}
                    </td>
                    <td className={`border-r border-black py-3 px-4 text-right font-bold tabular-nums align-middle text-[14px] ${item.is_changed ? 'bg-[#FFD700]' : ''}`}>
                      {formatCurrency(item.dealer_price)}
                    </td>
                    <td className="border-r border-black py-3 px-4 text-right font-bold tabular-nums align-middle text-[14px]">
                      {formatCurrency(item.retail_price)}
                    </td>
                    <td className="border-r border-black py-3 px-4 text-right font-bold tabular-nums align-middle text-[15px] bg-[#00AEEF] text-black">
                      {formatCurrency(item.public_price)}
                    </td>
                    <td className={`py-3 px-3 text-center align-middle text-[12px] font-bold ${item.is_new ? 'text-[#F7941D]' : 'text-gray-700'}`}>
                      {item.is_new ? 'Sản phẩm mới' : (item.note || '-')}
                    </td>
                  </tr>
                ))
              )}

              {displayItems.length === 0 && !isBuilding && (
                <tr>
                  <td colSpan={7} className="text-center py-20 text-gray-400 italic">Chưa có dữ liệu sản phẩm trong bảng giá này</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Version History Footer */}
      {detail.versions.length > 0 && (
        <div className="bg-card border rounded-lg overflow-hidden mt-6">
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
            <History className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-[13px] font-medium">Lịch sử các phiên bản</h2>
          </div>
          <div className="divide-y">
            {detail.versions.map((v: PriceListVersion) => {
              const isSelected = v.id === activeVersionId;
              return (
              <div key={v.id} className={`flex items-center justify-between py-2.5 px-4 transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-primary' : 'hover:bg-muted/20'}`}>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-bold ${
                    v.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>v{v.version_number}</span>
                  <span className="text-[13px]">{v.changelog || 'Không có ghi chú thay đổi'}</span>
                  <span className="text-[11px] text-muted-foreground">{formatDate(v.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedVersionId(isSelected ? null : v.id)}
                    className={`inline-flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium rounded cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border hover:bg-accent'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    {isSelected ? 'Đang xem' : 'Xem'}
                  </button>
                  {v.status === 'draft' && (
                    <>
                      <button
                        onClick={() => handleEditVersion(v)}
                        disabled={updateVersionMutation.isPending || createVersionMutation.isPending}
                        className="inline-flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium border rounded hover:bg-accent disabled:opacity-40 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        Chỉnh sửa
                      </button>
                      <button
                        onClick={() => setVersionToDelete({ id: v.id, version_number: v.version_number })}
                        className="inline-flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-40 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        Xóa
                      </button>
                      <button
                        onClick={() => publishMutation.mutate({ priceListId: id!, versionId: v.id })}
                        disabled={publishMutation.isPending}
                        className="inline-flex items-center gap-1.5 h-7 px-3 text-[11px] font-bold text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-40 cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        Công bố
                      </button>
                    </>
                  )}
                </div>
              </div>
            );})}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddProducts && (
        <ProductPickerModal
          onAdd={handleAddProducts}
          onClose={() => setShowAddProducts(false)}
          excludeIds={draftItems.map((i) => i.product_id)}
        />
      )}

      {showAssignCustomers && (
        <CustomerAssignModal
          currentCustomerIds={(detail.assigned_customers ?? []).map((c) => c.customer_id)}
          onAssign={(ids) => assignMutation.mutate(ids)}
          onClose={() => setShowAssignCustomers(false)}
          isLoading={assignMutation.isPending}
        />
      )}

      {versionToDelete && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex flex-col items-center px-6 pt-7 pb-5 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-[16px] font-bold text-slate-900 mb-2">Xác nhận xóa</h3>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                Bạn có chắc chắn muốn xóa phiên bản <span className="font-bold text-slate-800">v{versionToDelete.version_number}</span> không?
                <br />
                Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center gap-2 px-6 pb-6">
              <button
                type="button"
                onClick={() => setVersionToDelete(null)}
                disabled={deleteVersionMutation.isPending}
                className="flex-1 h-10 text-[13px] font-medium border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => deleteVersionMutation.mutate(versionToDelete.id)}
                disabled={deleteVersionMutation.isPending}
                className="flex-1 h-10 text-[13px] font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 shadow-sm shadow-red-200"
              >
                {deleteVersionMutation.isPending ? 'Đang xóa...' : 'Xóa phiên bản'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// --- Component hỗ trợ nhập liệu tiền tệ ---
function CurrencyInput({ value, onChange, className }: { value: number; onChange: (val: number) => void; className?: string }) {
  const [displayValue, setDisplayValue] = useState(formatCurrency(value));

  // Cập nhật giá trị hiển thị khi value từ prop thay đổi (ví dụ khi reset form)
  useEffect(() => {
    setDisplayValue(formatCurrency(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Chỉ lấy các chữ số
    const rawValue = e.target.value.replace(/\D/g, '');
    const numericValue = rawValue ? parseInt(rawValue, 10) : 0;
    
    // Cập nhật state hiển thị ngay lập tức với định dạng
    setDisplayValue(formatCurrency(numericValue));
    
    // Gửi giá trị số thuần về cha
    onChange(numericValue);
  };

  return (
    <input
      type="text"
      value={displayValue === '-' ? '' : displayValue}
      onChange={handleChange}
      className={className}
    />
  );
}

// ============================================================
// Types & Sub-components (Kept compact)
// ============================================================
interface DraftItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_image: string | null;
  product_unit: string | null;
  dealer_price: number;
  retail_price: number;
  public_price: number;
  note: string;
}

function ProductPickerModal({ onAdd, onClose, excludeIds }: { onAdd: (products: Product[]) => void; onClose: () => void; excludeIds: string[]; }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Product[]>([]);
  const { data: res, isLoading } = useQuery({
    queryKey: ['products-picker', search],
    queryFn: () => productApi.list({ limit: 100, ...(search ? { search } : {}) }),
    staleTime: 5 * 60 * 1000,
  });
  const products: Product[] = (res?.data?.data ?? []).filter((p: Product) => !excludeIds.includes(p.id));
  const toggleSelect = (p: Product) => setSelected(prev => prev.find(x => x.id === p.id) ? prev.filter(x => x.id !== p.id) : [...prev, p]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-[14px] font-bold uppercase">Chọn thiết bị ({selected.length})</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-md cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Tìm tên thiết bị, SKU..." value={search} onChange={e => setSearch(e.target.value)} className="w-full h-9 pl-9 pr-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {isLoading ? <div className="p-4 text-center">Đang tải...</div> : products.map(p => {
            const isSel = selected.some(x => x.id === p.id);
            return (
              <button key={p.id} onClick={() => toggleSelect(p)} className={`w-full flex items-center gap-3 py-2 px-3 rounded-md text-left transition-colors border ${isSel ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted border-transparent'}`}>
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSel ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}>{isSel && <Check className="w-3 h-3 text-white" />}</div>
                {p.image_urls?.[0] ? <img src={p.image_urls[0]} className="w-10 h-10 object-contain bg-white border" /> : <div className="w-10 h-10 bg-gray-100" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate leading-tight">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">{p.sku} • {formatCurrency(p.base_price)}</p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t bg-muted/10">
          <button onClick={onClose} className="h-8 px-4 text-[12px] font-bold border rounded hover:bg-accent cursor-pointer">HUỶ</button>
          <button onClick={() => onAdd(selected)} disabled={selected.length === 0} className="h-8 px-4 text-[12px] font-bold text-white bg-primary rounded hover:bg-primary/90 disabled:opacity-40 cursor-pointer">THÊM VÀO BẢNG GIÁ</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CustomerAssignModal({ currentCustomerIds, onAssign, onClose, isLoading }: { currentCustomerIds: string[]; onAssign: (ids: string[]) => void; onClose: () => void; isLoading: boolean; }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: groupsRes } = useQuery({ queryKey: ['customer-groups-assign'], queryFn: () => customerGroupApi.list(), staleTime: 5 * 60 * 1000 });
  const { data: customersRes } = useQuery({ queryKey: ['customers-assign'], queryFn: () => customerApi.list({ limit: 500 }), staleTime: 5 * 60 * 1000 });

  const allGroups: any[] = groupsRes?.data?.data ?? [];
  const allCustomers: any[] = customersRes?.data?.data ?? [];

  const groupedCustomers = React.useMemo(() => {
    const map = new Map<string | null, any[]>();
    for (const c of allCustomers) {
      const key = c.customer_group_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [allCustomers]);

  const sections = React.useMemo(() => {
    const result: { id: string | null; name: string; customers: any[] }[] = [];
    const sortedGroups = [...allGroups].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (const g of sortedGroups) {
      const customers = groupedCustomers.get(g.id) ?? [];
      if (customers.length > 0) result.push({ id: g.id, name: g.name, customers });
    }
    const uncategorized = groupedCustomers.get(null) ?? [];
    if (uncategorized.length > 0) result.push({ id: null, name: 'Chưa phân nhóm', customers: uncategorized });
    return result;
  }, [allGroups, groupedCustomers]);

  useEffect(() => {
    if (sections.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set(sections.map(s => String(s.id))));
    }
  }, [sections]);

  const toggleCustomer = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleGroup = (section: { id: string | null; customers: any[] }) => {
    const assignable = section.customers.filter(c => !currentCustomerIds.includes(c.id));
    const assignableIds = assignable.map(c => c.id);
    const allSelected = assignableIds.every(id => selected.includes(id));
    if (allSelected) {
      setSelected(prev => prev.filter(id => !assignableIds.includes(id)));
    } else {
      setSelected(prev => [...new Set([...prev, ...assignableIds])]);
    }
  };

  const toggleExpanded = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const totalAssignable = allCustomers.filter(c => !currentCustomerIds.includes(c.id)).length;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border rounded-lg shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <div>
            <h2 className="text-[14px] font-bold uppercase tracking-wide">Gán bảng giá cho khách hàng</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {selected.length > 0 ? `Đã chọn ${selected.length} khách hàng` : `${totalAssignable} khách hàng chưa được gán`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-md cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sections.length === 0 ? (
            <p className="text-center py-14 text-[13px] text-muted-foreground">Tất cả khách hàng đã được gán</p>
          ) : (
            <div className="divide-y">
              {sections.map(section => {
                const groupKey = String(section.id);
                const isExpanded = expandedGroups.has(groupKey);
                const assignable = section.customers.filter(c => !currentCustomerIds.includes(c.id));
                const assignableIds = assignable.map(c => c.id);
                const allGroupSelected = assignableIds.length > 0 && assignableIds.every(id => selected.includes(id));
                const someGroupSelected = assignableIds.some(id => selected.includes(id));

                return (
                  <div key={groupKey}>
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/40 sticky top-0 z-10">
                      <button
                        onClick={() => toggleGroup(section)}
                        disabled={assignable.length === 0}
                        className="shrink-0 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title={assignable.length === 0 ? 'Tất cả đã được gán' : allGroupSelected ? 'Bỏ chọn nhóm' : 'Chọn cả nhóm'}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          allGroupSelected
                            ? 'bg-primary border-primary'
                            : someGroupSelected
                            ? 'bg-primary/30 border-primary/60'
                            : 'bg-white border-gray-300'
                        }`}>
                          {allGroupSelected && <Check className="w-3 h-3 text-white" />}
                          {!allGroupSelected && someGroupSelected && <div className="w-2 h-0.5 bg-primary rounded" />}
                        </div>
                      </button>

                      <button
                        onClick={() => toggleExpanded(groupKey)}
                        className="flex-1 flex items-center gap-2 text-left cursor-pointer min-w-0"
                      >
                        <span className="text-[12px] font-semibold text-foreground truncate">{section.name}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          ({assignable.length}/{section.customers.length})
                        </span>
                        <svg
                          className={`w-3.5 h-3.5 text-muted-foreground shrink-0 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="divide-y divide-border/50">
                        {section.customers.map(c => {
                          const isAssigned = currentCustomerIds.includes(c.id);
                          const isSel = selected.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              onClick={() => !isAssigned && toggleCustomer(c.id)}
                              disabled={isAssigned}
                              className={`w-full flex items-center gap-3 py-2.5 px-5 text-left transition-colors ${
                                isAssigned
                                  ? 'opacity-50 cursor-not-allowed bg-muted/20'
                                  : isSel
                                  ? 'bg-primary/5 cursor-pointer'
                                  : 'hover:bg-muted/30 cursor-pointer'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                isAssigned
                                  ? 'bg-emerald-100 border-emerald-300'
                                  : isSel
                                  ? 'bg-primary border-primary'
                                  : 'bg-white border-gray-300'
                              }`}>
                                {isAssigned && <Check className="w-3 h-3 text-emerald-600" />}
                                {!isAssigned && isSel && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium leading-tight truncate">{c.customer_name}</p>
                                <p className="text-[11px] text-muted-foreground">{c.phone_number || '-'}</p>
                              </div>
                              {isAssigned && (
                                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                                  Đã gán
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t bg-muted/10">
          <button onClick={onClose} className="h-8 px-4 text-[12px] font-bold border rounded hover:bg-accent cursor-pointer">HUỶ</button>
          <button
            onClick={() => onAssign(selected)}
            disabled={selected.length === 0 || isLoading}
            className="h-8 px-4 text-[12px] font-bold text-white bg-primary rounded hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
          >
            {isLoading ? 'ĐANG GÁN...' : `GÁN CHO ${selected.length} KHÁCH`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
