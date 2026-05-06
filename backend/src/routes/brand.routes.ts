import { Router } from 'express';
import {
  listBrands,
  getBrand,
  createBrand,
  updateBrand,
  deleteBrand,
} from '../controllers/brand.controller.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';

const router = Router();

router.use(authenticate, requireAdminOrStaff);

router.get('/', listBrands);
router.get('/:id', getBrand);
router.post('/', createBrand);
router.put('/:id', updateBrand);
router.delete('/:id', deleteBrand);

export default router;
