import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { priceListApi } from '@/api/client';
import { formatDate } from '@/lib/utils';
import { FileSpreadsheet, Clock, ArrowUpRight } from 'lucide-react';

export default function PortalPriceListsPage() {
  const navigate = useNavigate();

  const { data: res, isLoading } = useQuery({
    queryKey: ['portal-price-lists'],
    queryFn: () => priceListApi.list({ limit: 100, sort: 'assigned_at', order: 'desc' }),
    staleTime: 30 * 1000,
  });

  const priceLists = (res?.data?.data ?? []) as any[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Danh sách Báo giá</h1>
          <p className="text-[14px] text-slate-500 mt-1">Tất cả các báo giá bạn đã nhận được từ hệ thống</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : priceLists.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-slate-300 rounded-xl shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <FileSpreadsheet className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-[15px] font-bold text-slate-900">Chưa có báo giá nào</h3>
          <p className="text-[13px] text-slate-400 mt-1 max-w-[280px] mx-auto">Vui lòng liên hệ quản trị viên để được cấp quyền xem các báo giá mới nhất.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {priceLists.map((pl) => (
            <div
              key={String(pl.id)}
              onClick={() => navigate(`/portal/price-lists/${pl.id}`)}
              className="group bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/5 transition-all relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-500" />
              
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100 group-hover:bg-emerald-500 group-hover:border-emerald-600 transition-all duration-300 shadow-sm">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" />
                </div>
                <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 group-hover:bg-emerald-50 group-hover:border-emerald-200 transition-all">
                  <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-all" />
                </div>
              </div>

              <h3 className="text-[15px] font-bold text-slate-900 group-hover:text-emerald-700 transition-colors leading-snug">
                {String(pl.title)}
              </h3>
              
              {pl.description ? (
                <p className="text-[12px] text-slate-500 mt-2 line-clamp-2 min-h-[32px] leading-relaxed">
                  {String(pl.description)}
                </p>
              ) : (
                <p className="text-[12px] text-slate-300 italic mt-2 min-h-[32px]">Không có mô tả chi tiết</p>
              )}

              <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-slate-50 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-emerald-500/50" />
                <span>Nhận lúc: {formatDate(String(pl.assigned_at))}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
