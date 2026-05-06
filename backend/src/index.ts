import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import customerRoutes from './routes/customer.routes.js';
import priceListRoutes from './routes/pricelist.routes.js';
import trackingRoutes from './routes/tracking.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import orderRoutes from './routes/order.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import financialRoutes from './routes/financial.routes.js';
import profileRoutes from './routes/profile.routes.js';
import pipelineRoutes from './routes/pipeline.routes.js';
import customerGroupRoutes from './routes/customer-groups.routes.js';
import careScheduleRoutes from './routes/care-schedule.routes.js';
import brandRoutes from './routes/brand.routes.js';
import productGroupRoutes from './routes/product-group.routes.js';
import { errorHandler, notFoundHandler } from './middleware/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// GLOBAL MIDDLEWARE
// ============================================================

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Gzip/brotli compression
app.use(compression());

// Cache headers cho GET API (skip for customers/pipeline to avoid stale data after creation)
app.use('/api/', (req, res, next) => {
  if (req.method === 'GET' && !req.url.includes('/customers') && !req.url.includes('/pipeline')) {
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=59');
  } else if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Tăng lên 1000 để tránh lỗi khi dev/refresh nhiều
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Trust proxy (for correct IP in rate limiter & tracking)
app.set('trust proxy', 1);

// ============================================================
// ROUTES
// ============================================================

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/price-lists', priceListRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', financialRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/customer-groups', customerGroupRoutes);
app.use('/api/care-schedule', careScheduleRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/product-groups', productGroupRoutes);

// ============================================================
// ERROR HANDLING
// ============================================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   CRM Quotation API Server              ║
║   Port: ${String(PORT).padEnd(33)}║
║   Env:  ${String(process.env.NODE_ENV || 'development').padEnd(33)}║
╚══════════════════════════════════════════╝
  `);
});

export default app;
