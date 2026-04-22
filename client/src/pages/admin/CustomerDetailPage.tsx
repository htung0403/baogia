import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customerApi, profilesApi, pipelineApi } from '@/api/client';
import { formatDate, formatDuration, formatCurrency } from '@/lib/utils';
import type { Customer } from '@/types';
import { CrmStatCard } from '@/components/ui/CrmStatCard';
import { useToast } from '@/components/ui/toast';
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  Building2,
  MessageSquare,
  MessageCircle,
  ShoppingCart,
  Target,
  Map,
  Zap,
  Share2,
  Ticket as TicketIcon,
  AlertCircle,
  Edit,
  Trash2,
  Flag,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  StickyNote,
  User,
  Facebook,
  Eye,
  CreditCard,
  Search,
} from 'lucide-react';
import TiptapEditor from '@/components/ui/TiptapEditor';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type Tab = 'trao-doi' | 'kh-phan-hoi' | 'giao-dich' | 'lich-hen' | 'co-hoi' | 'lich-di-tuyen' | 'automation' | 'gioi-thieu' | 'ticket' | 'lich-su-trang-thai';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Vừa xong';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} giờ trước`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} ngày trước`;
  return formatDate(dateString);
}

export function StatCard({
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
  { id: 'trao-doi', label: 'Trao đổi', icon: MessageSquare },
  { id: 'kh-phan-hoi', label: 'KH phản hồi', icon: MessageCircle },
  { id: 'giao-dich', label: 'Giao dịch', icon: ShoppingCart },
  { id: 'lich-su-trang-thai', label: 'Lịch sử chuyển trạng thái', icon: Clock },
  { id: 'lich-hen', label: 'Lịch hẹn', icon: Calendar },
  { id: 'co-hoi', label: 'Cơ hội', icon: Target },
  { id: 'lich-di-tuyen', label: 'Lịch đi tuyến', icon: Map },
  { id: 'automation', label: 'Automation', icon: Zap },
  { id: 'gioi-thieu', label: 'Giới thiệu', icon: Share2 },
  { id: 'ticket', label: 'Ticket', icon: TicketIcon },
];

// ──────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('trao-doi');
  const toast = useToast();

  const { data: customerRes, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customerApi.get(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });


  const { data: profilesRes } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => profilesApi.list(),
    enabled: !!customerRes?.data?.data,
    retry: false,
  });

  const { data: boardRes } = useQuery({
    queryKey: ['pipeline-board'],
    queryFn: () => pipelineApi.getBoard(),
    enabled: !!customerRes?.data?.data,
    retry: false,
  });

  const profiles = profilesRes?.data?.data || [];
  const pipelineColumns = boardRes?.data?.data?.columns || [];
  const allStages = pipelineColumns.flatMap((c: any) => c.stages || []);

  const customer: Customer | undefined = customerRes?.data?.data;
  const queryClient = useQueryClient();

  const currentStageId = customer
    ? (allStages.find((s: any) => (s.customers || []).some((c: any) => c.id === customer.id))?.id ?? '')
    : '';

  const assignStageMutation = useMutation({
    mutationFn: (stageId: string) => pipelineApi.assignStage(id!, stageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-board'] });
      queryClient.invalidateQueries({ queryKey: ['customer-stats', id] });
      toast.success('Cập nhật trạng thái thành công');
    },
    onError: (error: any) => {
      toast.error('Không thể cập nhật trạng thái', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const assignOwnerMutation = useMutation({
    mutationFn: (assignedTo: string | null) => customerApi.update(id!, { assigned_to: assignedTo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-funnel'] });
      toast.success('Cập nhật người phụ trách thành công');
    },
    onError: (error: any) => {
      toast.error('Không thể cập nhật người phụ trách', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const profileFields = [
    'customer_name', 'phone_number', 'email', 'address', 'tax_code',
    'industry', 'customer_group', 'website', 'fax', 'skype', 'facebook', 'source', 'assigned_to'
  ];
  let completenessPercent = 0;
  if (customer) {
    const completedCount = profileFields.filter(f => !!(customer as any)[f]).length;
    completenessPercent = Math.round((completedCount / profileFields.length) * 100);
  }

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['customer-stats', id],
    queryFn: () => customerApi.getStats(id!),
    enabled: !!customerRes?.data?.data,
    retry: false,
    staleTime: 60 * 1000,
  });

  const stats = statsRes?.data?.data;
// @ts-ignore
  const sessions: ViewSession[] = stats?.sessions ?? [];
  // @ts-ignore
  const assignedPriceLists: AssignedPriceList[] = stats?.assigned_price_lists ?? [];
  const orders: any[] = stats?.orders ?? [];
  const payments: any[] = stats?.payments ?? [];
  const stageHistory: StageHistoryItem[] = stats?.stage_history ?? [];

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
    <div className="flex items-start gap-6 w-full">
      {/* Left Sidebar */}
      <div className="w-[350px] shrink-0 space-y-4 sticky top-6">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button className="text-slate-400 hover:text-indigo-600 transition-colors" title="Sửa"><Edit className="w-4 h-4" /></button>
            <button className="text-slate-400 hover:text-rose-600 transition-colors" title="Xóa"><Trash2 className="w-4 h-4" /></button>
            <button className="text-slate-400 hover:text-amber-600 transition-colors" title="Gắn cờ"><Flag className="w-4 h-4" /></button>
            <button className="text-slate-400 hover:text-slate-700 transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-col items-center text-center mt-2">
            <div className="w-20 h-20 rounded-full bg-indigo-50 border-4 border-white shadow-sm flex items-center justify-center mb-3">
              <Building2 className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{customer.customer_name}</h2>
            <p className="text-[13px] text-slate-500 mt-1">{customer.phone_number || 'Chưa có SĐT'}</p>
          </div>
          
          <div className="mt-5">
            <div className="flex items-center justify-between text-[12px] font-medium mb-1.5">
              <span className="text-slate-600">Hoàn thiện hồ sơ</span>
              <span className="text-indigo-600 font-bold">{completenessPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${completenessPercent}%` }} />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-3 text-[13px]">
            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-700 truncate">{customer.phone_number || '—'}</span>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-700 truncate">{customer.email || '—'}</span>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <StickyNote className="w-4 h-4 text-slate-400 shrink-0" /> {/* Fax */}
            <span className="text-slate-700 truncate">{customer.fax || '—'} (Fax)</span>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <MessageCircle className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-700 truncate">{customer.skype || '—'}</span>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <Facebook className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-700 truncate">{customer.facebook || '—'}</span>
          </div>
        </div>

        {/* Management */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mối quan hệ</label>
            <select
              value={currentStageId}
              onChange={(e) => {
                const nextStageId = e.target.value;
                if (!nextStageId || nextStageId === currentStageId) return;
                assignStageMutation.mutate(nextStageId);
              }}
              disabled={!customer || assignStageMutation.isPending}
              className="w-full h-9 px-3 text-[13px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-60"
            >
              <option value="">Chọn giai đoạn</option>
              {allStages.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Người phụ trách</label>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                <User className="w-4 h-4 text-slate-500" />
              </div>
              <select
                value={customer.assigned_to || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  const nextAssignedTo = value || null;
                  if ((customer.assigned_to || null) === nextAssignedTo) return;
                  assignOwnerMutation.mutate(nextAssignedTo);
                }}
                disabled={assignOwnerMutation.isPending}
                className="flex-1 h-9 px-3 text-[13px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-60"
              >
                <option value="">Chọn nhân viên</option>
                {profiles.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Connections */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Người liên quan</label>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center z-10"><User className="w-4 h-4 text-indigo-600"/></div>
              <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center z-0"><User className="w-4 h-4 text-emerald-600"/></div>
            </div>
            <button className="w-8 h-8 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all">
              <span className="text-lg leading-none mb-0.5">+</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          <CrmStatCard label="Tương tác" value="12" icon={TrendingUp} color="blue" />
          <CrmStatCard label="Đơn hàng" value={orders.length.toString()} icon={ShoppingCart} color="green" />
          <CrmStatCard label="Công nợ" value="0" icon={TrendingDown} color="orange" />
        </div>

        {/* Main Info */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-0 divide-y divide-slate-100">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[12px] text-slate-500">Mã số thuế</span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-slate-900">{customer.tax_code || '—'}</span>
              <button className="text-slate-400 hover:text-indigo-600"><Edit className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[12px] text-slate-500">Lĩnh vực</span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-slate-900">{customer.industry || '—'}</span>
              <button className="text-slate-400 hover:text-indigo-600"><Edit className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[12px] text-slate-500">Nhóm KH</span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-slate-900">{customer.customer_group || '—'}</span>
              <button className="text-slate-400 hover:text-indigo-600"><Edit className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[12px] text-slate-500">Website</span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-slate-900">{customer.website || '—'}</span>
              <button className="text-slate-400 hover:text-indigo-600"><Edit className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Nguồn</span>
            <span className="font-medium text-slate-700">{customer.source || '—'}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Ngày tạo</span>
            <span className="font-medium text-slate-700">{formatDate(customer.created_at)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Đã mua</span>
            <span className="font-medium text-slate-700">{orders.length} đơn</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Lần cuối mua</span>
            <span className="font-medium text-slate-700">{orders.length > 0 ? formatDate(orders[0].created_at) : '—'}</span>
          </div>
        </div>

        {/* Stage Transition History */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Lịch sử chuyển trạng thái</h3>
            <span className="text-[11px] font-medium text-slate-400">{stageHistory.length} lần</span>
          </div>

          {stageHistory.length === 0 ? (
            <p className="text-[12px] text-slate-400">Chưa có lịch sử chuyển trạng thái</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {stageHistory.map((item) => (
                <div key={item.id} className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/70">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold text-slate-700">{item.from_stage?.name || 'Khởi tạo'}</span>
                    <span className="text-[11px] text-slate-400">→</span>
                    <span className="text-[12px] font-bold text-indigo-700">{item.to_stage?.name || '—'}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span>{item.moved_by_profile?.display_name || 'Hệ thống'}</span>
                    <span className="tabular-nums">{formatDate(item.moved_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200 overflow-x-auto mb-5 shrink-0">
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
        <div className="flex-1 min-w-0 flex flex-col">
          {activeTab === 'trao-doi' && <TabTraoDoi customerId={customer.id} />}
          {activeTab === 'giao-dich' && (
            <div className="space-y-4">
              <TabOrders orders={orders} />
              <TabPayments payments={payments} />
            </div>
          )}
          {activeTab === 'lich-su-trang-thai' && <TabStageHistory history={stageHistory} />}
          {['kh-phan-hoi', 'lich-hen', 'co-hoi', 'lich-di-tuyen', 'automation', 'gioi-thieu', 'ticket'].includes(activeTab) && (
            <TabPlaceholder id={activeTab} />
          )}
        </div>
      </div>
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

interface StageHistoryItem {
  id: string;
  moved_at: string;
  from_stage?: { id: string; name: string } | null;
  to_stage?: { id: string; name: string } | null;
  moved_by_profile?: { display_name: string } | null;
}

// ──────────────────────────────────────────────
// Tab: Thông tin khách hàng
// ──────────────────────────────────────────────
export function TabInfo({ customer }: { customer: Customer }) {
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
export function TabViewHistory({
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
// Tab: Placeholder
// ──────────────────────────────────────────────
export function TabPlaceholder({ id: _id }: { id: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-slate-300" />
      </div>
      <p className="text-[14px] font-bold text-slate-600">Chưa có dữ liệu</p>
      <p className="text-[13px] text-slate-400 mt-1">Tính năng này đang được cập nhật hoặc chưa có dữ liệu cho khách hàng này.</p>
    </div>
  );
}

function TabStageHistory({ history }: { history: StageHistoryItem[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50/50">
        <h2 className="text-[13px] font-bold text-slate-800">Lịch sử chuyển trạng thái</h2>
        <span className="text-[12px] text-slate-400">{history.length} lần chuyển</span>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-14 text-[13px] text-slate-400">Chưa có lịch sử chuyển trạng thái</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b bg-slate-50/30">
                <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Từ trạng thái</th>
                <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Đến trạng thái</th>
                <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Người thao tác</th>
                <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-5 font-semibold text-slate-700">{item.from_stage?.name || 'Khởi tạo'}</td>
                  <td className="py-3.5 px-5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {item.to_stage?.name || '—'}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-slate-600">{item.moved_by_profile?.display_name || 'Hệ thống'}</td>
                  <td className="py-3.5 px-5 text-[12px] text-slate-400 tabular-nums">{formatDate(item.moved_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Tab: Trao đổi
// ──────────────────────────────────────────────
function TabTraoDoi({ customerId }: { customerId: string }) {
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: activitiesRes, isLoading } = useQuery({
    queryKey: ['activities', customerId],
    queryFn: () => pipelineApi.listActivities(customerId),
    enabled: !!customerId,
    retry: false,
  });

  const createActivity = useMutation({
    mutationFn: (htmlContent: string) =>
      pipelineApi.createActivity({
        customer_id: customerId,
        activity_type: 'trao_doi',
        title: 'Trao đổi',
        description: htmlContent,
      }),
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['activities', customerId] });
      toast.success('Đã gửi trao đổi');
    },
    onError: (error: any) => {
      toast.error('Không thể gửi trao đổi', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const handleSubmit = () => {
    if (!content.trim() || content === '<p></p>') return;
    createActivity.mutate(content);
  };

  const activities = activitiesRes?.data?.data || [];
  const filteredActivities = activities.filter((act: any) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (act.title && act.title.toLowerCase().includes(term)) ||
      (act.description && act.description.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Editor Box */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-4">
        <TiptapEditor 
          content={content} 
          onChange={setContent} 
          placeholder="Nhập nội dung trao đổi..."
          className="mb-3"
        />
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={createActivity.isPending || !content.trim() || content === '<p></p>'}
            className="h-9 px-5 bg-indigo-600 text-white text-[13px] font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {createActivity.isPending ? 'Đang gửi...' : 'Gửi'}
          </button>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-[14px] font-bold text-slate-800">Lịch sử trao đổi</h3>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Tìm kiếm..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-indigo-500 w-[200px]"
            />
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[13px] text-slate-500">Không có trao đổi nào.</p>
            </div>
          ) : (
            filteredActivities.map((act: any) => (
              <div key={act.id} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[13px] text-slate-800">
                      {act.profiles?.display_name || 'Người dùng'}
                    </span>
                    <span className="text-[12px] text-slate-400">• {formatRelativeTime(act.created_at)}</span>
                  </div>
                  <div 
                    className="prose prose-sm max-w-none text-slate-700 bg-slate-50 border border-slate-100 p-3 rounded-lg rounded-tl-none"
                    dangerouslySetInnerHTML={{ __html: act.description || '' }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
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
