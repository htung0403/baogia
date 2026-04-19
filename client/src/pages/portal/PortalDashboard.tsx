import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { priceListApi } from '@/api/client';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';
import { FileSpreadsheet, Clock, ArrowUpRight } from 'lucide-react';

export default function PortalDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: res, isLoading } = useQuery({
    queryKey: ['portal-price-lists'],
    queryFn: () => priceListApi.list({ limit: 50, sort: 'assigned_at', order: 'desc' }),
    staleTime: 30 * 1000,
  });

  const priceLists = (res?.data?.data ?? []) as any[];
  
  // Lấy 3 báo giá mới nhất để làm "Hoạt động gần đây"
  const recentPriceLists = [...priceLists].slice(0, 3);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Xin chào, {user?.profile.display_name || user?.customer?.customer_name || 'Khách hàng'}
        </h1>
        <p className="text-[14px] text-slate-500 mt-1">
          {user?.customer?.customer_name || 'Cổng báo giá dành cho khách hàng'}
        </p>
      </div>

      {/* Stats & Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tài liệu</span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-slate-900 leading-none">{priceLists.length}</p>
          <p className="text-[13px] font-medium text-slate-500 mt-2">Tổng số báo giá được nhận</p>
        </div>
      </div>

      {/* Recent Activity */}
      {priceLists.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="text-[14px] font-bold text-slate-800">Hoạt động gần đây</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentPriceLists.map((pl) => (
              <div 
                key={`recent-${pl.id}`}
                onClick={() => navigate(`/portal/price-lists/${pl.id}`)}
                className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-amber-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-bold text-slate-900 truncate group-hover:text-amber-600 transition-colors">{pl.title}</p>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-500 transition-all" />
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Cập nhật: {formatDate(pl.assigned_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price Lists */}
      <div className="pt-2">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
          </div>
          <h2 className="text-[14px] font-bold text-slate-800">Danh sách Báo giá</h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : priceLists.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-slate-300 rounded-xl">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <FileSpreadsheet className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-[15px] font-bold text-slate-900">Chưa có báo giá nào</h3>
            <p className="text-[13px] text-slate-400 mt-1 max-w-[280px] mx-auto">Vui lòng liên hệ quản trị viên để được cấp quyền xem báo giá.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {priceLists.map((pl) => (
              <div
                key={String(pl.id)}
                onClick={() => navigate(`/portal/price-lists/${pl.id}`)}
                className="group bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/5 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                    <FileSpreadsheet className="w-4.5 h-4.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0" />
                </div>
                <h3 className="text-[14px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {String(pl.title)}
                </h3>
                {pl.description ? (
                  <p className="text-[12px] text-slate-500 mt-1.5 line-clamp-2 min-h-[32px]">
                    {String(pl.description)}
                  </p>
                ) : (
                  <p className="text-[12px] text-slate-300 italic mt-1.5 min-h-[32px]">Không có mô tả</p>
                )}
                <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-slate-50 text-[11px] text-slate-400 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Ngày nhận: {formatDate(String(pl.assigned_at))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
