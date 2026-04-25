import { useQuery } from '@tanstack/react-query';
import { trackingApi } from '@/api/client';
import { formatDate, formatDuration } from '@/lib/utils';
import { useState } from 'react';
import {
  BarChart3,
  Users,
  Eye,
  Clock,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Tooltip,
  BarChart as ReBarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar,
} from 'recharts';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'customers'>('overview');
  const [customerPage, setCustomerPage] = useState(1);

  const { data: overviewRes, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => trackingApi.getOverview(),
    staleTime: 5000, // Đặt 5 giây để tránh spam 429
    refetchOnWindowFocus: true,
  });

  const { data: activityRes, isLoading: activityLoading } = useQuery({
    queryKey: ['customer-activity', customerPage],
    queryFn: () => trackingApi.getCustomerActivity({ page: customerPage, limit: 20 }),
    staleTime: 5000,
    enabled: activeTab === 'customers',
  });

  const overview = overviewRes?.data?.data;
  const activity = activityRes?.data?.data ?? [];
  const activityMeta = activityRes?.data?.meta;

  const totalSessions = overview?.total_sessions ?? 0;
  const uniqueCustomers = overview?.unique_customers ?? 0;
  const recentSessions = overview?.recent_sessions ?? [];
  const totalDurationSeconds = recentSessions.reduce(
    (sum: number, session: Record<string, unknown>) => sum + ((session.duration_seconds as number) ?? 0),
    0
  );
  const avgDurationSeconds = recentSessions.length > 0 ? totalDurationSeconds / recentSessions.length : 0;
  const topProductViews = (overview?.top_products?.[0]?.count as number) ?? 0;

  const comparisonRaw = [
    { metric: 'Lượt xem', value: totalSessions },
    { metric: 'Khách hàng', value: uniqueCustomers },
    { metric: 'TG trung bình', value: Math.round(avgDurationSeconds) },
    { metric: 'SP top', value: topProductViews },
  ];
  const maxComparisonValue = Math.max(...comparisonRaw.map((item) => item.value), 1);
  const hasComparisonData = comparisonRaw.some((item) => item.value > 0);
  const radarData = comparisonRaw.map((item) => ({
    ...item,
    normalized: Math.round((item.value / maxComparisonValue) * 100),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Thống kê & Phân tích</h1>
        <p className="text-[14px] text-slate-500 mt-1">Theo dõi hoạt động xem báo giá của khách hàng</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-[13px] font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'overview' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Tổng quan
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`px-4 py-2 text-[13px] font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'customers' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Theo khách hàng
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats - Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
                  <Eye className="w-5 h-5 text-indigo-600" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lượt xem</span>
              </div>
              <p className="text-3xl font-bold tabular-nums text-slate-900 leading-none">{overview?.total_sessions ?? 0}</p>
              <p className="text-[13px] font-medium text-slate-500 mt-2">Tổng lượt xem</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Khách hàng</span>
              </div>
              <p className="text-3xl font-bold tabular-nums text-slate-900 leading-none">{overview?.unique_customers ?? 0}</p>
              <p className="text-[13px] font-medium text-slate-500 mt-2">Khách đã xem</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Xu hướng</span>
              </div>
              <p className="text-[16px] font-bold text-slate-900 truncate mb-1">
                {overview?.top_products?.[0]?.name ?? '-'}
              </p>
              <p className="text-[13px] font-medium text-slate-500">SP xem nhiều nhất</p>
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-indigo-600" />
              </div>
              <h2 className="text-[14px] font-bold text-slate-800">Lượt xem gần đây (30 ngày)</h2>
            </div>
            {overviewLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 bg-slate-50 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b bg-slate-50/30">
                      <th className="text-left py-3.5 px-5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Khách hàng</th>
                      <th className="text-left py-3.5 px-5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Bảng giá</th>
                      <th className="text-left py-3.5 px-5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Thời gian</th>
                      <th className="text-right py-3.5 px-5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Thời lượng</th>
                      <th className="text-left py-3.5 px-5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Thiết bị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(overview?.recent_sessions ?? []).map((session: Record<string, unknown>) => (
                      <tr key={session.id as string} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                              <Users className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-bold text-slate-900">
                              {(session.customers as Record<string, string>)?.customer_name || `Khách #${(session.customer_id as string)?.slice(0, 5) || 'Ẩn danh'}`}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-slate-600 font-medium">
                          {(session.price_lists as Record<string, string>)?.title || `Báo giá #${(session.price_list_id as string)?.slice(0, 5)}`}
                        </td>
                        <td className="py-3.5 px-5 text-[12px] text-slate-400 tabular-nums font-medium">
                          {formatDate(session.started_at as string)}
                        </td>
                        <td className="py-3.5 px-5 text-right tabular-nums text-[12px] font-bold text-indigo-600 bg-indigo-50/30">
                          {formatDuration(session.duration_seconds as number)}
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            {(session.device as string) ?? '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!overview?.recent_sessions || overview.recent_sessions.length === 0) && (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-[14px] text-slate-400">
                          Chưa có dữ liệu
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top Products */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-amber-600" />
              </div>
              <h2 className="text-[14px] font-bold text-slate-800">Sản phẩm xem nhiều nhất</h2>
            </div>
            <div className="p-5 space-y-4">
              {(overview?.top_products ?? []).map((product: Record<string, unknown>, index: number) => {
                const maxCount = (overview?.top_products?.[0] as Record<string, unknown>)?.count as number ?? 1;
                const pct = Math.round(((product.count as number) / maxCount) * 100);
                return (
                  <div key={product.product_id as string} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold ${
                          index === 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="text-[13px] font-bold text-slate-800">{product.name as string}</span>
                      </div>
                      <span className="text-[12px] font-bold text-indigo-600 tabular-nums bg-indigo-50 px-2 py-0.5 rounded-full">
                        {product.count as number} lượt
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          index === 0 ? 'bg-amber-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {(!overview?.top_products || overview.top_products.length === 0) && (
                <div className="text-center py-8 text-slate-400">Chưa có dữ liệu</div>
              )}
            </div>
          </div>

          {/* Visual Axis Comparison */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
              </div>
              <h2 className="text-[14px] font-bold text-slate-800">Biểu đồ so sánh trực quan theo trục</h2>
            </div>
            <div className="p-5">
              {!hasComparisonData ? (
                <div className="h-[260px] flex items-center justify-center text-[13px] text-slate-400 border border-slate-100 rounded-xl bg-slate-50/40">
                  Chưa đủ dữ liệu để hiển thị biểu đồ so sánh.
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="h-[320px] border border-slate-100 rounded-xl p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} outerRadius="72%">
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Radar
                          name="Tỷ trọng tương đối"
                          dataKey="normalized"
                          stroke="#4f46e5"
                          fill="#6366f1"
                          fillOpacity={0.25}
                          strokeWidth={2}
                        />
                        <Tooltip
                          formatter={(value: number, _name: string, item: any) => [`${item?.payload?.value ?? value}`, 'Giá trị thực']}
                          labelFormatter={(label) => `${label}`}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-[320px] border border-slate-100 rounded-xl p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <ReBarChart data={comparisonRaw} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => [value, 'Giá trị']} />
                        <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                      </ReBarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              <p className="text-[12px] text-slate-500 mt-3">
                So sánh nhanh bằng 2 góc nhìn: radar (tương quan) và cột (giá trị thực).
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-slate-50/30">
                  <th className="text-left py-3.5 px-5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Khách hàng</th>
                  <th className="text-right py-3.5 px-5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Số lượt xem</th>
                  <th className="text-right py-3.5 px-5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Tổng thời gian</th>
                  <th className="text-left py-3.5 px-5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Lần cuối xem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activityLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={4} className="py-4 px-5">
                        <div className="h-8 bg-slate-50 animate-pulse rounded-lg" />
                      </td>
                    </tr>
                  ))
                ) : activity.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-[14px] text-slate-400">
                      Chưa có dữ liệu
                    </td>
                  </tr>
                ) : (
                  activity.map((item: Record<string, unknown>) => (
                    <tr key={item.customer_id as string} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
                            <Users className="w-4 h-4 text-indigo-600" />
                          </div>
                          <span className="font-bold text-slate-900">{item.customer_name as string}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-right tabular-nums">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-bold">
                          {item.total_sessions as number}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right tabular-nums text-[13px] font-bold text-indigo-600">
                        {formatDuration(item.total_duration_seconds as number)}
                      </td>
                      <td className="py-4 px-5 text-[12px] text-slate-400 font-medium tabular-nums">
                        {formatDate(item.last_viewed_at as string)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {activityMeta && activityMeta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t">
              <p className="text-[12px] text-muted-foreground">
                Trang {activityMeta.page} / {activityMeta.totalPages}
              </p>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                  disabled={customerPage === 1}
                  className="p-1 hover:bg-accent rounded-md disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCustomerPage((p) => Math.min(activityMeta.totalPages, p + 1))}
                  disabled={customerPage === activityMeta.totalPages}
                  className="p-1 hover:bg-accent rounded-md disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
