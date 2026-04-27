import { Router } from 'express';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';
import {
  listCareSettings,
  getCareSettingByGroup,
  createCareSetting,
  updateCareSetting,
  deleteCareSetting,
  generateCareEvents,
  listCareEvents,
  updateCareEvent,
} from '../controllers/care-schedule.controller.js';

const router = Router();

// Settings CRUD
router.get('/settings', authenticate, requireAdminOrStaff, listCareSettings);
router.get('/settings/group/:groupId', authenticate, requireAdminOrStaff, getCareSettingByGroup);
router.post('/settings', authenticate, requireAdminOrStaff, createCareSetting);
router.put('/settings/:id', authenticate, requireAdminOrStaff, updateCareSetting);
router.delete('/settings/:id', authenticate, requireAdminOrStaff, deleteCareSetting);

// Event generation
router.post('/events/generate', authenticate, requireAdminOrStaff, generateCareEvents);

// Events query + actions
router.get('/events', authenticate, requireAdminOrStaff, listCareEvents);
router.patch('/events/:id', authenticate, requireAdminOrStaff, updateCareEvent);

export default router;
