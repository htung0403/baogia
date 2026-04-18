import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trackingApi } from '@/api/client';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';
import { History, Clock, FileSpreadsheet, Info, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PortalHistoryPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [localHistory, setLocalHistory] = useState<any[]>([]);
  
  const customerId = user?.customer?.id || (user as any)?.customer_id || (user as any)?.id;

  // Query này dùng endpoint /me để tránh 403
  const { data: res, isLoading, error } = useQuery({
    queryKey: ['portal-history', customerId],
    queryFn: () => trackingApi.getMyViewHistory({ limit: 50 }),
    enabled: !!customerId,
    staleTime: 5000,
    retry: false
  });

  // Load lịch sử từ LocalStorage để dự phòng
  useEffect(() => {
    const historyKey = 'portal_view_history';
    const raw = localStorage.getItem(historyKey);
    if (raw) {
      try {
        setLocalHistory(JSON.parse(raw));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const isForbidden = (error as any)?.response?.status === 403;
  
  // Quyết định dùng dữ liệu nào: Kết hợp cả Backend và Local, ưu tiên Local mới nhất
  const apiSessions = Array.isArray(res?.data?.data) ? res.data.data : [];
  
  // Chuyển đổi format API về giống format Local để hiển thị đồng nhất
  const normalizedApi = apiSessions.map((s: any) => ({
    id: s.id,
    price_list_id: s.price_list_id,
    title: s.price_lists?.title || 'Báo giá',
    viewed_at: s.started_at,
    version: s.price_list_versions?.version_number
  }));

  // Gộp dữ liệu: Ưu tiên LocalStorage (vì nó nhanh và luôn mới nhất khi vừa click)
  // Sau đó lọc bỏ những cái trùng price_list_id ở API
  const combined = [...localHistory];
  normalizedApi.forEach((apiItem: any) => {
    if (!combined.find(localItem => localItem.price_list_id === apiItem.price_list_id)) {
      combined.push(apiItem);
    }
  });

  const displayHistory = combined.sort((a, b) => 
    new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lịch sử xem</h1>
          <p className="text-[14px] text-slate-500 mt-1">Những báo giá bạn đã truy cập và xem gần đây</p>
        </div>
      </div>

      {isForbidden && localHistory.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-4 items-start text-amber-800 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <Info className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-[13px] leading-relaxed font-medium">
            Hệ thống đang hiển thị lịch sử xem lưu cục bộ trên trình duyệt. 
            Dữ liệu có thể khác biệt nếu bạn đăng nhập từ thiết bị khác.
          </p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {isLoading && displayHistory.length === 0 ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : displayHistory.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <History className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-[15px] font-bold text-slate-900">Bạn chưa xem báo giá nào</h3>
            <p className="text-[13px] text-slate-400 mt-1">Lịch sử truy cập của bạn sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayHistory.map((item: any) => {
              const title = item.title;
              const date = item.viewed_at;
              const version = item.version;
              const priceListId = item.price_list_id;

              return (
                <div 
                  key={item.id} 
                  onClick={() => navigate(`/portal/price-lists/${priceListId}`)}
                  className="px-5 py-4 hover:bg-slate-50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors shadow-sm">
                        <FileSpreadsheet className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors leading-snug">
                            {title}
                          </p>
                          {version && (
                            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded border border-indigo-100 uppercase tracking-tighter shrink-0">
                              v{version}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[12px] text-slate-400 mt-1 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(date)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <span className="text-[12px] text-emerald-600 font-bold opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        Xem lại
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                        <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
