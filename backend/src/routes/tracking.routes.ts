import { Router } from 'express';
import {
  startSession,
  endSession,
  trackItemView,
  getAnalyticsOverview,
  getCustomerActivity,
  getCustomerViewHistory,
  getMyViewHistory,
  getPriceListViewStats,
} from '../controllers/tracking.controller.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';

const router = Router();

// All routes require authentication
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
