import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customerApi, profilesApi, pipelineApi, careScheduleApi } from '@/api/client';
import { formatDate, formatDuration } from '@/lib/utils';
import type { Customer, CustomerActivity, CareScheduleEvent } from '@/types';
// @ts-expect-error unused import
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
  Music2,
  Eye,
  CreditCard,
  Search,
  Plus,
} from 'lucide-react';
import TiptapEditor from '@/components/ui/TiptapEditor';
import { DateTimePicker24h } from '@/components/ui/DateTimePicker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CustomerCost } from '@/types';

const COST_TYPE_LABELS: Record<string, string> = {
  advertising: 'Quảng cáo',
  consulting: 'Tư vấn',
  travel: 'Đi lại',
  gift: 'Quà tặng',
  commission: 'Hoa hồng',
  other: 'Khác',
};

type Tab = 'trao-doi' | 'giao-dich' | 'lich-hen' | 'lich-cham-soc' | 'co-hoi' | 'lich-di-tuyen' | 'automation' | 'gioi-thieu' | 'chi-phi' | 'lich-su-trang-thai';

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
  variant = 'default',
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: 'indigo' | 'emerald' | 'amber' | 'rose';
  sub?: string;
  variant?: 'default' | 'compact';
}) {
  const colorMap = {
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', icon: 'text-indigo-600', value: 'text-indigo-700' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'text-emerald-600', value: 'text-emerald-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-600', value: 'text-amber-700' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-100', icon: 'text-rose-600', value: 'text-rose-700' },
  };
  const c = colorMap[color];

  if (variant === 'compact') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-sm flex flex-col items-center justify-center gap-1 min-w-0 text-center">
        <div className={`w-7 h-7 rounded-lg ${c.bg} ${c.border} border flex items-center justify-center shrink-0`}>
          <Icon className={`w-3.5 h-3.5 ${c.icon}`} />
        </div>
        <p className={`text-base font-bold tabular-nums ${c.value} leading-none`}>{value}</p>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide leading-tight truncate w-full">{label}</span>
      </div>
    );
  }

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
  { id: 'giao-dich', label: 'Giao dịch', icon: ShoppingCart },
  { id: 'lich-su-trang-thai', label: 'Lịch sử chuyển trạng thái', icon: Clock },
  { id: 'lich-hen', label: 'Lịch hẹn', icon: Calendar },
  { id: 'lich-cham-soc', label: 'Lịch chăm sóc', icon: Calendar },
  // { id: 'chi-phi', label: 'Chi phí', icon: CreditCard },
];

// ──────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('trao-doi');
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    phone_number: '',
    email: '',
    fax: '',
    skype: '',
    facebook: '',
    tiktok_url: '',
  });
  const toast = useToast();

  const queryClient = useQueryClient();

  const updateCustomerMutation = useMutation({
    mutationFn: (data: Record<string, any>) => customerApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      toast.success('Cập nhật thông tin thành công');
      setIsEditingContact(false);
    },
    onError: (error: any) => {
      toast.error('Không thể cập nhật thông tin', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

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

  const currentStageId = customer
    ? (allStages.find((s: any) => (s.customers || []).some((c: any) => c.id === customer.id))?.id ?? '')
    : '';

  const assignStageMutation = useMutation({
    mutationFn: ({ stageId, note }: { stageId: string; note: string }) => pipelineApi.assignStage(id!, stageId, note),
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
    <div className="flex flex-col lg:flex-row items-start gap-6 w-full h-[calc(100vh-88px)] lg:h-[calc(100vh-104px)]">
      {/* Left Sidebar - Scrolls internally */}
      <div className="w-full lg:w-[350px] shrink-0 space-y-4 h-full overflow-y-auto custom-scrollbar pr-2 pb-4">
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
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 relative group">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Thông tin liên hệ</h3>
            {!isEditingContact && (
              <button
                onClick={() => {
                  setContactForm({
                    phone_number: customer.phone_number || '',
                    email: customer.email || '',
                    fax: customer.fax || '',
                    skype: customer.skype || '',
                    facebook: customer.facebook || '',
                    tiktok_url: customer.tiktok_url || '',
                  });
                  setIsEditingContact(true);
                }}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                title="Chỉnh sửa liên hệ"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-[13px]">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              {isEditingContact ? (
                <input
                  type="text"
                  value={contactForm.phone_number}
                  onChange={(e) => setContactForm({ ...contactForm, phone_number: e.target.value })}
                  placeholder="Số điện thoại"
                  className="flex-1 h-8 px-2 bg-slate-50 border border-slate-200 rounded text-[13px] outline-none focus:border-indigo-500"
                />
              ) : (
                <span className="text-slate-700 truncate">{customer.phone_number || '—'}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[13px]">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              {isEditingContact ? (
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="Email"
                  className="flex-1 h-8 px-2 bg-slate-50 border border-slate-200 rounded text-[13px] outline-none focus:border-indigo-500"
                />
              ) : (
                <span className="text-slate-700 truncate">{customer.email || '—'}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[13px]">
              <StickyNote className="w-4 h-4 text-slate-400 shrink-0" />
              {isEditingContact ? (
                <input
                  type="text"
                  value={contactForm.fax}
                  onChange={(e) => setContactForm({ ...contactForm, fax: e.target.value })}
                  placeholder="Fax"
                  className="flex-1 h-8 px-2 bg-slate-50 border border-slate-200 rounded text-[13px] outline-none focus:border-indigo-500"
                />
              ) : (
                <span className="text-slate-700 truncate">{customer.fax || '—'} (Fax)</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[13px]">
              <MessageCircle className="w-4 h-4 text-slate-400 shrink-0" />
              {isEditingContact ? (
                <input
                  type="text"
                  value={contactForm.skype}
                  onChange={(e) => setContactForm({ ...contactForm, skype: e.target.value })}
                  placeholder="Skype"
                  className="flex-1 h-8 px-2 bg-slate-50 border border-slate-200 rounded text-[13px] outline-none focus:border-indigo-500"
                />
              ) : (
                <span className="text-slate-700 truncate">{customer.skype || '—'}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[13px]">
              <Facebook className="w-4 h-4 text-slate-400 shrink-0" />
              {isEditingContact ? (
                <input
                  type="text"
                  value={contactForm.facebook}
                  onChange={(e) => setContactForm({ ...contactForm, facebook: e.target.value })}
                  placeholder="Facebook URL"
                  className="flex-1 h-8 px-2 bg-slate-50 border border-slate-200 rounded text-[13px] outline-none focus:border-indigo-500"
                />
              ) : (
                <span className="text-slate-700 truncate">{customer.facebook || '—'}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[13px]">
              <Music2 className="w-4 h-4 text-slate-400 shrink-0" />
              {isEditingContact ? (
                <input
                  type="text"
                  value={contactForm.tiktok_url}
                  onChange={(e) => setContactForm({ ...contactForm, tiktok_url: e.target.value })}
                  placeholder="TikTok URL"
                  className="flex-1 h-8 px-2 bg-slate-50 border border-slate-200 rounded text-[13px] outline-none focus:border-indigo-500"
                />
              ) : (
                <span className="text-slate-700 truncate">{customer.tiktok_url || '—'} (TikTok)</span>
              )}
            </div>
          </div>

          {isEditingContact && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsEditingContact(false)}
                className="flex-1 h-8 text-[12px] font-bold text-slate-500 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all"
              >
                Hủy
              </button>
              <button
                onClick={() => updateCustomerMutation.mutate(contactForm)}
                disabled={updateCustomerMutation.isPending}
                className="flex-1 h-8 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {updateCustomerMutation.isPending ? 'Đang lưu...' : 'Lưu lại'}
              </button>
            </div>
          )}
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
                const note = window.prompt('Nhập ghi chú khi đổi trạng thái:');
                if (!note || !note.trim()) {
                  toast.error('Bạn cần nhập ghi chú để đổi trạng thái');
                  return;
                }
                assignStageMutation.mutate({ stageId: nextStageId, note: note.trim() });
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
          <StatCard variant="compact" label="Tương tác" value="12" icon={TrendingUp} color="indigo" />
          <StatCard variant="compact" label="Đơn hàng" value={orders.length.toString()} icon={ShoppingCart} color="emerald" />
          <StatCard variant="compact" label="Công nợ" value="0" icon={TrendingDown} color="rose" />
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
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Chăm sóc cuối</span>
            <span className="font-medium text-slate-700">
              {stats?.last_activity_at ? formatDate(stats.last_activity_at) : '—'}
            </span>
          </div>
        </div>

      </div>

      {/* Right Content - Independent Scroll */}
      <div className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar pr-1 relative pb-4">
        {/* Tabs */}
        <div className="sticky top-0 z-30 bg-background pt-1 pb-3 border-b border-slate-200 mb-4">
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
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {activeTab === 'trao-doi' && <TabTraoDoi customer={customer} />}
          {activeTab === 'giao-dich' && (
            <div className="space-y-4">
              <TabOrders orders={orders} />
              <TabPayments payments={payments} />
            </div>
          )}
          {activeTab === 'lich-su-trang-thai' && <TabStageHistory history={stageHistory} />}
          {activeTab === 'lich-hen' && <TabLichHen customerId={customer.id} />}
          {activeTab === 'lich-cham-soc' && <TabLichChamSoc customerId={customer.id} />}
          {activeTab === 'chi-phi' && <TabChiPhi customerId={customer.id} customerName={customer.customer_name} />}
          {['co-hoi', 'gioi-thieu'].includes(activeTab) && (
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
  note?: string;
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
function TabChiPhi({ customerId, customerName }: { customerId: string; customerName: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showAddCost, setShowAddCost] = useState(false);
  const [editingCost, setEditingCost] = useState<CustomerCost | null>(null);

  const { data: costsRes, isLoading } = useQuery({
    queryKey: ['customer-costs', customerId],
    queryFn: () => pipelineApi.listCosts({ customer_id: customerId, limit: 500 }),
    staleTime: 30_000,
  });
  const costs: CustomerCost[] = costsRes?.data?.data ?? [];

  const totalCost = costs.reduce((sum, c) => sum + Number(c.amount), 0);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pipelineApi.deleteCost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-costs', customerId] });
      toast.success('Đã xóa chi phí');
    },
    onError: (error: any) => {
      toast.error('Không thể xóa chi phí', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const handleDelete = (id: string) => {
    if (confirm('Xóa chi phí này?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-[13px] font-bold text-slate-700">
          <CreditCard className="w-4 h-4" />
          Chi phí của khách hàng
        </div>
        <div className="ml-auto">
          <button
            onClick={() => { setEditingCost(null); setShowAddCost(true); }}
            className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Thêm chi phí
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng chi phí</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalCost.toLocaleString('vi-VN')} đ</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Số lượng</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">{costs.length}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b bg-slate-50/50">
                <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Mô tả</th>
                <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Loại</th>
                <th className="text-right py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Số tiền</th>
                <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Ngày</th>
                <th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">Người tạo</th>
                <th className="text-right py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px] w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="py-4 px-4">
                      <div className="h-6 bg-slate-50 animate-pulse rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : costs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[14px] text-slate-400">
                    Chưa có chi phí nào
                  </td>
                </tr>
              ) : (
                costs.map((cost) => (
                  <tr key={cost.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-4 px-4 text-slate-700 max-w-[200px]">
                      <div className="line-clamp-2">{cost.description}</div>
                      {cost.notes && <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{cost.notes}</div>}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {COST_TYPE_LABELS[cost.cost_type] || cost.cost_type}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-slate-900 tabular-nums">
                      {Number(cost.amount).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-4 px-4 text-[12px] text-slate-500 tabular-nums">
                      {cost.cost_date ? new Date(cost.cost_date).toLocaleDateString('vi-VN') : '—'}
                    </td>
                    <td className="py-4 px-4 text-slate-500">
                      {cost.profiles?.display_name || '—'}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingCost(cost); setShowAddCost(true); }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cost.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddCost && (
        <AddCostModal
          cost={editingCost}
          customerId={customerId}
          customerName={customerName}
          onClose={() => { setShowAddCost(false); setEditingCost(null); }}
        />
      )}
    </div>
  );
}

function AddCostModal({
  cost,
  customerId,
  customerName,
  onClose,
}: {
  cost: CustomerCost | null;
  customerId: string;
  customerName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isEdit = !!cost;

  const [formData, setFormData] = useState({
    amount: cost ? String(cost.amount) : '',
    description: cost?.description ?? '',
    cost_type: cost?.cost_type ?? 'other',
    cost_date: cost?.cost_date?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    notes: cost?.notes ?? '',
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const data = {
        customer_id: customerId,
        amount: Number(formData.amount),
        description: formData.description,
        cost_type: formData.cost_type,
        cost_date: formData.cost_date,
        notes: formData.notes || null,
      };
      return isEdit
        ? pipelineApi.updateCost(cost!.id, data)
        : pipelineApi.createCost(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-costs', customerId] });
      toast.success(isEdit ? 'Cập nhật chi phí thành công' : 'Thêm chi phí thành công');
      onClose();
    },
    onError: (error: any) => {
      toast.error('Không thể lưu chi phí', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description) return;
    saveMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50/50">
          <h2 className="text-[14px] font-bold text-slate-800">
            {isEdit ? 'Sửa chi phí' : 'Thêm chi phí mới'}
          </h2>
          <button onClick={onClose} className="h-8 px-3 text-[12px] font-bold border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
            Đóng
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-slate-700">Khách hàng</label>
            <input
              type="text"
              value={customerName}
              disabled
              className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg bg-slate-100 text-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-slate-700">Số tiền (đ) *</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => updateField('amount', e.target.value)}
                required
                min="1"
                className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-slate-700">Loại chi phí</label>
              <select
                value={formData.cost_type}
                onChange={(e) => updateField('cost_type', e.target.value)}
                className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {Object.entries(COST_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-slate-700">Mô tả *</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              required
              placeholder="Mô tả chi phí..."
              className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-slate-700">Ngày chi phí</label>
              <input
                type="date"
                value={formData.cost_date}
                onChange={(e) => updateField('cost_date', e.target.value)}
                className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-slate-700">Ghi chú thêm</label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Ghi chú..."
                className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t bg-white">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-[13px] font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="h-9 px-4 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saveMutation.isPending ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm chi phí'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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

// @ts-expect-error unused function
function TabKhachHangPhanHoi({ customerId }: { customerId: string }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: feedbackRes, isLoading } = useQuery({
    queryKey: ['activities', customerId, 'kh_phan_hoi'],
    queryFn: () => pipelineApi.listActivities(customerId, 'kh_phan_hoi'),
    enabled: !!customerId,
    retry: false,
  });

  const createFeedback = useMutation({
    mutationFn: () =>
      pipelineApi.createActivity({
        customer_id: customerId,
        activity_type: 'kh_phan_hoi',
        title: title.trim(),
        description: description.trim() || null,
      }),
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setShowCreateModal(false);
      queryClient.invalidateQueries({ queryKey: ['activities', customerId, 'kh_phan_hoi'] });
      toast.success('Đã lưu phản hồi');
    },
    onError: (error: any) => {
      toast.error('Không thể lưu phản hồi', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const feedbackItems = feedbackRes?.data?.data || [];
  const filteredFeedbackItems = feedbackItems.filter((item: any) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (item.title && item.title.toLowerCase().includes(term)) ||
      (item.description && item.description.toLowerCase().includes(term))
    );
  });

  const handleSaveFeedback = () => {
    if (!title.trim()) {
      toast.error('Tiêu đề phản hồi không được để trống');
      return;
    }
    createFeedback.mutate();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50/50">
        <h2 className="text-[13px] font-bold text-slate-800">Khách hàng phản hồi</h2>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Thêm phản hồi
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-bold text-slate-800">Danh sách phản hồi ({feedbackItems.length})</h3>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tiêu đề/nội dung..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-indigo-500 w-[240px]"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredFeedbackItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-slate-100 rounded-xl bg-slate-50/40">
            <MessageCircle className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-[14px] font-bold text-slate-600">Chưa có phản hồi nào</p>
            <p className="text-[13px] text-slate-400 mt-1">
              Nhấn "Thêm phản hồi" để tạo phản hồi đầu tiên.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFeedbackItems.map((item: any) => (
              <div key={item.id} className="border border-slate-200 rounded-xl p-4 bg-white">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-[13px] font-bold text-slate-800 truncate">{item.title}</p>
                  <span className="text-[12px] text-slate-400 shrink-0">{formatRelativeTime(item.created_at)}</span>
                </div>
                {item.description && (
                  <p className="text-[13px] text-slate-600 whitespace-pre-wrap">{item.description}</p>
                )}
                <p className="mt-2 text-[12px] text-slate-400">
                  Người lưu: {item.profiles?.display_name || 'Người dùng'}
                </p>
                <p className="mt-0.5 text-[12px] text-slate-400">
                  Ngày giờ lưu: {formatDate(item.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50/50">
              <h4 className="text-[14px] font-bold text-slate-800">Thêm phản hồi khách hàng</h4>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="h-8 px-3 text-[12px] font-bold border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>

            <div className="p-5 space-y-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tiêu đề phản hồi"
                className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-indigo-500"
              />
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Nội dung phản hồi..."
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-indigo-500 resize-none"
              />
              <p className="text-[12px] text-slate-400">
                Hệ thống sẽ tự lưu ngày giờ và người lưu theo tài khoản đang đăng nhập.
              </p>
            </div>

            <div className="px-5 py-4 border-t bg-white flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="h-8 px-3 text-[12px] border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveFeedback}
                disabled={createFeedback.isPending || !title.trim()}
                className="h-8 px-4 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {createFeedback.isPending ? 'Đang lưu...' : 'Lưu phản hồi'}
              </button>
            </div>
          </div>
        </div>
      )}
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
                <th className="text-left py-3 px-5 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Ghi chú</th>
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
                  <td className="py-3.5 px-5 text-slate-600">{item.note || '—'}</td>
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
function TabTraoDoi({ customer }: { customer: Customer }) {
  const [content, setContent] = useState('');
  const [localCharacteristics, setLocalCharacteristics] = useState(customer.characteristics || '');
  const [isAutoBullet, setIsAutoBullet] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  const handleCharacteristicsKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && isAutoBullet) {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;

      const newValue = value.substring(0, start) + '\n• ' + value.substring(end);
      setLocalCharacteristics(newValue);

      // Need to set selection after state update
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 3;
      }, 0);
    }
  };

  const updateCharacteristicsMutation = useMutation({
    mutationFn: (characteristics: string) => customerApi.update(customer.id, { characteristics }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', customer.id] });
      toast.success('Đã lưu đặc điểm khách hàng');
    },
    onError: (error: any) => {
      toast.error('Không thể lưu đặc điểm', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const { data: activitiesRes, isLoading } = useQuery({
    queryKey: ['activities', customer.id],
    queryFn: () => pipelineApi.listActivities(customer.id),
    enabled: !!customer.id,
    retry: false,
  });

  const createActivity = useMutation({
    mutationFn: (htmlContent: string) =>
      pipelineApi.createActivity({
        customer_id: customer.id,
        activity_type: 'trao_doi',
        title: 'Trao đổi',
        description: htmlContent,
      }),
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['activities', customer.id] });
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
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Left Column: Editor & Feed */}
      <div className="flex-1 min-w-0 space-y-4 w-full">
        {/* Editor Box */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Nội dung trao đổi</label>
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
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
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

          <div className="p-4 overflow-y-auto space-y-6">
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

      {/* Right Column: Characteristics (Sticky) */}
      <div className="w-full lg:w-[350px] shrink-0 sticky top-[136px] self-start space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Đặc điểm khách hàng</label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAutoBullet}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsAutoBullet(checked);
                  if (checked && !localCharacteristics.trim()) {
                    setLocalCharacteristics('• ');
                  }
                }}
                className="w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-[11px] font-medium text-slate-500">Auto bullet (•)</span>
            </label>
          </div>
          <textarea
            value={localCharacteristics}
            onChange={(e) => setLocalCharacteristics(e.target.value)}
            onKeyDown={handleCharacteristicsKeyDown}
            placeholder="Nhập đặc điểm, sở thích, lưu ý về khách hàng này..."
            className="w-full h-[250px] lg:h-[350px] p-3 text-[13px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 resize-none mb-3"
          />
          <div className="flex justify-end">
            <button
              onClick={() => updateCharacteristicsMutation.mutate(localCharacteristics)}
              disabled={updateCharacteristicsMutation.isPending || localCharacteristics === (customer.characteristics || '')}
              className="w-full h-9 bg-white border border-slate-200 text-slate-700 text-[13px] font-bold rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
            >
              {updateCharacteristicsMutation.isPending ? 'Đang lưu...' : 'Lưu đặc điểm'}
            </button>
          </div>
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

// ──────────────────────────────────────────────
// Tab: Lịch hẹn
// ──────────────────────────────────────────────
function TabLichHen({ customerId }: { customerId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: profilesRes } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => profilesApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  // @ts-expect-error unused variable
  const profiles = profilesRes?.data?.data || [];

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<{ scheduled_at: Date | undefined }>({
    scheduled_at: undefined,
  });

  const { data: apptRes, isLoading } = useQuery({
    queryKey: ['appointments', customerId],
    queryFn: () => pipelineApi.listAppointments(customerId),
    enabled: !!customerId,
  });
  const appointments: CustomerActivity[] = apptRes?.data?.data || [];

  const upcoming = appointments.filter(a => a.status !== 'done' && a.status !== 'cancelled');
  const past = appointments.filter(a => a.status === 'done' || a.status === 'cancelled');

  const createMutation = useMutation({
    mutationFn: () => pipelineApi.createAppointment({
      customer_id: customerId,
      title: 'Lịch hẹn',
      description: null,
      scheduled_at: new Date(formData.scheduled_at!).toISOString(),
      status: 'pending',
      assigned_to: null,
    }),
    onSuccess: () => {
      setShowForm(false);
      setFormData({ scheduled_at: undefined });
      queryClient.invalidateQueries({ queryKey: ['appointments', customerId] });
      toast.success('Đã tạo lịch hẹn');
    },
    onError: (error: any) => {
      toast.error('Không thể tạo lịch hẹn', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'done' | 'cancelled' }) =>
      pipelineApi.updateAppointmentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', customerId] });
      toast.success('Đã cập nhật trạng thái');
    },
  });

  const statusBadge = (status: string | null) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: 'Chờ diễn ra', className: 'bg-amber-100 text-amber-700 border-amber-200' },
      done:    { label: 'Đã xong',     className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      cancelled: { label: 'Đã hủy',   className: 'bg-rose-100 text-rose-700 border-rose-200' },
    };
    const s = map[status ?? 'pending'] ?? map.pending;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${s.className}`}>
        {s.label}
      </span>
    );
  };

  const AppointmentCard = ({ appt }: { appt: CustomerActivity }) => (
    <div className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(appt.scheduled_at || appt.created_at)}</span>
          </div>
          <p className="text-[14px] font-bold text-slate-800 mt-1">{appt.title}</p>
          {appt.profiles?.display_name && (
            <div className="flex items-center gap-1.5 mt-0.5 text-[12px] text-slate-400">
              <User className="w-3.5 h-3.5" />
              <span>{appt.profiles.display_name}</span>
            </div>
          )}
          {appt.description && (
            <p className="mt-2 text-[12px] text-slate-500 line-clamp-2">{appt.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {statusBadge(appt.status)}
          {appt.status === 'pending' && (
            <div className="flex gap-1">
              <button
                onClick={() => statusMutation.mutate({ id: appt.id, status: 'done' })}
                className="px-2 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                Xong
              </button>
              <button
                onClick={() => statusMutation.mutate({ id: appt.id, status: 'cancelled' })}
                className="px-2 py-0.5 text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
              >
                Hủy
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-slate-800">
          Lịch hẹn ({appointments.length})
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5" />
          {showForm ? 'Đóng' : 'Thêm lịch hẹn'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <h4 className="text-[13px] font-bold text-slate-700">Tạo lịch hẹn mới</h4>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-slate-600">Ngày giờ hẹn *</label>
              <DateTimePicker24h
                value={formData.scheduled_at}
                onChange={(date) => setFormData(p => ({ ...p, scheduled_at: date }))}
                placeholder="Chọn ngày giờ hẹn"
                className="w-full"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="h-8 px-3 text-[12px] border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!formData.scheduled_at || createMutation.isPending}
              className="h-8 px-4 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {createMutation.isPending ? 'Đang lưu...' : 'Tạo lịch hẹn'}
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && appointments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-slate-200 rounded-xl">
          <Calendar className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-[14px] font-bold text-slate-500">Chưa có lịch hẹn nào</p>
          <p className="text-[12px] text-slate-400 mt-1">Nhấn "Thêm lịch hẹn" để tạo lịch hẹn đầu tiên</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sắp diễn ra ({upcoming.length})</p>
          {upcoming.map(appt => <AppointmentCard key={appt.id} appt={appt} />)}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-4">Đã qua ({past.length})</p>
          {past.map(appt => <AppointmentCard key={appt.id} appt={appt} />)}
        </div>
      )}
    </div>
  );
}

function TabLichChamSoc({ customerId }: { customerId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: profilesRes } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => profilesApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  // @ts-expect-error unused variable
  const profiles = profilesRes?.data?.data || [];

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<{ scheduled_at: Date | undefined; description: string }>({
    scheduled_at: undefined,
    description: '',
  });

  const { data: apptRes, isLoading } = useQuery({
    queryKey: ['care-events', customerId],
    queryFn: () => careScheduleApi.listEvents({ customer_id: customerId }),
    enabled: !!customerId,
  });
  const tasks: CareScheduleEvent[] = apptRes?.data?.data || [];

  const upcoming = tasks.filter(a => a.status === 'pending' || a.status === 'rescheduled');
  const past = tasks.filter(a => a.status === 'done' || a.status === 'skipped');

  const createMutation = useMutation({
    mutationFn: () => careScheduleApi.createEvent({
      customer_id: customerId,
      notes: formData.description.trim() || undefined,
      scheduled_date: new Date(formData.scheduled_at!).toISOString(),
      assigned_to: null,
    }),
    onSuccess: () => {
      setShowForm(false);
      setFormData({ scheduled_at: undefined, description: '' });
      queryClient.invalidateQueries({ queryKey: ['care-events', customerId] });
      queryClient.invalidateQueries({ queryKey: ['care-events'] });
      toast.success('Đã tạo lịch chăm sóc');
    },
    onError: (error: any) => {
      toast.error('Không thể tạo lịch chăm sóc', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'done' | 'skipped' }) =>
      careScheduleApi.updateEvent(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care-events', customerId] });
      queryClient.invalidateQueries({ queryKey: ['care-events'] });
      toast.success('Đã cập nhật trạng thái');
    },
  });

  const statusBadge = (status: string | null) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: 'Chờ diễn ra', className: 'bg-amber-100 text-amber-700 border-amber-200' },
      rescheduled: { label: 'Đã dời lịch', className: 'bg-blue-100 text-blue-700 border-blue-200' },
      done:    { label: 'Đã xong',     className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      skipped: { label: 'Đã bỏ qua',   className: 'bg-slate-100 text-slate-700 border-slate-200' },
    };
    const s = map[status ?? 'pending'] ?? map.pending;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${s.className}`}>
        {s.label}
      </span>
    );
  };

  const TaskCard = ({ task }: { task: CareScheduleEvent }) => (
    <div className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(task.scheduled_date || task.created_at)}</span>
          </div>
          <p className="text-[14px] font-bold text-slate-800 mt-1">Lịch chăm sóc</p>
          {task.profiles?.display_name && (
            <div className="flex items-center gap-1.5 mt-0.5 text-[12px] text-slate-400">
              <User className="w-3.5 h-3.5" />
              <span>{task.profiles.display_name}</span>
            </div>
          )}
          {task.notes && (
            <p className="mt-2 text-[13px] text-slate-600 line-clamp-3">{task.notes}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {statusBadge(task.status)}
          {(task.status === 'pending' || task.status === 'rescheduled') && (
            <div className="flex gap-1">
              <button
                onClick={() => statusMutation.mutate({ id: task.id, status: 'done' })}
                className="px-2 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                Xong
              </button>
              <button
                onClick={() => statusMutation.mutate({ id: task.id, status: 'skipped' })}
                className="px-2 py-0.5 text-[11px] font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Bỏ qua
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-slate-800">
          Lịch chăm sóc ({tasks.length})
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5" />
          {showForm ? 'Đóng' : 'Thêm lịch chăm sóc'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <h4 className="text-[13px] font-bold text-slate-700">Tạo lịch chăm sóc mới</h4>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-slate-600">Ngày giờ *</label>
              <DateTimePicker24h
                value={formData.scheduled_at}
                onChange={(date) => setFormData(p => ({ ...p, scheduled_at: date }))}
                placeholder="Chọn ngày giờ"
                className="w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-slate-600">Nội dung chăm sóc *</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                placeholder="Nhập nội dung công việc..."
                className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="h-8 px-3 text-[12px] border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!formData.scheduled_at || !formData.description.trim() || createMutation.isPending}
              className="h-8 px-4 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {createMutation.isPending ? 'Đang lưu...' : 'Tạo lịch'}
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-slate-200 rounded-xl">
          <Calendar className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-[14px] font-bold text-slate-500">Chưa có lịch chăm sóc nào</p>
          <p className="text-[12px] text-slate-400 mt-1">Nhấn "Thêm lịch chăm sóc" để lên lịch đầu tiên</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sắp diễn ra ({upcoming.length})</p>
          {upcoming.map(task => <TaskCard key={task.id} task={task} />)}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-4">Đã qua ({past.length})</p>
          {past.map(task => <TaskCard key={task.id} task={task} />)}
        </div>
      )}
    </div>
  );
}
