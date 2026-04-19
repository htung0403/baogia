import { Router } from 'express';
import {
  createOrder,
  listOrders,
  getOrder,
  updateOrder,
  confirmOrder,
  cancelOrder,
  deleteOrder,
} from '../controllers/order.controller.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';

const router = Router();

// All order routes require admin or staff
router.use(authenticate, requireAdminOrStaff);

router.post('/',                 createOrder);
router.get('/',                  listOrders);
router.get('/:id',               getOrder);
router.put('/:id',               updateOrder);
router.post('/:id/confirm',      confirmOrder);
router.post('/:id/cancel',       cancelOrder);
router.delete('/:id',            deleteOrder);

export default router;
