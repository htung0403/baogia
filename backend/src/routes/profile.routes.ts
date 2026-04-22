import { Router } from 'express';
import { listProfiles } from '../controllers/profile.controller.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';

const router = Router();
router.use(authenticate, requireAdminOrStaff);
router.get('/', listProfiles);
export default router;
