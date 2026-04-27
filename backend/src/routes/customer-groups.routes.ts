import { Router } from 'express';
import {
  listCustomerGroups,
  getCustomerGroup,
  createCustomerGroup,
  updateCustomerGroup,
  deleteCustomerGroup,
} from '../controllers/customer-group.controller.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';

const router = Router();

router.use(authenticate, requireAdminOrStaff);

router.get('/', listCustomerGroups);
router.get('/:id', getCustomerGroup);
router.post('/', createCustomerGroup);
router.put('/:id', updateCustomerGroup);
router.delete('/:id', deleteCustomerGroup);

export default router;
