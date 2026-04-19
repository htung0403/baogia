import { Router } from 'express';
import {
  startSession,
  endSession,
  beaconEndSession,
  trackItemView,
  getAnalyticsOverview,
  getCustomerActivity,
  getCustomerViewHistory,
  getMyViewHistory,
  getPriceListViewStats,
} from '../controllers/tracking.controller.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';

const router = Router();

// Beacon endpoint — không cần auth (sendBeacon không hỗ trợ custom header)
// Chỉ kết thúc session theo sessionId, an toàn vì sessionId là UUID ngẫu nhiên
router.post('/sessions/:sessionId/beacon-end', beaconEndSession);

// All other routes require authentication
router.use(authenticate);

// Customer tracking endpoints
router.post('/sessions', startSession);
router.put('/sessions/:sessionId/end', endSession);
router.post('/sessions/:sessionId/items', trackItemView);

// Admin analytics endpoints
router.get('/analytics/me', getMyViewHistory);
router.get('/analytics/overview', requireAdminOrStaff, getAnalyticsOverview);
router.get('/analytics/customers', requireAdminOrStaff, getCustomerActivity);
router.get('/analytics/customers/:customerId', requireAdminOrStaff, getCustomerViewHistory);
router.get('/analytics/price-lists/:priceListId', requireAdminOrStaff, getPriceListViewStats);

export default router;
