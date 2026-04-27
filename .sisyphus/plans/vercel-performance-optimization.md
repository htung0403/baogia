# Plan: Vercel Performance Optimization — CRM Bao Gia

## Context & Motivation

Dự án CRM Bao Gia gồm 2 Vercel projects riêng biệt tại **sin1 (Singapore)**:
- **Frontend**: Vite + React 18 SPA, Tailwind CSS, deployed as static site
- **Backend**: Express.js + TypeScript, deployed as Vercel Serverless Function
- **Database**: Supabase (Tokyo/Seoul region, ~50-80ms latency từ sin1)

### Current Problems Identified
1. **First Load rất chậm**: Bundle monolithic — 15+ pages + recharts + tiptap + radix-ui + lucide-react tất cả load cùng lúc
2. **Cold start backend**: 11 route modules eagerly imported, không compression
3. **API response chậm**: Không có caching headers, không compression, Supabase ở Tokyo (~50-80ms/query)
4. **Vercel config bare**: Không có caching headers cho static assets, không có preconnect hints

### Key Metrics to Track
- **LCP** (Largest Contentful Paint): Target < 2.5s
- **FCP** (First Contentful Paint): Target < 1.8s
- **TTI** (Time to Interactive): Target < 3.5s
- **TTFB** (Time to First Byte): Target < 800ms for API calls
- **Bundle Size**: Target initial chunk < 200KB gzipped (currently estimated 500KB+)

## Architecture Constraints
- Frontend và Backend là **2 Vercel projects riêng** — không thể dùng Vercel monorepo features
- Supabase ở Tokyo, không di chuyển được → phải optimize ở application layer
- SPA architecture (không phải SSR/Next.js) → không có server-side rendering

## Dependencies
- `compression` package (backend) — cần install
- Không cần thêm dependencies cho frontend (chỉ refactor code)

## Execution Order
Phases phải thực hiện **tuần tự** (Phase 1 → 2 → 3 → 4 → 5) vì mỗi phase build trên phase trước.

---

## Phase 1: Quick Wins — Font & HTML Optimization
> **Impact**: High | **Risk**: Low | **Effort**: ~15 min
> Fixes render-blocking font load and missing browser hints.

<!-- TASKS_START_PHASE_1 -->

### Task 1.1: Replace render-blocking Google Fonts @import with preconnect + link
**File**: `client/index.html`
**File**: `client/src/index.css`

**Problem**: Dòng 1 trong `index.css` dùng `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap')` — đây là **render-blocking request** nằm sâu trong CSS, browser phải download CSS → parse → phát hiện @import → download font CSS → download font files. Chuỗi 3 bước nối tiếp.

**Changes**:

1. **Xóa** dòng 1 trong `client/src/index.css`:
   ```css
   /* XÓA dòng này: */
   @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
   ```

2. **Thêm** vào `client/index.html` trong `<head>`, **trước** thẻ `<title>`:
   ```html
   <!-- Preconnect to Google Fonts (eliminates DNS+TLS round trips) -->
   <link rel="preconnect" href="https://fonts.googleapis.com" />
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
   <!-- Load font CSS non-render-blocking with display=swap -->
   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
   ```

**Why this works**: 
- `preconnect` loại bỏ DNS lookup + TLS handshake (~100-200ms) cho font domains
- `<link rel="stylesheet">` trong HTML được browser phát hiện sớm hơn `@import` trong CSS
- `display=swap` đảm bảo text hiển thị ngay bằng fallback font, không chờ font load

**QA**: 
- Verify: Mở DevTools Network, filter "fonts" — font requests phải bắt đầu song song với main CSS, không sequential
- Verify: Text hiển thị ngay khi page load (không flash trắng chờ font)
- Verify: Font Inter vẫn render đúng sau khi load xong

---

### Task 1.2: Add meta tags for performance
**File**: `client/index.html`

**Changes**: Thêm vào `<head>` sau các `<meta>` hiện có:
```html
<!-- DNS prefetch for API domain (production) -->
<link rel="dns-prefetch" href="https://fonts.googleapis.com" />
<link rel="dns-prefetch" href="https://fonts.gstatic.com" />
```

**Note**: Sau khi deploy, thêm `<link rel="preconnect">` cho API backend domain thực tế (ví dụ: `https://api.your-domain.vercel.app`). Không hardcode domain dev ở đây.

**QA**:
- Verify: `index.html` valid HTML (no unclosed tags)
- Verify: Build thành công `npm run build`

<!-- TASKS_END_PHASE_1 -->

---

## Phase 2: Frontend Bundle — Code Splitting & Chunking
> **Impact**: Critical | **Risk**: Medium | **Effort**: ~45 min
> Splits the monolithic bundle into lazy-loaded route chunks and vendor chunks.

<!-- TASKS_START_PHASE_2 -->

### Task 2.1: Convert all page imports to React.lazy() with Suspense
**File**: `client/src/App.tsx`

**Problem**: Hiện tại App.tsx import 15+ page components bằng static import (dòng 12-33). Toàn bộ code của mọi page được bundle vào 1 chunk duy nhất — user truy cập `/login` cũng phải download code của `/admin/financial` (chứa recharts ~200KB).

**Changes**:

1. **Thêm import `lazy, Suspense`** từ React (dòng 1 area):
   ```tsx
   import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
   import { lazy, Suspense, useEffect } from 'react';
   import { useAuthStore } from '@/store/auth.store';
   import { ToastProvider } from '@/components/ui/toast';
   ```

2. **Giữ nguyên static imports** cho layout và auth (cần ngay lập tức):
   ```tsx
   // Layouts — KEEP static imports (needed immediately)
   import AdminLayout from '@/components/layout/AdminLayout';
   import PortalLayout from '@/components/layout/PortalLayout';
   import ProtectedRoute from '@/components/shared/ProtectedRoute';
   ```

3. **Thay TẤT CẢ page imports** bằng React.lazy (thay thế dòng 12-33):
   ```tsx
   // Auth pages — lazy loaded
   const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));

   // Admin pages — lazy loaded
   const AdminDashboard = lazy(() => import('@/pages/admin/DashboardPage'));
   const ProductsPage = lazy(() => import('@/pages/admin/ProductsPage'));
   const PriceListsPage = lazy(() => import('@/pages/admin/PriceListsPage'));
   const PriceListDetailPage = lazy(() => import('@/pages/admin/PriceListDetailPage'));
   const CustomersPage = lazy(() => import('@/pages/admin/CustomersPage'));
   const CustomerDetailPage = lazy(() => import('@/pages/admin/CustomerDetailPage'));
   const AnalyticsPage = lazy(() => import('@/pages/admin/AnalyticsPage'));
   const OrdersPage = lazy(() => import('@/pages/admin/OrdersPage'));
   const PaymentsPage = lazy(() => import('@/pages/admin/PaymentsPage'));
   const FinancialDashboardPage = lazy(() => import('@/pages/admin/FinancialDashboardPage'));
   const EmployeesPage = lazy(() => import('@/pages/admin/EmployeesPage'));

   // Portal pages — lazy loaded
   const PortalDashboard = lazy(() => import('@/pages/portal/PortalDashboard'));
   const PortalPriceListsPage = lazy(() => import('@/pages/portal/PortalPriceListsPage'));
   const PortalPriceListView = lazy(() => import('@/pages/portal/PortalPriceListView'));
   const PortalHistoryPage = lazy(() => import('@/pages/portal/PortalHistoryPage'));
   ```

4. **Tạo Loading Spinner component** inline và wrap `<Routes>` bằng `<Suspense>`. Trong function `AppRoutes`, wrap toàn bộ `<Routes>` block:
   ```tsx
   // Loading fallback for lazy routes
   const PageLoader = () => (
     <div className="min-h-screen flex items-center justify-center">
       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
     </div>
   );
   ```
   
   Trong `AppRoutes` component, thay `return (<Routes>...)` thành:
   ```tsx
   return (
     <Suspense fallback={<PageLoader />}>
       <Routes>
         {/* ... all existing routes unchanged ... */}
       </Routes>
     </Suspense>
   );
   ```

**CRITICAL**: Mỗi page component PHẢI có `export default`. Kiểm tra tất cả page files — nếu file nào dùng named export thì `React.lazy()` sẽ fail. Tất cả pages hiện đã dùng `export default` (đã confirm qua exploration).

**QA**:
- Verify: `npm run build` thành công — output phải show **multiple chunks** (không còn 1 chunk lớn)
- Verify: DevTools Network — navigate `/admin` chỉ load admin chunk, navigate `/portal` load portal chunk riêng
- Verify: Refresh trên mỗi route — page vẫn render đúng (SPA fallback hoạt động)
- Verify: Loading spinner hiển thị ngắn khi chuyển route (chứng tỏ lazy loading hoạt động)

---

### Task 2.2: Configure Vite manualChunks for vendor splitting
**File**: `client/vite.config.ts`

**Problem**: Không có `build.rollupOptions` — Vite tự split nhưng không tối ưu. Các heavy vendor libs (recharts, tiptap, radix) cần tách thành chunks riêng để:
- Browser cache vendor chunks dài hạn (chúng ít thay đổi)
- Giảm main chunk size
- Parallel download nhiều chunks nhỏ nhanh hơn 1 chunk lớn

**Changes**: Thêm `build` config vào `defineConfig`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Target modern browsers for smaller output
    target: 'es2020',
    // Enable source maps for debugging (optional, remove in production if not needed)
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — shared by ALL pages, cached long-term
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Charts — only loaded by FinancialDashboardPage & AnalyticsPage
          'vendor-charts': ['recharts'],
          // Rich text editor — only loaded by pages using TiptapEditor
          'vendor-tiptap': [
            '@tiptap/react',
            '@tiptap/starter-kit',
            '@tiptap/extension-underline',
            '@tiptap/extension-text-align',
            '@tiptap/extension-link',
            '@tiptap/extension-image',
          ],
          // UI primitives — shared across many components
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          // Data fetching — used on every page
          'vendor-query': ['@tanstack/react-query', 'axios'],
          // State management
          'vendor-state': ['zustand'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
```

**Why this structure**:
- `vendor-react`: ~140KB — cached forever, changes only on React upgrade
- `vendor-charts`: ~200KB — loaded ONLY when user visits financial pages (combined with React.lazy from Task 2.1)
- `vendor-tiptap`: ~150KB — loaded ONLY when rich text editor is used
- `vendor-radix`: ~80KB — loaded early since used in layouts, but cached separately
- `vendor-query` + `vendor-state`: ~30KB — small, loaded early, cached long-term

**QA**:
- Verify: `npm run build` — output phải list 6+ separate chunk files (vendor-react, vendor-charts, vendor-tiptap, etc.)
- Verify: Không có error "circular dependency" hoặc "missing export"
- Verify: Tổng size của main app chunk (không kể vendors) < 100KB gzipped
- Verify: `npx vite-bundle-visualizer` — xem treemap, verify recharts/tiptap ở chunks riêng

---

### Task 2.3: Lazy-load TiptapEditor component
**File**: Mỗi file import `TiptapEditor` cần thay đổi

**Problem**: TiptapEditor import 6 tiptap packages (~150KB). Nó chỉ cần khi user thực sự edit rich text, nhưng hiện tại được import static.

**Changes**:

1. **Tìm tất cả files import TiptapEditor** — search pattern: `import TiptapEditor from` hoặc `import { TiptapEditor }` trong `client/src/`

2. **Thay mỗi import** bằng lazy version:
   ```tsx
   // TRƯỚC:
   import TiptapEditor from '@/components/ui/TiptapEditor';

   // SAU:
   import { lazy, Suspense } from 'react';
   const TiptapEditor = lazy(() => import('@/components/ui/TiptapEditor'));
   ```

3. **Wrap mỗi `<TiptapEditor ... />` usage** bằng Suspense:
   ```tsx
   <Suspense fallback={<div className="h-48 rounded-md border border-input bg-muted animate-pulse" />}>
     <TiptapEditor {...existingProps} />
   </Suspense>
   ```
   Fallback là skeleton placeholder cùng kích thước với editor để tránh layout shift.

**QA**:
- Verify: Navigate to page có TiptapEditor — editor loads sau một instant, skeleton hiển thị trước
- Verify: Editor hoạt động bình thường (bold, italic, link, image, alignment)
- Verify: Network tab — tiptap vendor chunk chỉ load khi navigate đến page có editor

<!-- TASKS_END_PHASE_2 -->

---

## Phase 3: Backend Performance — Compression & Caching
> **Impact**: High | **Risk**: Low | **Effort**: ~30 min
> Adds compression, response caching, and cold start optimization.

<!-- TASKS_START_PHASE_3 -->

### Task 3.1: Add compression middleware to backend
**File**: `backend/package.json` (install dependency)
**File**: `backend/src/index.ts`

**Problem**: Mọi API response (JSON) đều gửi raw, không nén. Một response danh sách products có thể 50-100KB raw JSON. Với gzip/brotli, giảm còn ~15-30KB (tiết kiệm 60-70%).

**Changes**:

1. **Install compression package**:
   ```bash
   cd backend && npm install compression && npm install -D @types/compression
   ```

2. **Thêm import** vào `backend/src/index.ts` (cùng khu vực import, sau `import helmet`):
   ```typescript
   import compression from 'compression';
   ```

3. **Thêm middleware** trong `backend/src/index.ts` — đặt **SAU** `helmet()` và **TRƯỚC** `cors()` (dòng ~29-31 hiện tại). Compression phải chạy sớm để nén tất cả responses:
   ```typescript
   // Security headers
   app.use(helmet());

   // Compress all responses (gzip/deflate)
   app.use(compression({
     level: 6,           // Balance between speed and compression ratio
     threshold: 1024,    // Only compress responses > 1KB
     filter: (req, res) => {
       // Don't compress if client doesn't support it
       if (req.headers['x-no-compression']) return false;
       return compression.filter(req, res);
     },
   }));

   // CORS
   app.use(cors({
   ```

**Note về Vercel**: Vercel's Edge Network tự động nén static assets, nhưng **KHÔNG** tự nén serverless function responses. Nên compression middleware là **bắt buộc** cho backend serverless.

**QA**:
- Verify: `cd backend && npm run build` thành công
- Verify: Hit `/api/health` với `curl -H "Accept-Encoding: gzip" -I` — response phải có header `Content-Encoding: gzip`
- Verify: Hit `/api/products` — response body size giảm 60%+ so với trước
- Verify: Response vẫn parse được bình thường từ frontend (axios tự xử lý decompression)

---

### Task 3.2: Add Cache-Control headers cho GET endpoints
**File**: `backend/src/index.ts` (global middleware approach)

**Problem**: Không có cache headers → browser/CDN re-fetch mọi request, kể cả data ít thay đổi (danh sách products, price lists). Supabase ở Tokyo (~50-80ms/query), mỗi uncached request = 50-80ms DB + network overhead.

**Changes**: Tạo một caching middleware và apply cho tất cả GET routes. Thêm **TRƯỚC** route mounting (trước dòng `app.use('/api/auth', ...)`):

```typescript
// Cache-Control middleware for GET requests
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') {
    // Default: private cache for 60 seconds, allow stale while revalidating
    // Individual routes can override this by calling res.set('Cache-Control', ...) before send
    res.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
  }
  next();
});
```

**Sau đó**, override cụ thể cho routes cần cache khác nhau — thêm từng middleware vào route files:

1. **`backend/src/routes/product.routes.ts`** — Products ít thay đổi, cache lâu hơn:
   Thêm trước các route handlers:
   ```typescript
   // Products change infrequently — cache 5 minutes
   router.use((req, res, next) => {
     if (req.method === 'GET') {
       res.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');
     }
     next();
   });
   ```

2. **`backend/src/routes/auth.routes.ts`** — Auth KHÔNG cache:
   Thêm trước các route handlers:
   ```typescript
   // Auth responses must never be cached
   router.use((_req, res, next) => {
     res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
     next();
   });
   ```

3. **`backend/src/routes/financial.routes.ts`** — Analytics data cache ngắn:
   ```typescript
   // Financial data — cache 2 minutes
   router.use((req, res, next) => {
     if (req.method === 'GET') {
       res.set('Cache-Control', 'private, max-age=120, stale-while-revalidate=300');
     }
     next();
   });
   ```

**Cache strategy rationale**:
| Route | max-age | Reason |
|-------|---------|--------|
| `/api/auth/*` | no-store | Sensitive auth data |
| `/api/products/*` | 5 min | Products rarely change mid-session |
| `/api/customers/*` | 60s (default) | Moderate change frequency |
| `/api/price-lists/*` | 60s (default) | Can be edited, moderate cache |
| `/api/analytics/*` | 2 min | Aggregated data, slightly stale OK |
| `/api/orders/*` | 60s (default) | Active data, short cache |
| `/api/upload/*` | no cache (POST only) | Uploads are mutations |
| `/api/health` | no cache | Real-time status |

**QA**:
- Verify: `curl -I /api/products` → `Cache-Control: private, max-age=300, stale-while-revalidate=600`
- Verify: `curl -I /api/auth/me` → `Cache-Control: no-store, no-cache, must-revalidate`
- Verify: Refresh product list in browser — Network tab shows `(disk cache)` or `304` on second load within 5 min
- Verify: Sau khi tạo product mới, list vẫn refresh đúng (vì TanStack Query invalidates on mutation)

---

### Task 3.3: Optimize backend cold start
**File**: `backend/src/index.ts`
**File**: `backend/vercel.json`

**Problem**: Vercel Serverless Function cold start bao gồm: download code → start Node.js → import all modules → ready. 11 route modules + tất cả controllers/middlewares loaded ngay lập tức. Với Supabase SDK + Express + Helmet + CORS, cold start có thể 3-5s.

**Changes**:

1. **Giảm body parser limit** trong `backend/src/index.ts` — hiện set 10mb (quá lớn cho hầu hết API calls, tăng memory footprint):
   ```typescript
   // TRƯỚC:
   app.use(express.json({ limit: '10mb' }));
   app.use(express.urlencoded({ extended: true, limit: '10mb' }));

   // SAU:
   app.use(express.json({ limit: '2mb' }));
   app.use(express.urlencoded({ extended: true, limit: '2mb' }));
   ```
   **Rationale**: Upload route dùng Multer riêng, không qua JSON body parser. 2MB đủ cho mọi JSON payload thông thường.

2. **Thêm `maxDuration` vào `backend/vercel.json`** để Vercel giữ function warm lâu hơn:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "src/index.ts",
         "use": "@vercel/node",
         "config": {
           "runtime": "nodejs20.x",
           "helpers": true,
           "maxDuration": 30
         }
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "src/index.ts"
       }
     ]
   }
   ```

3. **Disable Morgan logging in production** (saves ~2-5ms per request + reduces memory):
   Trong `backend/src/index.ts`, tìm dòng `app.use(morgan(...))` và wrap:
   ```typescript
   // Only log in development (production: Vercel has its own logging)
   if (process.env.NODE_ENV !== 'production') {
     app.use(morgan('dev'));
   }
   ```

**QA**:
- Verify: `npm run build` thành công
- Verify: Deploy lên Vercel, chờ 10 phút idle, hit `/api/health` — response nhanh hơn trước
- Verify: Upload ảnh vẫn hoạt động (Multer không bị ảnh hưởng bởi body parser limit)
- Verify: Vercel logs không còn morgan output trong production

<!-- TASKS_END_PHASE_3 -->

---

## Phase 4: Vercel Platform — Edge Caching & Headers
> **Impact**: High | **Risk**: Low | **Effort**: ~20 min
> Leverages Vercel's CDN and edge network for caching static assets and API responses.

<!-- TASKS_START_PHASE_4 -->
<!-- TASKS_END_PHASE_4 -->

---

## Phase 5: Application-Level Tuning
> **Impact**: Medium | **Risk**: Low | **Effort**: ~20 min
> Fine-tunes React Query caching, component memoization, and monitoring.

<!-- TASKS_START_PHASE_5 -->
<!-- TASKS_END_PHASE_5 -->

---

## Final Verification Wave

> ⚠️ **MUST get explicit user "okay" before marking work complete.**

### Verification Checklist
1. **Build Success**: `cd client && npm run build` completes without errors
2. **Bundle Analysis**: Run `npx vite-bundle-visualizer` — verify separate chunks for recharts, tiptap, radix
3. **Lighthouse Audit**: Run Lighthouse on deployed frontend — verify LCP < 2.5s, FCP < 1.8s
4. **API Response Check**: Verify `Content-Encoding: gzip` header on API responses
5. **Cache Headers Check**: Verify `Cache-Control` headers on static assets (should show `public, max-age=31536000, immutable` for hashed assets)
6. **Font Loading**: Verify no render-blocking font requests in Network waterfall
7. **Cold Start**: Deploy backend, wait 10 min idle, hit `/api/health` — verify response < 2s
8. **Code Splitting**: Navigate to `/admin/financial` — verify recharts chunk loads lazily in Network tab
9. **Regression**: All existing pages load correctly, no broken routes, no missing styles
10. **Compression**: Check API response sizes — JSON payloads should be 60-70% smaller with gzip

### How to Verify Post-Deploy
```bash
# 1. Check static asset caching
curl -I https://your-frontend.vercel.app/assets/index-abc123.js
# Expected: cache-control: public, max-age=31536000, immutable

# 2. Check API compression
curl -H "Accept-Encoding: gzip" -I https://your-backend.vercel.app/api/health
# Expected: content-encoding: gzip

# 3. Check font preconnect
# Open DevTools > Network > filter "fonts.googleapis" > verify connection reused

# 4. Bundle size check
cd client && npx vite-bundle-visualizer
# Verify: main chunk < 200KB, vendor chunks separated
```
