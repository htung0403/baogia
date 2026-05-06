import { Router } from 'express';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  listProductGroupPrices,
  updateProductGroupPrices,
} from '../controllers/product.controller.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Read routes (customer can also view active products)
router.get('/', listProducts);
router.get('/:id', getProduct);

// Write routes (admin/staff only)
router.post('/', requireAdminOrStaff, createProduct);
router.put('/:id', requireAdminOrStaff, updateProduct);
router.delete('/:id', requireAdminOrStaff, deleteProduct);
router.post('/:id/restore', requireAdminOrStaff, restoreProduct);
router.get('/:id/group-prices', listProductGroupPrices);
router.put('/:id/group-prices', requireAdminOrStaff, updateProductGroupPrices);

export default router;
