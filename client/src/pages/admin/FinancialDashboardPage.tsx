import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financialApi } from '@/api/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CircleCheckBig, Gift, TriangleAlert, Wallet } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { FinancialKPIs, RevenueDataPoint, TopCustomerData, ApiResponse } from '@/types';

// ──────────────────────────────────────────────────────────────────────────────
// KPI CARD
// ──────────────────────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, color, icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: 'indigo' | 'emerald' | 'red' | 'amber';
  icon: ReactNode;
}) {
  const colorMap = {
    indigo: 'from-indigo-500/10 to-indigo-500/5 border-indigo-200 text-indigo-600',
    emerald:'from-emerald-500/10 to-emerald-500/5 border-emerald-200 text-emerald-600',
    red:    'from-red-500/10 to-red-500/5 border-red-200 text-red-600',
    amber:  'from-amber-500/10 to-amber-500/5 border-amber-200 text-amber-600',
  };
  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl p-4 flex items-start gap-3`}>
      <div className="text-2xl">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-[20px] font-bold">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// CUSTOM TOOLTIP
// ──────────────────────────────────────────────────────────────────────────────

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-[12px]">
      <p className="font-semibold mb-1">{label}</p>
      <p className="text-indigo-600">Doanh thu: <strong>{formatCurrency(payload[0]?.value)}</strong></p>
      <p className="text-muted-foreground">Số đơn: {payload[1]?.value ?? 0}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────────────────────────

export default function FinancialDashboardPage() {
  const [period, setPeriod] = useState<'daily' | 'monthly'>('monthly');
  const [revBy, setRevBy]   = useState<'revenue' | 'debt'>('revenue');

  // KPIs
  const { data: kpiResp, isLoading: kpiLoading } = useQuery({
    queryKey: ['financial-kpis'],
    queryFn: () => financialApi.getKPIs(),
    staleTime: 60_000,
  });
  const kpis: FinancialKPIs | null = (kpiResp?.data as ApiResponse<FinancialKPIs>)?.data ?? null;

  // Revenue chart
  const { data: revResp, isLoading: revLoading } = useQuery({
    queryKey: ['revenue', period],
    queryFn: () => financialApi.getRevenue({ period }),
    staleTime: 60_000,
  });
  const revenueData: RevenueDataPoint[] = (revResp?.data as ApiResponse<RevenueDataPoint[]>)?.data ?? [];

  // Top customers
  const { data: topResp, isLoading: topLoading } = useQuery({
    queryKey: ['top-customers', revBy],
    queryFn: () => financialApi.getTopCustomers({ by: revBy, limit: 10 }),
    staleTime: 60_000,
  });
  const topCustomers: TopCustomerData[] = (topResp?.data as ApiResponse<TopCustomerData[]>)?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[20px] font-bold">Tổng quan tài chính</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Doanh thu, công nợ và tình hình thanh toán</p>
      </div>

      {/* KPI Cards */}
      {kpiLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-border rounded-xl p-4 animate-pulse bg-muted/30 h-24" />
          ))}
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Tổng doanh thu"
            value={formatCurrency(kpis.total_revenue)}
            sub="Đơn đã xác nhận"
            color="indigo"
            icon={<Wallet className="w-5 h-5" />}
          />
          <KPICard
            label="Đã thu về"
            value={formatCurrency(kpis.total_collected)}
            color="emerald"
            icon={<CircleCheckBig className="w-5 h-5" />}
          />
          <KPICard
            label="Còn nợ"
            value={formatCurrency(kpis.total_outstanding)}
            sub={`${kpis.customers_in_debt} khách hàng`}
            color="red"
            icon={<TriangleAlert className="w-5 h-5" />}
          />
          <KPICard
            label="Credit khách"
            value={formatCurrency(kpis.total_credits)}
            sub="Trả dư"
            color="amber"
            icon={<Gift className="w-5 h-5" />}
          />
        </div>
      ) : null}

      {/* Revenue Chart */}
      <div className="border border-border rounded-xl bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold">Biểu đồ doanh thu</h2>
          <div className="flex gap-1 border border-border rounded-lg p-1">
            {(['monthly', 'daily'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-[12px] font-medium rounded-md transition-colors ${
                  period === p
                    ? 'bg-indigo-600 text-white'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p === 'monthly' ? 'Theo tháng' : 'Theo ngày'}
              </button>
            ))}
          </div>
        </div>

        {revLoading ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-[13px]">Đang tải...</div>
        ) : revenueData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-[13px]">
            Chưa có dữ liệu doanh thu
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value) => value === 'revenue' ? 'Doanh thu' : 'Số đơn'}
              />
              <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} name="revenue" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top Customers */}
      <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-bold">
            {revBy === 'revenue' ? 'Top khách hàng theo doanh thu' : 'Khách hàng có công nợ cao nhất'}
          </h2>
          <div className="flex gap-1 border border-border rounded-lg p-1">
            {(['revenue', 'debt'] as const).map(b => (
              <button
                key={b}
                onClick={() => setRevBy(b)}
                className={`px-3 py-1 text-[12px] font-medium rounded-md transition-colors ${
                  revBy === b
                    ? 'bg-indigo-600 text-white'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {b === 'revenue' ? <Wallet className="w-3.5 h-3.5" /> : <TriangleAlert className="w-3.5 h-3.5" />}
                  {b === 'revenue' ? 'Doanh thu' : 'Công nợ'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {topLoading ? (
          <div className="py-12 text-center text-[13px] text-muted-foreground">Đang tải...</div>
        ) : topCustomers.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted-foreground">Chưa có dữ liệu</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">#</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Khách hàng</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Tổng đơn</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Đã thanh toán</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground">
                  {revBy === 'debt' ? <span className="text-red-500">Công nợ</span> : 'Công nợ'}
                </th>
                {revBy === 'debt' && (
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Thanh toán cuối</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {topCustomers.map((c, i) => (
                <tr
                  key={c.customer_id}
                  className={`hover:bg-muted/30 transition-colors ${
                    revBy === 'debt' && c.total_debt > 0 ? 'bg-red-50/30' : ''
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                      i === 0 ? 'bg-amber-400 text-white' :
                      i === 1 ? 'bg-slate-400 text-white' :
                      i === 2 ? 'bg-orange-400 text-white' :
                      'bg-muted text-muted-foreground'
                    }`}>{i + 1}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium">{c.customers?.customer_name ?? '—'}</p>
                    <p className="text-muted-foreground text-[11px]">{c.customers?.phone_number ?? ''}</p>
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium">{formatCurrency(c.total_orders_amount)}</td>
                  <td className="px-5 py-3.5 text-right text-emerald-600 font-medium">{formatCurrency(c.total_paid)}</td>
                  <td className={`px-5 py-3.5 text-right font-bold ${c.total_debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatCurrency(c.total_debt)}
                  </td>
                  {revBy === 'debt' && (
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {c.last_payment_date ? formatDate(c.last_payment_date) : <span className="italic">Chưa có</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
