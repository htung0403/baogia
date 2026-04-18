import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../utils/supabase.js';
import { ApiError, sendSuccess } from '../utils/index.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';
import path from 'path';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/upload/image
 * Upload image to Supabase Storage
 */
router.post(
  '/image',
  authenticate,
  requireAdminOrStaff,
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw ApiError.badRequest('No image file provided');
      }

      const file = req.file;
      const fileExt = path.extname(file.originalname);
      const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}${fileExt}`;
      const filePath = `products/${fileName}`;

      // Upload to Supabase Storage
      // NOTE: Make sure 'product-images' bucket exists and is public
      const { data, error } = await supabaseAdmin.storage
        .from('product-images')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (error) {
        throw ApiError.internal(`Storage error: ${error.message}`);
      }

      // Get Public URL
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('product-images')
        .getPublicUrl(filePath);

      sendSuccess(res, { url: publicUrl, path: data.path }, 'Upload thành công');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
