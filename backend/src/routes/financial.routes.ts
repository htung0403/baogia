import { Router } from 'express';
import {
  getRevenueAnalytics,
  getTopCustomers,
  getFinancialKPIs,
} from '../controllers/financial.controller.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';

const router = Router();

router.use(authenticate, requireAdminOrStaff);

router.get('/revenue',        getRevenueAnalytics);
router.get('/top-customers',  getTopCustomers);
router.get('/kpis',           getFinancialKPIs);

export default router;
