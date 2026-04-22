import { Router } from 'express';
import { listProfiles, updateProfile } from '../controllers/profile.controller.js';
import { authenticate, requireAdminOrStaff, requireAdmin } from '../middleware/index.js';

const router = Router();
router.use(authenticate, requireAdminOrStaff);
router.get('/', listProfiles);
router.put('/:id', requireAdmin, updateProfile);
export default router;
