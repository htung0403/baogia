import { Router } from 'express';
import {
  listCustomers,
  getCustomer,
  getCustomerStats,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  restoreCustomer,
} from '../controllers/customer.controller.js';
import { getCustomerPayments } from '../controllers/payment.controller.js';
import { getCustomerFinancialSummary } from '../controllers/financial.controller.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';

const router = Router();

// All routes require admin/staff
router.use(authenticate, requireAdminOrStaff);

router.get('/', listCustomers);
router.get('/:id/stats', getCustomerStats);
router.get('/:id/payments', getCustomerPayments);
router.get('/:id/financial-summary', getCustomerFinancialSummary);
router.get('/:id', getCustomer);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);
router.post('/:id/restore', restoreCustomer);

export default router;
