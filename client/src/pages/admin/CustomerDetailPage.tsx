import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customerApi } from '@/api/client';
import { formatDate, formatDuration, formatCurrency } from '@/lib/utils';
import type { Customer } from '@/types';
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  StickyNote,
  User,
  Eye,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

type Tab = 'info' | 'view-history' | 'orders' | 'payments';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: 'indigo' | 'emerald' | 'amber' | 'rose';
  sub?: string;
}) {
  const colorMap = {
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', icon: 'text-indigo-600', value: 'text-indigo-700' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'text-emerald-600', value: 'text-emerald-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-600', value: 'text-amber-700' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-100', icon: 'text-rose-600', value: 'text-rose-700' },
  };
  const c = colorMap[color];
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${c.bg} ${c.border} border flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${c.value} leading-none`}>{value}</p>
      {sub && <p className="text-[12px] text-slate-400 mt-1.5 font-medium">{sub}</p>}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-[13px] font-semibold text-slate-800 break-words">{value || '—'}</p>
      </div>
    </div>
  );
}

const TAB_LIST: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'info', label: 'Thông tin khách hàng', icon: User },
  { id: 'view-history', label: 'Lịch sử xem báo giá', icon: Eye },
  { id: 'orders', label: 'Đơn hàng', icon: ShoppingCart },
  { id: 'payments', label: 'Lịch sử thanh toán', icon: CreditCard },
];

// ──────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('info');

  const { data: customerRes, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customerApi.get(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['customer-stats', id],
    queryFn: () => customerApi.getStats(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });

  const customer: Customer | undefined = customerRes?.data?.data;
  const stats = statsRes?.data?.data;
  const sessions: ViewSession[] = stats?.sessions ?? [];
  const assignedPriceLists: AssignedPriceList[] = stats?.assigned_price_lists ?? [];
  const orders: any[] = stats?.orders ?? [];
  const payments: any[] = stats?.payments ?? [];
  const financials = stats?.financials ?? { total_orders_amount: 0, total_debt: 0, total_paid: 0 };
  const activity = stats?.activity ?? { total_sessions: 0, last_viewed_at: null, total_duration_seconds: 0 };

  const isLoading = customerLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-100 animate-pulse rounded-lg" />
          <div className="h-6 w-48 bg-slate-100 animate-pulse rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-[15px] font-semibold text-slate-500">Không tìm thấy khách hàng</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-indigo-600 text-[13px] hover:underline cursor-pointer">
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/admin/customers')}
          className="mt-0.5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{customer.customer_name}</h1>
              <p className="text-[13px] text-slate-500 mt-0.5 flex items-center gap-2">
                {customer.phone_number && (
                  <>
                    <Phone className="w-3.5 h-3.5" />
                    <span>{customer.phone_number}</span>
                  </>
                )}
                {customer.profile_id && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Có tài khoản
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        {customer.phone_number && (
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`tel:${customer.phone_number}`}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-[12px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-all cursor-pointer"
              title="Gọi điện"
            >
              <Phone className="w-3.5 h-3.5" />
              Gọi
            </a>
            <a
              href={`https://zalo.me/${customer.phone_number.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 text-[12px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all cursor-pointer"
              title="Nhắn Zalo"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Zalo
            </a>
          </div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Tổng doanh thu"
          value={financials.total_orders_amount > 0 ? `${formatCurrency(financials.total_orders_amount)}đ` : '—'}
          icon={TrendingUp}
          color="indigo"
          sub={orders.length > 0 ? `Từ ${orders.length} đơn hàng` : 'Chưa có đơn hàng'}
        />
        <StatCard
          label="Công nợ"
          value={financials.total_debt > 0 ? `${formatCurrency(financials.total_debt)}đ` : '—'}
          icon={TrendingDown}
          color="rose"
          sub={financials.total_debt > 0 ? 'Cần thu hồi' : 'Đã đối soát hết'}
        />
        <StatCard
          label="Đã thanh toán"
          value={financials.total_paid > 0 ? `${formatCurrency(financials.total_paid)}đ` : '—'}
          icon={Wallet}
          color="emerald"
          sub={payments.length > 0 ? `Giao dịch cuối: ${formatDate(payments[0].paid_at)}` : 'Chưa có thanh toán'}
        />
        <StatCard
          label="Lượt xem BG"
          value={String(activity.total_sessions)}
          icon={Eye}
          color="amber"
          sub={activity.last_viewed_at ? `Lần cuối: ${formatDate(activity.last_viewed_at)}` : 'Chưa xem'}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200 overflow-x-auto">
        {TAB_LIST.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white shadow-sm text-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <TabInfo customer={customer} />
      )}
      {activeTab === 'view-history' && (
        <TabViewHistory sessions={sessions} assignedPriceLists={assignedPriceLists} />
      )}
      {activeTab === 'orders' && (
        <TabOrders orders={orders} />
      )}
      {activeTab === 'payments' && (
        <TabPayments payments={payments} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Types (local)
// ──────────────────────────────────────────────
interface ViewSession {
  id: string;
  customer_id: string;
  price_list_id: string;
  version_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  device: string | null;
  price_lists?: { id: string; title: string; status: string } | null;
}

interface AssignedPriceList {
  id: string;
  price_list_id: string;
  customer_id: string;
  assigned_at: string;
  price_lists?: { id: string; title: string; status: string; created_at: string; updated_at: string } | null;
}

// ──────────────────────────────────────────────
// Tab: Thông tin khách hàng
// ──────────────────────────────────────────────
function TabInfo({ customer }: { customer: Customer }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Basic info card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b bg-slate-50/50">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <h2 className="text-[13px] font-bold text-slate-800">Thông tin cơ bản</h2>
        </div>
        <div className="px-5 pb-2">
          <InfoRow icon={Building2} label="Tên khách hàng" value={customer.customer_name} />
          <InfoRow icon={Phone} label="Số điện thoại" value={customer.phone_number} />
          <InfoRow icon={Mail} label="Email" value={customer.email} />
          <InfoRow icon={MapPin} label="Địa chỉ" value={customer.address} />
          <InfoRow icon={StickyNote} label="Ghi chú" value={customer.notes} />
          <InfoRow icon={Clock} label="Ngày tạo" value={formatDate(customer.created_at)} />
        </div>
      </div>

      {/* Account info card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b bg-slate-50/50">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <h2 className="text-[13px] font-bold text-slate-800">Tài khoản hệ thống</h2>
        </div>
        <div className="px-5 py-6 flex flex-col items-center justify-center text-center gap-3">
          {customer.profile_id ? (
            <>
              <div className="w-14 h-14 rounded-full bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center">
                <User className="w-7 h-7 text-emerald-600" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-emerald-700">Đã có tài khoản đăng nhập</p>
                <p className="text-[12px] text-slate-400 mt-0.5">Khách hàng có thể tự xem báo giá trên portal</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Hoạt động
              </span>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center">
                <User className="w-7 h-7 text-slate-400" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-600">Chưa có tài khoản</p>
                <p className="text-[12px] text-slate-400 mt-0.5">Khách hàng chưa được tạo tài khoản đăng nhập</p>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                Chưa kích hoạt
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Tab: Lịch sử xem báo giá
// ──────────────────────────────────────────────
function TabViewHistory({
  sessions,
  assignedPriceLists,
}: {
  sessions: ViewSession[];
  assignedPriceLists: AssignedPriceList[];
}) {
  const statusMap: Record<string, { label: string; className: string }> = {
    published: { label: 'Đã duyệt', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    draft: { label: 'Nháp', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    archived: { label: 'Lưu trữ', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  };

  return (
    <div className="space-y-4">
      {/* Assigned price lists */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b bg-slate-50/50">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <h2 className="text-[13px] font-bold text-slate-800">Bảng giá được giao ({assignedPriceLists.length})</h2>
        </div>
        {assignedPriceLists.length === 0 ? (
          <div className="text-center py-10 text-[13px] text-slate-400">Chưa được giao bảng giá nào</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-slate-50/30">
                  <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Bảng giá</th>
                  <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Trạng thái</th>
                  <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Ngày giao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignedPriceLists.map((a) => {
                  const s = statusMap[a.price_lists?.status ?? ''] ?? statusMap.draft;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-5">
                        <span className="font-semibold text-slate-800">{a.price_lists?.title ?? '—'}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${s.className}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-[12px] text-slate-400 tabular-nums">
                        {formatDate(a.assigned_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View sessions */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b bg-slate-50/50">
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
            <Eye className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <h2 className="text-[13px] font-bold text-slate-800">Phiên xem gần đây ({sessions.length})</h2>
        </div>
        {sessions.length === 0 ? (
          <div className="text-center py-10 text-[13px] text-slate-400">Chưa có lịch sử xem báo giá</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-slate-50/30">
                  <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Bảng giá</th>
                  <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Thời gian bắt đầu</th>
                  <th className="text-right py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Thời lượng</th>
                  <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Thiết bị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-slate-800">
                      {session.price_lists?.title ?? `Báo giá #${session.price_list_id.slice(0, 6)}`}
                    </td>
                    <td className="py-3.5 px-5 text-[12px] text-slate-400 tabular-nums">
                      {formatDate(session.started_at)}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 tabular-nums">
                        {formatDuration(session.duration_seconds)}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        {session.device ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Tab: Đơn hàng
// ──────────────────────────────────────────────
function TabOrders({ orders }: { orders: any[] }) {
  const statusMap: Record<string, { label: string; className: string }> = {
    confirmed: { label: 'Đã xác nhận', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    draft: { label: 'Chờ phân duyệt', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    cancelled: { label: 'Đã hủy', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b bg-slate-50/50">
        <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
          <ShoppingCart className="w-3.5 h-3.5 text-purple-600" />
        </div>
        <h2 className="text-[13px] font-bold text-slate-800">Đơn hàng ({orders.length})</h2>
      </div>
      
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center">
            <ShoppingCart className="w-8 h-8 text-purple-400" />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-bold text-slate-600">Chưa có đơn hàng</p>
            <p className="text-[12px] text-slate-400 mt-1">Khách hàng này chưa có đơn hàng nào</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b bg-slate-50/30">
                <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Mã đơn</th>
                <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Trạng thái</th>
                <th className="text-right py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Tổng tiền</th>
                <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => {
                const s = statusMap[order.status] ?? statusMap.draft;
                return (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-slate-800">
                      {order.code}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${s.className}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-bold text-slate-700 tabular-nums">
                      {formatCurrency(order.total_amount)}đ
                    </td>
                    <td className="py-3.5 px-5 text-[12px] text-slate-400 tabular-nums">
                      {formatDate(order.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Tab: Lịch sử thanh toán
// ──────────────────────────────────────────────
function TabPayments({ payments }: { payments: any[] }) {
  const statusMap: Record<string, { label: string; className: string }> = {
    completed: { label: 'Thành công', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    pending: { label: 'Chờ xác nhận', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    failed: { label: 'Thất bại', className: 'bg-rose-100 text-rose-700 border-rose-200' },
    refunded: { label: 'Đã hoàn tiền', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  };

  const methodMap: Record<string, string> = {
    transfer: 'Chuyển khoản',
    cash: 'Tiền mặt',
    card: 'Thẻ tín dụng',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b bg-slate-50/50">
        <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
          <CreditCard className="w-3.5 h-3.5 text-teal-600" />
        </div>
        <h2 className="text-[13px] font-bold text-slate-800">Lịch sử thanh toán ({payments.length})</h2>
      </div>
      
      {payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center">
            <CreditCard className="w-8 h-8 text-teal-400" />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-bold text-slate-600">Chưa có giao dịch</p>
            <p className="text-[12px] text-slate-400 mt-1">Khách hàng này chưa có giao dịch thanh toán nào</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b bg-slate-50/30">
                <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Mã GD</th>
                <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Hình thức</th>
                <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Trạng thái</th>
                <th className="text-right py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Số tiền</th>
                <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Ngày thanh toán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((payment) => {
                const s = statusMap[payment.status] ?? statusMap.pending;
                return (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-slate-800">
                      {payment.code}
                    </td>
                    <td className="py-3.5 px-5 text-slate-600">
                      {methodMap[payment.payment_method] ?? payment.payment_method}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${s.className}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-bold text-emerald-600 tabular-nums bg-emerald-50/30">
                      +{formatCurrency(payment.amount)}đ
                    </td>
                    <td className="py-3.5 px-5 text-[12px] text-slate-400 tabular-nums">
                      {formatDate(payment.paid_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
