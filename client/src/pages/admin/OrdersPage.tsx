import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderApi, productApi, customerApi } from '@/api/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Check, ClipboardList, Copy, Plus, QrCode, X } from 'lucide-react';
import type {
  Order, OrderWithDetails, OrderItemInput, OrderPaymentStatus, OrderStatus,
  Product, Customer, ApiResponse,
} from '@/types';

// Cấu hình nhận thanh toán QR (VietQR)
// TODO: Thay bằng tài khoản thật của doanh nghiệp nếu khác.
const PAYMENT_QR_CONFIG = {
  bankBin: '970415', // VietinBank
  accountNo: '100001692967',
  accountName: 'CONG TY TNHH THUONG MAI DIEN TU TLINK',
};

// ──────────────────────────────────────────────────────────────────────────────
// STATUS BADGES
// ──────────────────────────────────────────────────────────────────────────────

const ORDER_STATUS_MAP: Record<OrderStatus, { label: string; cls: string }> = {
  draft:     { label: 'Nháp',       cls: 'bg-slate-100 text-slate-600' },
  confirmed: { label: 'Đã xác nhận',cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Đã hủy',     cls: 'bg-red-100 text-red-600' },
};

const PAYMENT_STATUS_MAP: Record<OrderPaymentStatus, { label: string; cls: string }> = {
  paid:           { label: 'Đã thanh toán', cls: 'bg-emerald-100 text-emerald-700' },
  partial:        { label: 'Một phần',      cls: 'bg-amber-100 text-amber-700' },
  unpaid:         { label: 'Chưa thanh toán',cls: 'bg-red-100 text-red-600' },
  not_applicable: { label: '—',             cls: 'bg-slate-100 text-slate-400' },
  cancelled:      { label: 'Đã hủy',         cls: 'bg-slate-100 text-slate-400' },
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, cls } = ORDER_STATUS_MAP[status] ?? ORDER_STATUS_MAP.draft;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{label}</span>;
}

function PaymentStatusBadge({ status }: { status: OrderPaymentStatus }) {
  const { label, cls } = PAYMENT_STATUS_MAP[status] ?? PAYMENT_STATUS_MAP.unpaid;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{label}</span>;
}

// ──────────────────────────────────────────────────────────────────────────────
// ORDER FORM — line item row
// ──────────────────────────────────────────────────────────────────────────────

interface LineItem extends OrderItemInput { _key: string }

function LineItemRow({
  item, index, products, onUpdate, onRemove,
}: {
  item: LineItem;
  index: number;
  products: Product[];
  onUpdate: (index: number, field: keyof OrderItemInput, value: string | number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-2">
        <select
          value={item.product_id}
          onChange={e => {
            const p = products.find(p => p.id === e.target.value);
            if (p) {
              onUpdate(index, 'product_id', p.id);
              onUpdate(index, 'product_name', p.name);
              onUpdate(index, 'product_price_snapshot', p.base_price);
              onUpdate(index, 'unit_price', p.base_price);
            }
          }}
          className="w-full text-[13px] border border-input rounded px-2 py-1.5 bg-background"
        >
          <option value="">Chọn sản phẩm...</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
          ))}
        </select>
      </td>
      <td className="py-2 px-2">
        <input
          type="number"
          min={1}
          value={item.quantity}
          onChange={e => onUpdate(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
          className="w-20 text-[13px] border border-input rounded px-2 py-1.5 bg-background text-right"
        />
      </td>
      <td className="py-2 px-2">
        <CurrencyInput
          value={item.unit_price}
          onChange={val => onUpdate(index, 'unit_price', val || 0)}
          className="w-32 h-8 text-right text-[13px]"
        />
      </td>
      <td className="py-2 px-2 text-right text-[13px] font-medium">
        {formatCurrency(item.quantity * item.unit_price)}
      </td>
      <td className="py-2 pl-2">
        <button
          onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-600 transition-colors inline-flex items-center justify-center"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// CREATE ORDER DIALOG
// ──────────────────────────────────────────────────────────────────────────────

function CreateOrderDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [error, setError] = useState('');

  const { data: customersResp } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customerApi.list({ limit: 200 }),
  });
  const { data: productsResp } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => productApi.list({ limit: 500, is_active: true }),
  });

  const customers: Customer[] = (customersResp?.data as ApiResponse<Customer[]>)?.data ?? [];
  const products: Product[]   = (productsResp?.data  as ApiResponse<Product[]>)?.data  ?? [];

  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof orderApi.create>[0]) => orderApi.create(data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.error ?? 'Tạo đơn hàng thất bại'),
  });

  // Memoized totals to avoid recalculation on every render
  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.quantity * i.unit_price, 0),
    [items]
  );
  const finalAmount = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);

  const addItem = useCallback(() => {
    setItems(prev => [...prev, {
      _key: crypto.randomUUID(),
      product_id: '', product_name: '', product_price_snapshot: 0,
      quantity: 1, unit_price: 0,
    }]);
  }, []);

  const updateItem = useCallback((index: number, field: keyof OrderItemInput, value: string | number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = () => {
    setError('');
    if (!customerId) { setError('Vui lòng chọn khách hàng'); return; }
    if (items.length === 0) { setError('Cần ít nhất 1 sản phẩm'); return; }
    const invalid = items.some(i => !i.product_id || i.unit_price <= 0);
    if (invalid) { setError('Vui lòng điền đầy đủ thông tin sản phẩm'); return; }
    if (discount > subtotal) { setError('Giảm giá không được vượt quá tổng tiền hàng'); return; }

    mutation.mutate({
      customer_id: customerId,
      discount_amount: discount,
      notes: notes || null,
      items: items.map(({ _key: _k, ...i }) => i),
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-[16px] font-bold">Tạo đơn hàng mới</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>
        {/* Rest of dialog content... */}


        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Customer */}
          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">Khách hàng *</label>
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full text-[13px] border border-input rounded-lg px-3 py-2 bg-background"
            >
              <option value="">Chọn khách hàng...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.customer_name} {c.phone_number ? `(${c.phone_number})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-semibold text-muted-foreground">Sản phẩm *</label>
              <button
                onClick={addItem}
                className="text-[12px] font-medium text-indigo-600 hover:text-indigo-700"
              >+ Thêm dòng</button>
            </div>

            {items.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-lg py-8 text-center">
                <p className="text-[13px] text-muted-foreground">Chưa có sản phẩm</p>
                <button onClick={addItem} className="mt-2 text-[13px] text-indigo-600 hover:underline">+ Thêm sản phẩm</button>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Sản phẩm</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground w-24">SL</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground w-36">Đơn giá</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground w-32">Thành tiền</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border px-2">
                    {items.map((item, index) => (
                      <LineItemRow
                        key={item._key}
                        item={item} index={index}
                        products={products}
                        onUpdate={updateItem}
                        onRemove={removeItem}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Totals + Discount */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tổng tiền hàng</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground shrink-0">Giảm giá</span>
                <CurrencyInput
                  value={discount}
                  onChange={val => setDiscount(Math.min(subtotal, Number(val) || 0))}
                  className="w-32 h-8 text-right text-[13px]"
                />
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-[14px] font-bold">
                <span>Thành tiền</span>
                <span className="text-indigo-600">{formatCurrency(finalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">Ghi chú</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Ghi chú đơn hàng..."
              className="w-full text-[13px] border border-input rounded-lg px-3 py-2 bg-background resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
          <button onClick={onClose} className="px-4 py-2 text-[13px] border border-border rounded-lg hover:bg-accent transition-colors">
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="px-5 py-2 text-[13px] font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Đang tạo...' : 'Tạo đơn hàng'}
          </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

// ──────────────────────────────────────────────────────────────────────────────
// ORDER DETAIL PANEL
// ──────────────────────────────────────────────────────────────────────────────

function OrderDetailPanel({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data: resp, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderApi.get(orderId),
  });
  const order = (resp?.data as ApiResponse<OrderWithDetails>)?.data;

  const confirmMut = useMutation({
    mutationFn: () => orderApi.confirm(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
  const cancelMut = useMutation({
    mutationFn: () => orderApi.cancel(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const remainingAmount = Math.max(0, Math.round(order?.payment_summary?.remaining ?? order?.final_amount ?? 0));
  const transferContent = order?.code ? `THANH TOAN ${order.code}` : 'THANH TOAN DON HANG';
  const canRenderPaymentQr =
    !!PAYMENT_QR_CONFIG.bankBin &&
    !!PAYMENT_QR_CONFIG.accountNo &&
    !!PAYMENT_QR_CONFIG.accountName &&
    remainingAmount > 0;
  const paymentQrUrl = canRenderPaymentQr
    ? `https://img.vietqr.io/image/${PAYMENT_QR_CONFIG.bankBin}-${PAYMENT_QR_CONFIG.accountNo}-compact2.png?amount=${remainingAmount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(PAYMENT_QR_CONFIG.accountName)}`
    : '';

  return createPortal(
    <div className="fixed top-0 left-0 right-0 bottom-0 z-[999] flex justify-end">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border-l border-border shadow-2xl flex flex-col h-full overflow-hidden animate-in fade-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-[15px] font-bold">{order?.code ?? '...'}</h3>
            {order && <OrderStatusBadge status={order.status} />}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-[13px]">Đang tải...</div>
        ) : order ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Customer info */}
            <div className="bg-muted/40 rounded-lg p-3 text-[13px]">
              <p className="font-semibold">{order.customer?.customer_name}</p>
              <p className="text-muted-foreground">{order.customer?.phone_number ?? '—'}</p>
            </div>

            {/* Items */}
            <div>
              <p className="text-[12px] font-semibold text-muted-foreground mb-2">SẢN PHẨM</p>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Tên SP</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">SL</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Đơn giá</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">T.Tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map(item => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-3 py-2">{item.product_name}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial summary */}
            <div className="bg-muted/40 rounded-lg p-3 space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tổng tiền hàng</span>
                <span>{formatCurrency(order.total_amount)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Giảm giá</span>
                  <span>- {formatCurrency(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t border-border pt-1.5">
                <span>Thành tiền</span>
                <span className="text-indigo-600">{formatCurrency(order.final_amount)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Đã thanh toán</span>
                <span>{formatCurrency(order.payment_summary?.total_paid ?? 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-red-600 border-t border-border pt-1.5">
                <span>Còn lại</span>
                <span>{formatCurrency(order.payment_summary?.remaining ?? order.final_amount)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-muted-foreground">Trạng thái TT</span>
                <PaymentStatusBadge status={order.payment_summary?.payment_status ?? 'unpaid'} />
              </div>
            </div>

            {/* Payment QR */}
            <div className="bg-white border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <QrCode className="w-4 h-4 text-indigo-600" />
                <p className="text-[12px] font-semibold text-muted-foreground">QR THANH TOÁN</p>
              </div>
              {canRenderPaymentQr ? (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <img src={paymentQrUrl} alt="QR thanh toán" className="w-48 h-48 object-contain border border-slate-200 rounded-lg bg-white" />
                  </div>
                  <div className="text-[12px] space-y-1">
                    <p><span className="text-muted-foreground">Ngân hàng:</span> {PAYMENT_QR_CONFIG.bankBin}</p>
                    <p><span className="text-muted-foreground">Số tài khoản:</span> {PAYMENT_QR_CONFIG.accountNo}</p>
                    <p><span className="text-muted-foreground">Số tiền:</span> <span className="font-semibold text-indigo-600">{formatCurrency(remainingAmount)}</span></p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate"><span className="text-muted-foreground">Nội dung:</span> {transferContent}</p>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(transferContent)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-slate-200 rounded-md hover:bg-slate-50"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
                  Chưa có cấu hình tài khoản nhận tiền hoặc đơn đã thanh toán đủ. Cập nhật `PAYMENT_QR_CONFIG` trong `OrdersPage` để hiển thị QR.
                </p>
              )}
            </div>

            {/* Dates */}
            <div className="text-[12px] text-muted-foreground space-y-1">
              <p>Ngày đặt: {formatDate(order.order_date)}</p>
              <p>Tạo lúc: {formatDate(order.created_at)}</p>
            </div>

            {/* Error messages */}
            {(confirmMut.isError || cancelMut.isError) && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-lg px-3 py-2">
                {(confirmMut.error as any)?.response?.data?.error
                  ?? (cancelMut.error as any)?.response?.data?.error
                  ?? 'Có lỗi xảy ra'}
              </div>
            )}
          </div>
        ) : null}

        {/* Actions */}
        {order && (
          <div className="flex gap-2 p-4 border-t border-border bg-muted/30">
            {order.status === 'draft' && (
              <>
                <button
                  onClick={() => confirmMut.mutate()}
                  disabled={confirmMut.isPending}
                  className="flex-1 py-2 text-[13px] font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  {confirmMut.isPending ? '...' : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Xác nhận
                    </>
                  )}
                </button>
                <button
                  onClick={() => { if (window.confirm('Hủy đơn hàng này?')) cancelMut.mutate(); }}
                  disabled={cancelMut.isPending}
                  className="flex-1 py-2 text-[13px] font-semibold border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  Hủy đơn
                </button>
              </>
            )}
            {order.status === 'confirmed' && (
              <button
                onClick={() => { if (window.confirm('Hủy đơn đã xác nhận? Đảm bảo không có thanh toán.')) cancelMut.mutate(); }}
                disabled={cancelMut.isPending}
                className="flex-1 py-2 text-[13px] font-semibold border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {cancelMut.isPending ? '...' : 'Hủy đơn hàng'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ status: '', search: '', customer_id: '' });
  const queryClient = useQueryClient();

  const { data: resp, isLoading } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => orderApi.list({
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.customer_id ? { customer_id: filters.customer_id } : {}),
    }),
    staleTime: 30_000,
  });

  const orders: Order[] = (resp?.data as ApiResponse<Order[]>)?.data ?? [];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold">Đơn hàng</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Quản lý đơn đặt hàng của khách</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Tạo đơn hàng
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Tìm mã đơn..."
          value={filters.search}
          onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
          className="text-[13px] border border-input rounded-lg px-3 py-2 bg-background w-48"
        />
        <select
          value={filters.status}
          onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
          className="text-[13px] border border-input rounded-lg px-3 py-2 bg-background"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="draft">Nháp</option>
          <option value="confirmed">Đã xác nhận</option>
          <option value="cancelled">Đã hủy</option>
        </select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        {isLoading ? (
          <div className="py-16 text-center text-[13px] text-muted-foreground">Đang tải...</div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-muted-foreground">
            <ClipboardList className="w-8 h-8 mx-auto mb-3 text-muted-foreground/60" />
            <p>Chưa có đơn hàng nào</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Mã đơn</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Khách hàng</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Ngày đặt</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Thành tiền</th>
                <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Đơn hàng</th>
                <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Thanh toán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map(order => {
                const ps = order.v_order_payment_summary?.[0];
                return (
                  <tr
                    key={order.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedId(order.id)}
                  >
                    <td className="px-5 py-3.5 font-mono font-medium text-indigo-600">{order.code}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{order.customers?.customer_name ?? '—'}</p>
                      <p className="text-muted-foreground text-[11px]">{order.customers?.phone_number ?? ''}</p>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{formatDate(order.order_date)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold">{formatCurrency(order.final_amount)}</td>
                    <td className="px-5 py-3.5 text-center">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <PaymentStatusBadge status={(ps?.payment_status as OrderPaymentStatus) ?? 'unpaid'} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create dialog */}
      {showCreate && (
        <CreateOrderDialog
          onClose={() => setShowCreate(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['orders'] })}
        />
      )}

      {/* Detail panel */}
      {selectedId && (
        <OrderDetailPanel
          orderId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
