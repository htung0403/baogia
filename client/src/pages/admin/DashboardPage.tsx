import { useQuery } from '@tanstack/react-query';
import { trackingApi, productApi, customerApi, priceListApi } from '@/api/client';
import { formatDate, formatDuration } from '@/lib/utils';
import {
  Package,
  Users,
  FileSpreadsheet,
  Eye,
  TrendingUp,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();

  const { data: productsRes } = useQuery({
    queryKey: ['products', { limit: 1 }],
    queryFn: () => productApi.list({ limit: 1 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: customersRes } = useQuery({
    queryKey: ['customers', { limit: 1 }],
    queryFn: () => customerApi.list({ limit: 1 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: priceListsRes } = useQuery({
    queryKey: ['price-lists', { limit: 1 }],
    queryFn: () => priceListApi.list({ limit: 1 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: analyticsRes, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => trackingApi.getOverview(),
    staleTime: 5000, // Đặt 5 giây
    refetchOnWindowFocus: true,
  });

  const totalProducts = productsRes?.data?.meta?.total ?? 0;
  const totalCustomers = customersRes?.data?.meta?.total ?? 0;
  const totalPriceLists = priceListsRes?.data?.meta?.total ?? 0;
  const analytics = analyticsRes?.data?.data;

  const statCards = [
    {
      label: 'Sản phẩm',
      value: totalProducts,
      icon: Package,
      href: '/admin/products',
      color: 'blue',
      bgColor: 'bg-blue-500/10',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Khách hàng',
      value: totalCustomers,
      icon: Users,
      href: '/admin/customers',
      color: 'emerald',
      bgColor: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Bảng giá',
      value: totalPriceLists,
      icon: FileSpreadsheet,
      href: '/admin/price-lists',
      color: 'amber',
      bgColor: 'bg-amber-500/10',
      iconColor: 'text-amber-600',
    },
    {
      label: 'Lượt xem',
      value: analytics?.total_sessions ?? 0,
      icon: Eye,
      href: '/admin/analytics',
      color: 'indigo',
      bgColor: 'bg-indigo-500/10',
      iconColor: 'text-indigo-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bảng điều khiển</h1>
        <p className="text-[14px] text-slate-500 mt-1">Tổng quan hệ thống CRM Báo Giá</p>
      </div>

      {/* Stat Cards - Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            onClick={() => navigate(stat.href)}
            className="bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-slate-300 hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-slate-400 transition-all transform translate-y-1 group-hover:translate-y-0" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-slate-900 tracking-tight">{stat.value}</p>
              <p className="text-[13px] font-medium text-slate-500 mt-1">{stat.label}</p>
            </div>
            <div className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-${stat.color}-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
          </div>
        ))}
      </div>

      {/* Bento Grid - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Views */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-[14px] font-bold text-slate-800">Lượt xem gần đây</h2>
          </div>
          <div className="p-3">
            {analyticsLoading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-slate-50 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {(analytics?.recent_sessions ?? []).slice(0, 6).map((session: Record<string, unknown>) => (
                  <div
                    key={session.id as string}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-all text-[13px] border border-transparent hover:border-slate-100"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate leading-tight">
                          {(session.customers as Record<string, string>)?.company_name || `Khách #${(session.customer_id as string)?.slice(0, 5) || 'Ẩn danh'}`}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                          <FileSpreadsheet className="w-3 h-3 opacity-70" />
                          {(session.price_lists as Record<string, string>)?.title || `Báo giá #${(session.price_list_id as string)?.slice(0, 5)}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="text-[11px] font-medium text-slate-600">
                        {formatDate(session.started_at as string)}
                      </p>
                      <div className="flex items-center justify-end gap-1 text-[11px] text-slate-400 mt-1">
                        <Clock className="w-3 h-3" />
                        <span className="tabular-nums">{formatDuration(session.duration_seconds as number)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {(!analytics?.recent_sessions || analytics.recent_sessions.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <Clock className="w-8 h-8 opacity-20 mb-2" />
                    <p className="text-[13px]">Chưa có lượt xem nào</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="text-[14px] font-bold text-slate-800">Sản phẩm xem nhiều nhất</h2>
          </div>
          <div className="p-3">
            {analyticsLoading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-slate-50 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {(analytics?.top_products ?? []).slice(0, 6).map((product: Record<string, unknown>, index: number) => (
                  <div
                    key={product.product_id as string}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-all text-[13px] border border-transparent hover:border-slate-100"
                  >
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm ${
                      index === 0 ? 'bg-amber-500 text-white' : 
                      index === 1 ? 'bg-slate-400 text-white' :
                      index === 2 ? 'bg-orange-400 text-white' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate leading-tight">{product.name as string}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] uppercase tracking-wider font-medium">{product.sku as string}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[11px] font-bold tabular-nums border border-indigo-100">
                        {product.count as number} lượt
                      </span>
                    </div>
                  </div>
                ))}
                {(!analytics?.top_products || analytics.top_products.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <TrendingUp className="w-8 h-8 opacity-20 mb-2" />
                    <p className="text-[13px]">Chưa có dữ liệu</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
