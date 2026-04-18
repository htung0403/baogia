import { Router } from 'express';
import { login, register, getMe, refreshToken, logout } from '../controllers/auth.controller.js';
import { authenticate, requireAdmin } from '../middleware/index.js';

const router = Router();

// Public routes
router.post('/login', login);
router.post('/refresh', refreshToken);

// Admin only: create new users
router.post('/register', authenticate, requireAdmin, register);

// Authenticated routes
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
