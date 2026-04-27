import { Router } from 'express';
import {
  listPriceLists,
  getPriceList,
  createPriceList,
  updatePriceList,
  deletePriceList,
  createVersion,
  getVersion,
  updateVersion,
  deleteVersion,
  publishVersion,
  assignCustomers,
  unassignCustomer,
} from '../controllers/pricelist.controller.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Read routes (customer can see assigned lists)
router.get('/', listPriceLists);
router.get('/:id', getPriceList);
router.get('/:id/versions/:versionId', getVersion);

// Write routes (admin/staff only)
router.post('/', requireAdminOrStaff, createPriceList);
router.put('/:id', requireAdminOrStaff, updatePriceList);
router.delete('/:id', requireAdminOrStaff, deletePriceList);

// Version management (admin/staff only)
router.post('/:id/versions', requireAdminOrStaff, createVersion);
router.put('/:id/versions/:versionId', requireAdminOrStaff, updateVersion);
router.delete('/:id/versions/:versionId', requireAdminOrStaff, deleteVersion);
router.post('/:id/versions/:versionId/publish', requireAdminOrStaff, publishVersion);

// Customer assignment (admin/staff only)
router.post('/:id/customers', requireAdminOrStaff, assignCustomers);
router.delete('/:id/customers/:customerId', requireAdminOrStaff, unassignCustomer);

export default router;
