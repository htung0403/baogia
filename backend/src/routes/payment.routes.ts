import { Router } from 'express';
import {
  recordPayment,
  listPayments,
} from '../controllers/payment.controller.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';

const router = Router();

router.use(authenticate, requireAdminOrStaff);

router.post('/',  recordPayment);
router.get('/',   listPayments);

export default router;
