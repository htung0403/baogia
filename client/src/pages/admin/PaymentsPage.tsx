import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentApi, customerApi, orderApi, financialApi } from '@/api/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import type {
  Payment, PaymentMethod, Customer, Order, CustomerFinancial, ApiResponse,
} from '@/types';

// ──────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

const METHOD_MAP: Record<PaymentMethod, { label: string; cls: string }> = {
  cash:     { label: 'Tiền mặt',    cls: 'bg-emerald-100 text-emerald-700' },
  transfer: { label: 'Chuyển khoản',cls: 'bg-blue-100 text-blue-700' },
  card:     { label: 'Thẻ',         cls: 'bg-violet-100 text-violet-700' },
  momo:     { label: 'MoMo',        cls: 'bg-pink-100 text-pink-700' },
};

function MethodBadge({ method }: { method: PaymentMethod }) {
  const { label, cls } = METHOD_MAP[method] ?? METHOD_MAP.transfer;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{label}</span>;
}

// ──────────────────────────────────────────────────────────────────────────────
// RECORD PAYMENT DIALOG
// ──────────────────────────────────────────────────────────────────────────────

function RecordPaymentDialog({
  defaultCustomerId,
  onClose,
  onSuccess,
}: {
  defaultCustomerId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? '');
  const [orderId, setOrderId]       = useState('');  // optional
  const [amount, setAmount]         = useState<number | ''>('');
  const [method, setMethod]         = useState<PaymentMethod>('transfer');
  const [notes, setNotes]           = useState('');
  const [error, setError]           = useState('');

  // Fetch all customers
  const { data: custResp } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customerApi.list({ limit: 200 }),
  });
  const customers: Customer[] = (custResp?.data as ApiResponse<Customer[]>)?.data ?? [];

  // Fetch confirmed orders for selected customer
  const { data: ordersResp } = useQuery({
    queryKey: ['customer-orders-confirmed', customerId],
    queryFn: () => orderApi.list({ customer_id: customerId, status: 'confirmed' }),
    enabled: !!customerId,
  });
  const customerOrders: Order[] = (ordersResp?.data as ApiResponse<Order[]>)?.data ?? [];

  // Fetch financial summary for selected customer (live debt)
  const { data: finResp } = useQuery({
    queryKey: ['customer-financial', customerId],
    queryFn: () => financialApi.getCustomerSummary(customerId),
    enabled: !!customerId,
  });
  const financial: CustomerFinancial | null =
    (finResp?.data as ApiResponse<CustomerFinancial>)?.data ?? null;

  const currentDebt   = financial?.total_debt ?? 0;
  const creditBalance = financial?.credit_balance ?? 0;
  const numAmount     = typeof amount === 'number' ? amount : 0;

  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof paymentApi.record>[0]) => paymentApi.record(data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.error ?? 'Ghi nhận thanh toán thất bại'),
  });

  const handleSubmit = () => {
    setError('');
    if (!customerId) { setError('Vui lòng chọn khách hàng'); return; }
    if (!numAmount || numAmount <= 0) { setError('Số tiền phải lớn hơn 0'); return; }

    mutation.mutate({
      customer_id:    customerId,
      order_id:       orderId || null,
      amount:         numAmount,
      payment_method: method,
      notes:          notes || null,
    });
  };

  // Auto-fill amount = current debt when order is selected
  useEffect(() => {
    if (orderId) {
      const order = customerOrders.find(o => o.id === orderId);
      if (order) {
        const ps = order.v_order_payment_summary?.[0];
        if (ps) setAmount(ps.remaining);
        else setAmount(order.final_amount);
      }
    }
  }, [orderId, customerOrders]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[16px] font-bold">Ghi nhận thanh toán</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Customer */}
          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">Khách hàng *</label>
            <select
              value={customerId}
              onChange={e => { setCustomerId(e.target.value); setOrderId(''); setAmount(''); }}
              className="w-full text-[13px] border border-input rounded-lg px-3 py-2 bg-background"
            >
              <option value="">Chọn khách hàng...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.customer_name} {c.phone_number ? `(${c.phone_number})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Customer Debt Summary */}
          {customerId && financial && (
            <div className={`rounded-lg p-3 text-[13px] ${currentDebt > 0 ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Công nợ hiện tại</span>
                <span className={`font-bold ${currentDebt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatCurrency(currentDebt)}
                </span>
              </div>
              {creditBalance > 0 && (
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Số dư credit</span>
                  <span className="font-semibold text-amber-600">{formatCurrency(creditBalance)}</span>
                </div>
              )}
            </div>
          )}

          {/* Order (optional) */}
          {customerId && customerOrders.length > 0 && (
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                Đơn hàng <span className="font-normal">(tuỳ chọn)</span>
              </label>
              <select
                value={orderId}
                onChange={e => setOrderId(e.target.value)}
                className="w-full text-[13px] border border-input rounded-lg px-3 py-2 bg-background"
              >
                <option value="">Thanh toán tổng (không gắn với đơn)</option>
                {customerOrders.map(o => {
                  const ps = o.v_order_payment_summary?.[0];
                  return (
                    <option key={o.id} value={o.id}>
                      {o.code} — còn {formatCurrency(ps?.remaining ?? o.final_amount)}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Amount */}
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">Số tiền thanh toán</label>
              <CurrencyInput
                value={amount}
                onChange={val => setAmount(val)}
                className="text-[13px] h-9"
                placeholder="Nhập số tiền..."
              />
            </div>

            {currentDebt === 0 && customerId && financial && (
              <p className="mt-1.5 text-[12px] text-emerald-600">
                ✓ Khách hàng không có công nợ. Khoản thanh toán sẽ được ghi nhận là credit.
              </p>
            )}

          {/* Method */}
          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">Phương thức *</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(METHOD_MAP) as [PaymentMethod, typeof METHOD_MAP[PaymentMethod]][]).map(([key, { label }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMethod(key)}
                  className={`py-2 text-[12px] font-semibold rounded-lg border transition-colors ${
                    method === key
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-border hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">Ghi chú</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Ghi chú thanh toán..."
              className="w-full text-[13px] border border-input rounded-lg px-3 py-2 bg-background resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-border bg-muted/30">
          <button onClick={onClose} className="flex-1 py-2 text-[13px] border border-border rounded-lg hover:bg-accent transition-colors">
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 py-2 text-[13px] font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Đang lưu...' : 'Ghi nhận'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [showRecord, setShowRecord] = useState(false);
  const [filterCustomer, setFilterCustomer] = useState('');
  const queryClient = useQueryClient();

  const { data: resp, isLoading } = useQuery({
    queryKey: ['payments', filterCustomer],
    queryFn: () => paymentApi.list({
      ...(filterCustomer ? { customer_id: filterCustomer } : {}),
    }),
    staleTime: 30_000,
  });
  const payments: Payment[] = (resp?.data as ApiResponse<Payment[]>)?.data ?? [];

  const { data: custResp } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customerApi.list({ limit: 200 }),
  });
  const customers: Customer[] = (custResp?.data as ApiResponse<Customer[]>)?.data ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold">Thanh toán</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Lịch sử ghi nhận thanh toán</p>
        </div>
        <button
          onClick={() => setShowRecord(true)}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
        >
          + Ghi nhận thanh toán
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <select
          value={filterCustomer}
          onChange={e => setFilterCustomer(e.target.value)}
          className="text-[13px] border border-input rounded-lg px-3 py-2 bg-background min-w-60"
        >
          <option value="">Tất cả khách hàng</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.customer_name}</option>
          ))}
        </select>
      </div>

      {/* Timeline / Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        {isLoading ? (
          <div className="py-16 text-center text-[13px] text-muted-foreground">Đang tải...</div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-muted-foreground">
            <p className="text-3xl mb-3">💳</p>
            <p>Chưa có giao dịch thanh toán</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Mã TT</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Khách hàng</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Đơn hàng</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Ngày TT</th>
                <th className="text-center px-5 py-3 font-semibold text-muted-foreground">P.thức</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Số tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-medium text-indigo-600">{p.code}</td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium">{p.customers?.customer_name ?? '—'}</p>
                    <p className="text-muted-foreground text-[11px]">{p.customers?.phone_number ?? ''}</p>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {p.orders ? (
                      <span className="font-mono text-indigo-500">{p.orders.code}</span>
                    ) : (
                      <span className="italic">Tổng hợp</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{formatDate(p.paid_at)}</td>
                  <td className="px-5 py-3.5 text-center">
                    <MethodBadge method={p.payment_method} />
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-emerald-600">
                    +{formatCurrency(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Record dialog */}
      {showRecord && (
        <RecordPaymentDialog
          onClose={() => setShowRecord(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['customer-financial'] });
          }}
        />
      )}
    </div>
  );
}
