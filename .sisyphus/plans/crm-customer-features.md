# Plan: CRM Customer Features — Lịch hẹn, Lần chăm sóc cuối, Form mở rộng

**Created**: 2026-04-23  
**Scope**: 3 tính năng CRM còn thiếu trên codebase hiện có  
**Stack**: React + Node.js/Express + Supabase PostgreSQL  

---

## Tóm tắt Scope

**IN (cần làm):**
- Thêm `customer_group` + `facebook` + `skype` vào `CustomerFormModal` (file `temp.tsx`)
- Implement tab "Lịch hẹn" trong `CustomerDetailPage.tsx` (đang là placeholder)
- Hiển thị "Lần chăm sóc cuối" trong danh sách KH (Tab 1) + sidebar KH detail
- DB migration: thêm `scheduled_at` + `status` vào `customer_activities`
- Backend: mở rộng validator + thêm filter `?type=` cho listActivities endpoint
- Backend: trả `last_activity_at` từ `listCustomers` + `getCustomerStats`

**OUT (không làm):**
- Calendar view cho lịch hẹn
- Notification/reminder tự động
- Recurring appointments
- Thêm các field khác vào form (tax_code, industry, website, fax)
- Di chuyển `temp.tsx` sang thư mục khác
- Thêm `deleted_at` vào `customer_activities`

---

## Guardrails (từ Metis)

- `scheduled_at` và `status` PHẢI là `NULLABLE` — KHÔNG được có default, KHÔNG được required
- Luồng `TabTraoDoi` hiện tại KHÔNG được thay đổi
- `customer_group`, `facebook`, `skype` trong form PHẢI là optional (không required)
- Chỉ edit `temp.tsx` in-place — KHÔNG di chuyển file
- Chỉ thêm `?type=` filter vào endpoint hiện có — KHÔNG tạo endpoint mới riêng

---

## Phase 1: Database Migration

### Task 1.1 — Tạo file migration `012_add_scheduled_at_status.sql`

**File**: `D:\job-baogia\database\012_add_scheduled_at_status.sql`

**Nội dung cần viết:**
```sql
BEGIN;

-- ============================================================
-- 012_add_scheduled_at_status.sql
-- Add scheduled_at and status to customer_activities
-- ============================================================

ALTER TABLE customer_activities
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
-- NULL = not a scheduled meeting; filled only for activity_type='meeting'

ALTER TABLE customer_activities
  ADD COLUMN IF NOT EXISTS status TEXT
  CHECK (status IN ('pending', 'done', 'cancelled'));
-- NULL for non-meeting activities; explicit status for meetings

CREATE INDEX IF NOT EXISTS idx_activities_scheduled
  ON customer_activities(customer_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

COMMIT;
```

**QA sau task này:**
```bash
# Chạy trong Supabase SQL Editor hoặc psql
# Expected: ALTER TABLE completes, no errors
# Verify: \d customer_activities — should show scheduled_at and status columns
```

---

## Phase 2: Backend

### Task 2.1 — Mở rộng `createActivitySchema` trong validators

**File**: `D:\job-baogia\backend\src\validators\index.ts`

**Vị trí**: Tìm `createActivitySchema` (hiện chưa có — cần tạo mới hoặc tìm schema tương ứng)

**Lưu ý quan trọng**: Tìm kiếm schema thực tế bằng:
```bash
ast_grep_search pattern="createActivitySchema" lang="typescript"
```
Nếu schema nằm trong `validators/index.ts` nhưng chưa exported, kiểm tra lại. Nếu không tìm thấy, schema có thể được inline trong controller.

**Thay đổi cần làm:**
Thêm 2 field vào schema validate activity (dù tên gọi là gì):
```typescript
scheduled_at: z.string().datetime({ offset: true }).optional().nullable(),
status: z.enum(['pending', 'done', 'cancelled']).optional().nullable(),
```

**QUAN TRỌNG**: Cả 2 field đều PHẢI là `.optional().nullable()` — không được required.

**Export type** nếu có `CreateActivityInput = z.infer<typeof createActivitySchema>` — cập nhật luôn.

**QA sau task này:**
```bash
cd D:\job-baogia\backend && npx tsc --noEmit
# Expected: 0 errors
```

### Task 2.2 — Thêm filter `?type=` vào `listActivities` handler

**File**: `D:\job-baogia\backend\src\controllers\pipeline.controller.ts`

**Tìm hàm**: `listActivities` (khoảng line 100+ — dùng lsp_symbols để xác định chính xác)

**Thay đổi**: Thêm optional query param `type` vào query Supabase:
```typescript
export async function listActivities(req: Request, res: Response, next: NextFunction) {
  try {
    const { customerId } = req.params;
    const type = req.query.type as string | undefined; // NEW

    let query = supabaseAdmin
      .from('customer_activities')
      .select('*, profiles:created_by(display_name)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (type) {                          // NEW
      query = query.eq('activity_type', type); // NEW
    }                                    // NEW

    const { data, error } = await query;
    if (error) throw ApiError.internal(error.message);
    sendSuccess(res, data ?? []);
  } catch (error) {
    next(error);
  }
}
```

**PHẢI đọc code thực tế của hàm này trước khi edit** — chỉ thêm filter, không thay đổi logic hiện có.

**QA sau task này:**
```bash
# Test không có filter (backward compat)
curl http://localhost:3001/api/pipeline/activities/$CUSTOMER_ID \
  -H "Authorization: Bearer $TOKEN"
# Expected: all activity types returned

# Test với filter type=meeting
curl "http://localhost:3001/api/pipeline/activities/$CUSTOMER_ID?type=meeting" \
  -H "Authorization: Bearer $TOKEN"
# Expected: only meeting activities returned
```

### Task 2.3 — Thêm `last_activity_at` vào `listCustomers`

**File**: `D:\job-baogia\backend\src\controllers\customer.controller.ts`

**Hàm**: `listCustomers` (line ~13)

**Thay đổi**: Thêm subquery correlated vào Supabase select. Supabase không hỗ trợ raw subquery trong `.select()` — cần dùng một trong hai cách:

**Cách A (đơn giản — dùng RPC hoặc view)**: Tạo DB view `v_customers_with_last_activity` hoặc dùng `supabaseAdmin.rpc()`.

**Cách B (đơn giản nhất — N+1 nhưng chấp nhận được)**: Sau khi lấy danh sách KH, batch-fetch MAX(created_at) cho tất cả customer_id trong page đó.

**Dùng Cách B** (MVP, safe):
```typescript
// Sau khi có data từ query customers
const customerIds = (data ?? []).map((c: any) => c.id);

let lastActivityMap: Record<string, string | null> = {};
if (customerIds.length > 0) {
  const { data: actData } = await supabaseAdmin
    .from('customer_activities')
    .select('customer_id, created_at')
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false });

  // Group by customer_id, take first (most recent)
  for (const act of (actData ?? [])) {
    if (!lastActivityMap[act.customer_id]) {
      lastActivityMap[act.customer_id] = act.created_at;
    }
  }
}

const enriched = (data ?? []).map((c: any) => ({
  ...c,
  last_activity_at: lastActivityMap[c.id] ?? null,
}));
```

**Trả `enriched` thay vì `data` trong `sendSuccess`.**

**Đọc code thực tế** của `listCustomers` trước để hiểu cấu trúc response hiện tại.

**QA sau task này:**
```bash
curl http://localhost:3001/api/customers \
  -H "Authorization: Bearer $TOKEN"
# Expected: each customer object has last_activity_at field (string ISO or null)
```

### Task 2.4 — Thêm `last_activity_at` vào `getCustomerStats`

**File**: `D:\job-baogia\backend\src\controllers\customer.controller.ts`

**Hàm**: `getCustomerStats` (line ~264)

**Thay đổi**: Thêm query lấy MAX created_at từ customer_activities:
```typescript
// Thêm sau query stageHistory (section 6)
// 8. Last activity date
const { data: lastActRow } = await supabaseAdmin
  .from('customer_activities')
  .select('created_at')
  .eq('customer_id', id)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

const lastActivityAt = lastActRow?.created_at ?? null;
```

**Thêm vào object return của `sendSuccess`:**
```typescript
sendSuccess(res, {
  // ... existing fields ...
  last_activity_at: lastActivityAt,  // NEW
});
```

**QA sau task này:**
```bash
curl http://localhost:3001/api/customers/$CUSTOMER_ID/stats \
  -H "Authorization: Bearer $TOKEN"
# Expected: response includes last_activity_at field
```

---

## Phase 3: Frontend — CustomerFormModal

### Task 3.1 — Thêm fields vào `CustomerFormModal` trong `temp.tsx`

**File**: `D:\job-baogia\temp.tsx`

**Đọc file đầy đủ trước** để hiểu cấu trúc state + handleSubmit.

**Thay đổi 1 — Thêm vào state `formData`:**
```typescript
const [formData, setFormData] = useState({
  customer_name: customer?.customer_name ?? '',
  phone_number: customer?.phone_number ?? '',
  email: customer?.email ?? '',
  address: customer?.address ?? '',
  notes: customer?.notes ?? '',
  customer_group: customer?.customer_group ?? '',   // NEW
  facebook: customer?.facebook ?? '',               // NEW
  skype: customer?.skype ?? '',                     // NEW
  create_account: false,
  account_phone: '',
  account_password: '',
});
```

**Thay đổi 2 — Thêm vào `handleSubmit` payload:**
```typescript
const data: Record<string, unknown> = {
  customer_name: formData.customer_name,
  phone_number: formData.phone_number || null,
  email: formData.email || null,
  address: formData.address || null,
  notes: formData.notes || null,
  customer_group: formData.customer_group || null,   // NEW
  facebook: formData.facebook || null,               // NEW
  skype: formData.skype || null,                     // NEW
};
```

**Thay đổi 3 — Thêm UI fields** (đặt sau field "Địa chỉ", trước "Ghi chú"):
```tsx
{/* Nhóm KH */}
<div className="space-y-1.5">
  <label className="text-[13px] font-medium">Nhóm khách hàng</label>
  <input
    type="text"
    value={formData.customer_group}
    onChange={(e) => updateField('customer_group', e.target.value)}
    placeholder="VIP, Đại lý, Bán lẻ..."
    className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
  />
</div>

{/* Mạng xã hội */}
<div className="grid grid-cols-2 gap-4">
  <div className="space-y-1.5">
    <label className="text-[13px] font-medium">Facebook</label>
    <input
      type="text"
      value={formData.facebook}
      onChange={(e) => updateField('facebook', e.target.value)}
      placeholder="facebook.com/..."
      className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
    />
  </div>
  <div className="space-y-1.5">
    <label className="text-[13px] font-medium">Skype</label>
    <input
      type="text"
      value={formData.skype}
      onChange={(e) => updateField('skype', e.target.value)}
      placeholder="Skype ID..."
      className="w-full h-8 px-3 text-[13px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
    />
  </div>
</div>
```

**QA sau task này:**
```bash
cd D:\job-baogia\client && npx tsc --noEmit
# Expected: 0 TypeScript errors

# Manual UI check:
# 1. Mở form "Thêm khách hàng" — thấy 3 field mới
# 2. Điền "Nhóm KH = VIP", "Facebook = fb.com/test", "Skype = test123"
# 3. Submit — kiểm tra Network tab: request body có customer_group, facebook, skype
# 4. Mở form "Sửa" KH đã tạo — 3 field mới hiển thị đúng giá trị cũ
```

---

## Phase 4: Frontend — Tab Lịch hẹn

### Task 4.1 — Cập nhật `CustomerActivity` type trong `client/src/types/index.ts`

**File**: `D:\job-baogia\client\src\types\index.ts`

**Tìm `CustomerActivity` interface** (khoảng line 360):
```typescript
export interface CustomerActivity {
  id: string;
  customer_id: string;
  activity_type: 'email' | 'sms' | 'zns' | 'call' | 'task' | 'meeting' | 'note' | 'trao_doi';
  title: string;
  description: string | null;
  assigned_to: string | null;
  related_project: string | null;
  created_by: string;
  created_at: string;
  scheduled_at: string | null;    // NEW
  status: 'pending' | 'done' | 'cancelled' | null;  // NEW
  profiles?: { display_name: string } | null;        // NEW (joined field from API)
}
```

**QA sau task này:**
```bash
cd D:\job-baogia\client && npx tsc --noEmit
# Expected: 0 errors (hoặc chỉ errors từ code chưa implement, không phải type mismatch)
```

### Task 4.2 — Thêm `listAppointments` vào `pipelineApi` trong `client.ts`

**File**: `D:\job-baogia\client\src\api\client.ts`

**Tìm `pipelineApi`**, thêm sau `listActivities`:
```typescript
listAppointments: (customerId: string) =>
  api.get(`/pipeline/activities/${customerId}`, { params: { type: 'meeting' } }),

createAppointment: (data: {
  customer_id: string;
  title: string;
  description?: string | null;
  scheduled_at: string;           // required cho meeting
  status?: 'pending' | 'done' | 'cancelled';
  assigned_to?: string | null;
}) =>
  api.post('/pipeline/activities', {
    ...data,
    activity_type: 'meeting',
  }),

updateAppointmentStatus: (activityId: string, status: 'pending' | 'done' | 'cancelled') =>
  api.patch(`/pipeline/activities/${activityId}/status`, { status }),
```

**Lưu ý**: `updateAppointmentStatus` cần backend endpoint mới (xem Task 2.5 bên dưới).

### Task 4.3 — Tạo backend endpoint `PATCH /pipeline/activities/:id/status`

**File**: `D:\job-baogia\backend\src\routes\pipeline.routes.ts`

**Thêm route:**
```typescript
router.patch('/activities/:id/status', updateActivityStatus);
```

**File**: `D:\job-baogia\backend\src\controllers\pipeline.controller.ts`

**Thêm hàm `updateActivityStatus`:**
```typescript
export async function updateActivityStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'done', 'cancelled'].includes(status)) {
      throw ApiError.badRequest('Status không hợp lệ');
    }

    const { data, error } = await supabaseAdmin
      .from('customer_activities')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) throw ApiError.notFound('Không tìm thấy activity');
    sendSuccess(res, data, 'Cập nhật trạng thái thành công');
  } catch (error) {
    next(error);
  }
}
```

**Import** hàm này trong `pipeline.routes.ts`.

**QA:**
```bash
curl -X PATCH http://localhost:3001/api/pipeline/activities/$ACTIVITY_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"done"}'
# Expected: 200 with updated activity object
```

### Task 4.4 — Implement `TabLichHen` component trong `CustomerDetailPage.tsx`

**File**: `D:\job-baogia\client\src\pages\admin\CustomerDetailPage.tsx`

**Đọc `TabTraoDoi` function** (line ~763) để nắm pattern trước khi viết.

**Thay đổi 1 — Cập nhật render condition** (line ~482):
```tsx
// TÌM dòng này:
{['kh-phan-hoi', 'lich-hen', 'co-hoi', 'lich-di-tuyen', 'automation', 'gioi-thieu', 'ticket'].includes(activeTab) && (
  <TabPlaceholder id={activeTab} />
)}

// SỬA thành:
{activeTab === 'lich-hen' && <TabLichHen customerId={customer.id} />}
{['kh-phan-hoi', 'co-hoi', 'lich-di-tuyen', 'automation', 'gioi-thieu', 'ticket'].includes(activeTab) && (
  <TabPlaceholder id={activeTab} />
)}
```

**Thay đổi 2 — Thêm `TabLichHen` component** ở cuối file (sau `TabPayments`):

```tsx
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
  const profiles = profilesRes?.data?.data || [];

  // State form tạo hẹn
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduled_at: '',
    assigned_to: '',
  });

  // Fetch danh sách lịch hẹn
  const { data: apptRes, isLoading } = useQuery({
    queryKey: ['appointments', customerId],
    queryFn: () => pipelineApi.listAppointments(customerId),
    enabled: !!customerId,
  });
  const appointments: CustomerActivity[] = apptRes?.data?.data || [];

  // Tách upcoming / past
  const now = new Date();
  const upcoming = appointments.filter(a => a.status !== 'done' && a.status !== 'cancelled');
  const past = appointments.filter(a => a.status === 'done' || a.status === 'cancelled');

  // Mutation: tạo lịch hẹn
  const createMutation = useMutation({
    mutationFn: () => pipelineApi.createAppointment({
      customer_id: customerId,
      title: formData.title,
      description: formData.description || null,
      scheduled_at: new Date(formData.scheduled_at).toISOString(),
      status: 'pending',
      assigned_to: formData.assigned_to || null,
    }),
    onSuccess: () => {
      setShowForm(false);
      setFormData({ title: '', description: '', scheduled_at: '', assigned_to: '' });
      queryClient.invalidateQueries({ queryKey: ['appointments', customerId] });
      toast.success('Đã tạo lịch hẹn');
    },
    onError: (error: any) => {
      toast.error('Không thể tạo lịch hẹn', error?.response?.data?.message || 'Vui lòng thử lại');
    },
  });

  // Mutation: cập nhật trạng thái
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'done' | 'cancelled' }) =>
      pipelineApi.updateAppointmentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', customerId] });
      toast.success('Đã cập nhật trạng thái');
    },
  });

  // Helper render badge
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

  // Helper render một appointment card
  const AppointmentCard = ({ appt }: { appt: CustomerActivity }) => (
    <div className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-slate-800">{appt.title}</p>
          {appt.scheduled_at && (
            <div className="flex items-center gap-1.5 mt-1 text-[12px] text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(appt.scheduled_at)}</span>
            </div>
          )}
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
      {/* Header + nút tạo */}
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

      {/* Form tạo lịch hẹn */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <h4 className="text-[13px] font-bold text-slate-700">Tạo lịch hẹn mới</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-[12px] font-medium text-slate-600">Tiêu đề *</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                placeholder="Ví dụ: Tư vấn sản phẩm lần 2..."
                className="w-full h-8 px-3 text-[13px] border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-slate-600">Ngày giờ hẹn *</label>
              <input
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={e => setFormData(p => ({ ...p, scheduled_at: e.target.value }))}
                className="w-full h-8 px-3 text-[13px] border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-slate-600">Người phụ trách</label>
              <select
                value={formData.assigned_to}
                onChange={e => setFormData(p => ({ ...p, assigned_to: e.target.value }))}
                className="w-full h-8 px-3 text-[13px] border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-indigo-500"
              >
                <option value="">-- Chọn nhân viên --</option>
                {profiles.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[12px] font-medium text-slate-600">Ghi chú</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                rows={2}
                placeholder="Nội dung trao đổi, mục tiêu buổi hẹn..."
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-indigo-500 resize-none"
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
              disabled={!formData.title || !formData.scheduled_at || createMutation.isPending}
              className="h-8 px-4 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {createMutation.isPending ? 'Đang lưu...' : 'Tạo lịch hẹn'}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && appointments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-slate-200 rounded-xl">
          <Calendar className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-[14px] font-bold text-slate-500">Chưa có lịch hẹn nào</p>
          <p className="text-[12px] text-slate-400 mt-1">Nhấn "Thêm lịch hẹn" để tạo lịch hẹn đầu tiên</p>
        </div>
      )}

      {/* Upcoming appointments */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sắp diễn ra ({upcoming.length})</p>
          {upcoming.map(appt => <AppointmentCard key={appt.id} appt={appt} />)}
        </div>
      )}

      {/* Past appointments */}
      {past.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-4">Đã qua ({past.length})</p>
          {past.map(appt => <AppointmentCard key={appt.id} appt={appt} />)}
        </div>
      )}
    </div>
  );
}
```

**Lưu ý imports**: Kiểm tra `Calendar`, `Clock`, `User` đã được import ở đầu file chưa (đã có từ trước). Thêm bất kỳ icon nào còn thiếu.

**QA sau task này:**
```bash
cd D:\job-baogia\client && npx tsc --noEmit
# Expected: 0 errors

# Manual UI:
# 1. Mở trang chi tiết 1 KH
# 2. Click tab "Lịch hẹn" — thấy empty state đúng
# 3. Click "Thêm lịch hẹn" — form hiện ra
# 4. Điền tiêu đề + ngày giờ → Submit → lịch hẹn xuất hiện trong danh sách
# 5. Click "Xong" → badge chuyển "Đã xong"
# 6. Click "Hủy" → badge chuyển "Đã hủy"
# 7. Mở tab "Trao đổi" — ghi note bình thường, KHÔNG bị ảnh hưởng
```

---

## Phase 5: Frontend — "Lần chăm sóc cuối"

### Task 5.1 — Thêm `last_activity_at` vào type `Customer`

**File**: `D:\job-baogia\client\src\types\index.ts`

**Tìm `Customer` interface** (khoảng line 21), thêm:
```typescript
last_activity_at?: string | null;   // NEW — from listCustomers + getCustomerStats
```

**QA:**
```bash
cd D:\job-baogia\client && npx tsc --noEmit
```

### Task 5.2 — Thêm cột "Lần chăm sóc cuối" vào bảng danh sách KH

**File**: `D:\job-baogia\client\src\pages\admin\CustomersPage.tsx`

**Vị trí**: Trong `<thead>` của bảng danh sách (khoảng line 175–185).

**Thêm cột header** sau cột "Người phụ trách":
```tsx
<th className="text-left py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
  Chăm sóc cuối
</th>
```

**Thêm cột data** tương ứng trong `<tbody>` sau `<td>` của assigned_profile:
```tsx
<td className="py-4 px-4 text-[12px] text-slate-400 tabular-nums">
  {customer.last_activity_at ? formatDate(customer.last_activity_at) : '—'}
</td>
```

**Đảm bảo `formatDate` đã được import** (đã có trong file này).

**QA sau task này:**
- Mở trang quản lý KH → thấy cột "Chăm sóc cuối"
- KH có activity → hiển thị ngày
- KH không có activity → hiển thị "—"

### Task 5.3 — Thêm "Lần chăm sóc cuối" vào sidebar CustomerDetailPage

**File**: `D:\job-baogia\client\src\pages\admin\CustomerDetailPage.tsx`

**Vị trí**: Trong block "Metadata" (khoảng line 403–421 — block `bg-slate-50` với "Nguồn", "Ngày tạo", "Đã mua", "Lần cuối mua").

**Thêm vào cuối block `bg-slate-50`**:
```tsx
<div className="flex justify-between text-[11px]">
  <span className="text-slate-500">Chăm sóc cuối</span>
  <span className="font-medium text-slate-700">
    {stats?.last_activity_at ? formatDate(stats.last_activity_at) : '—'}
  </span>
</div>
```

**Lưu ý**: `stats` đã có trong component từ `statsRes?.data?.data`. Kiểm tra tên biến thực tế trong file.

**QA sau task này:**
- Mở trang chi tiết KH có activity → sidebar hiển thị ngày chăm sóc cuối
- KH không có activity → hiển thị "—"

---

## Final Verification Wave

**Yêu cầu user confirm "okay" trước khi đánh dấu hoàn thành.**

### Checklist cuối cùng:

**Backend:**
- [ ] `npx tsc --noEmit` trong `backend/` → 0 errors
- [ ] `npm run build` trong `backend/` → success
- [ ] Migration 012 đã chạy thành công trên DB
- [ ] `GET /api/customers` → mỗi customer có `last_activity_at`
- [ ] `GET /api/customers/:id/stats` → có `last_activity_at`
- [ ] `GET /api/pipeline/activities/:id?type=meeting` → chỉ trả meeting
- [ ] `GET /api/pipeline/activities/:id` (không filter) → trả tất cả (backward compat)
- [ ] `POST /api/pipeline/activities` với `trao_doi` type → `scheduled_at=null`, `status=null` ✓
- [ ] `PATCH /api/pipeline/activities/:id/status` → cập nhật đúng

**Frontend:**
- [ ] `npx tsc --noEmit` trong `client/` → 0 errors
- [ ] `npm run build` trong `client/` → 0 errors
- [ ] Form "Thêm KH" hiển thị 3 field mới (customer_group, facebook, skype)
- [ ] Form "Sửa KH" pre-fill đúng 3 field mới
- [ ] Tab "Lịch hẹn" không còn là placeholder
- [ ] Tạo lịch hẹn → xuất hiện trong danh sách
- [ ] Đổi trạng thái lịch hẹn → cập nhật đúng
- [ ] Tab "Trao đổi" vẫn hoạt động bình thường (regression)
- [ ] Danh sách KH có cột "Chăm sóc cuối"
- [ ] Sidebar KH detail có "Chăm sóc cuối"
- [ ] KH không có activity → "—" (không crash)
