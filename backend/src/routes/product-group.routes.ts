import { Router } from 'express';
import {
  listProductGroups,
  getProductGroup,
  createProductGroup,
  updateProductGroup,
  deleteProductGroup,
} from '../controllers/product-group.controller.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';

const router = Router();

router.use(authenticate, requireAdminOrStaff);

router.get('/', listProductGroups);
router.get('/:id', getProductGroup);
router.post('/', createProductGroup);
router.put('/:id', updateProductGroup);
router.delete('/:id', deleteProductGroup);

export default router;
