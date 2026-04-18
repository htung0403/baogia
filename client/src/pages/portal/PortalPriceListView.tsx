import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { priceListApi, trackingApi } from '@/api/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PriceListDetail, PriceListItem } from '@/types';
import { ArrowLeft, Search, Clock, Download } from 'lucide-react';
import { useState } from 'react';

export default function PortalPriceListView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const sessionIdRef = useRef<string | null>(null);
  const hasStartedRef = useRef<string | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['portal-price-list', id],
    queryFn: () => priceListApi.get(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });

  const detail: PriceListDetail | null = res?.data?.data ?? null;

  // Tracking Logic
  const startSessionMutation = useMutation({
    mutationFn: (data: { price_list_id: string; version_id?: string; device?: string }) =>
      trackingApi.startSession(data),
    onSuccess: (res) => {
      sessionIdRef.current = res?.data?.data?.id ?? null;
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: (sessionId: string) => trackingApi.endSession(sessionId),
  });

  const trackItemMutation = useMutation({
    mutationFn: (data: { sessionId: string; product_id: string; view_duration_seconds?: number }) =>
      trackingApi.trackItemView(data.sessionId, {
        product_id: data.product_id,
        view_duration_seconds: data.view_duration_seconds,
      }),
  });

  useEffect(() => {
    if (detail?.id) {
      if (hasStartedRef.current === detail.id) return;
      hasStartedRef.current = detail.id;
      const device = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
      startSessionMutation.mutate({
        price_list_id: detail.id,
        version_id: detail.current_version?.id,
        device,
      });

      try {
        const historyKey = 'portal_view_history';
        const rawHistory = localStorage.getItem(historyKey);
        let history = rawHistory ? JSON.parse(rawHistory) : [];
        const newEntry = {
          id: `local-${Date.now()}`,
          price_list_id: id,
          title: detail.title,
          viewed_at: new Date().toISOString(),
          version: detail.current_version?.version_number
        };
        const filteredHistory = history.filter((h: any) => h.price_list_id !== id);
        history = [newEntry, ...filteredHistory].slice(0, 20);
        localStorage.setItem(historyKey, JSON.stringify(history));
      } catch (e) {
        console.error(e);
      }
    }
    return () => {
      if (sessionIdRef.current) {
        endSessionMutation.mutate(sessionIdRef.current);
        sessionIdRef.current = null;
      }
      hasStartedRef.current = null;
    };
  }, [detail?.id]);

  const handleProductClick = (productId: string) => {
    if (sessionIdRef.current) {
      trackItemMutation.mutate({
        sessionId: sessionIdRef.current,
        product_id: productId,
        view_duration_seconds: 1,
      });
    }
  };

  const filteredItems: PriceListItem[] = (detail?.items ?? []).filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.product_name_snapshot.toLowerCase().includes(q) ||
      item.product_sku_snapshot.toLowerCase().includes(q)
    );
  });

  const handleDownloadCSV = () => {
    if (!detail) return;
    const headers = ['STT', 'Thiết bị', 'SKU', 'DVT', 'Giá đại lý', 'Giá lẻ thấp nhất', 'Giá niêm yết', 'Ghi chú'];
    const rows = detail.items.map((it, idx) => [idx + 1, it.product_name_snapshot, it.product_sku_snapshot, it.product_unit_snapshot, it.dealer_price, it.retail_price, it.public_price, it.note]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bao_gia_${detail.title}.csv`;
    link.click();
  };

  if (isLoading) return <div className="p-8 animate-pulse bg-slate-50 h-screen" />;

  if (!detail) {
    return (
      <div className="text-center py-16">
        <p className="text-[13px] text-muted-foreground">Bảng giá không tồn tại hoặc bạn không có quyền truy cập</p>
        <button onClick={() => navigate('/portal')} className="mt-3 text-[13px] text-primary underline cursor-pointer">Quay lại</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Portal Actions - Cập nhật giao diện thanh công cụ bên ngoài ra FULL WIDTH có BORDER và BO GÓC cho container bên trong */}
      <div className="bg-slate-50/50 border-b-2 border-slate-200 px-4 py-4 sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/portal')} 
              className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all cursor-pointer group"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 truncate">{detail.title}</h1>
              <div className="flex items-center gap-2 mt-0.5 text-[12px] text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Cập nhật: {formatDate(detail.created_at)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative group flex-1 sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Tìm kiếm thiết bị..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="w-full h-10 pl-10 pr-4 text-[13px] border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
              />
            </div>
            <button 
              onClick={handleDownloadCSV} 
              className="inline-flex items-center gap-2 h-10 px-5 text-[13px] font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Tải CSV
            </button>
          </div>
        </div>
      </div>

      {/* GIỮ NGUYÊN BẢNG BÁO GIÁ THEO THIẾT KẾ GỐC (Bản cứng) */}
      <div className="bg-white border-[1px] border-black rounded-sm overflow-hidden text-black font-sans shadow-lg mx-auto" style={{ maxWidth: '1000px' }}>
        {/* Header */}
        <div className="p-6 border-b border-black">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <h2 className="text-xl font-bold uppercase">BẢNG BÁO GIÁ ĐẠI LÝ 2026</h2>
              <div className="mt-4 space-y-1 text-[13px]">
                <p><span className="font-semibold">Phụ trách:</span> Nguyễn Văn Tập - 0962.864.222</p>
                <p><span className="font-semibold">Ngày cập nhật:</span> {formatDate(detail.created_at)}</p>
              </div>
            </div>
            <div className="text-right flex-1">
              <h2 className="text-xl font-bold uppercase leading-tight">CÔNG TY TNHH THƯƠNG MẠI<br/>ĐIỆN TỬ TLINK</h2>
              <p className="mt-4 text-[13px] italic">Địa chỉ: Xuân Lai, Gia Bình, Bắc Ninh</p>
            </div>
          </div>

          <div className="space-y-2 mt-4 bg-gray-50 p-3 rounded border border-black/10">
            <p className="text-[12px] leading-relaxed">
              <span className="font-bold text-red-600 uppercase">Lưu ý:</span> Báo giá này dành riêng cho Quý Đại lý, mang tính nội bộ. Quý Đại lý vui lòng <span className="font-bold underline uppercase">KHÔNG công khai</span> dưới mọi hình thức để đảm bảo quyền lợi cho cả hai bên.
            </p>
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="inline-flex items-center gap-2">
                <span className="w-32 h-5 bg-[#00AEEF] flex items-center justify-center text-[9px] font-bold text-white border border-black/20">MÀU XANH</span>
                <span className="text-[11px]">Giá niêm yết trên các phương tiện truyền thông và MXH</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <span className="w-32 h-5 bg-[#FFD700] flex items-center justify-center text-[9px] font-bold border border-black/20">MÀU VÀNG</span>
                <span className="text-[11px]">Sản phẩm thay đổi giá so với bản trước</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <span className="w-32 h-5 bg-[#F7941D] flex items-center justify-center text-[9px] font-bold text-white border border-black/20">MÀU CAM</span>
                <span className="text-[11px]">Sản phẩm mới ra mắt</span>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#D1D3D4] border-b border-black">
                <th className="border-r border-black py-2.5 px-1 font-bold w-12 text-center uppercase">STT</th>
                <th className="border-r border-black py-2.5 px-3 font-bold min-w-[200px] text-center uppercase">Thiết bị</th>
                <th className="border-r border-black py-2.5 px-3 font-bold w-64 text-center uppercase">Hình ảnh</th>
                <th className="border-r border-black py-2.5 px-3 font-bold w-32 text-center uppercase">Giá đại lý</th>
                <th className="border-r border-black py-2.5 px-3 font-bold w-32 text-center uppercase leading-tight">Giá bán lẻ<br/>thấp nhất</th>
                <th className="border-r border-black py-2.5 px-3 font-bold w-40 text-center uppercase leading-tight">Giá niêm yết<br/>truyền thông, MXH</th>
                <th className="py-2.5 px-3 font-bold w-28 text-center uppercase">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-[#E6E7E8] border-b border-black">
                <td colSpan={7} className="py-1.5 px-4 font-bold italic uppercase tracking-wider">DANH MỤC THIẾT BỊ</td>
              </tr>
              {filteredItems.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-20 text-gray-400 italic">Không tìm thấy sản phẩm</td></tr>
              ) : (
                filteredItems.map((item, index) => (
                  <tr key={item.id} className="border-b border-black hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleProductClick(item.product_id)}>
                    <td className="border-r border-black py-6 px-1 text-center font-semibold align-middle">{index + 1}</td>
                    <td className="border-r border-black py-6 px-4 align-top max-w-[240px]">
                      <div className="font-bold text-[14px] leading-tight mb-2 uppercase">{item.product_name_snapshot}</div>
                      <div className="text-[11px] text-gray-800 leading-normal space-y-0.5">
                        <p>• SKU: {item.product_sku_snapshot}</p>
                        <p>• ĐVT: {item.product_unit_snapshot}</p>
                      </div>
                    </td>
                    <td className="border-r border-black py-3 px-3 text-center align-middle">
                      {item.product_image_snapshot ? (
                        <img src={item.product_image_snapshot} alt="" className="max-h-40 max-w-full object-contain mx-auto" />
                      ) : (
                        <div className="w-32 h-20 bg-gray-100 flex items-center justify-center mx-auto rounded border border-dashed border-gray-300 text-[10px] text-gray-400">Không có ảnh</div>
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
                      {item.is_new ? 'TB MỚI' : (item.note || '-')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 max-w-[1000px] mx-auto">
        <p>Hệ thống ghi nhận thời gian xem và thiết bị truy cập để tối ưu trải nghiệm</p>
        <p>© 2026 TLINK Electronic</p>
      </div>
    </div>
  );
}
