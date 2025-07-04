import express from 'express';
import { uploadBlogFiles } from "../middleware/multer.js";
import { adminAuth } from "../middleware/adminMiddleware.js";
import {
  createBlog,
  getAllBlogs,
  getBlog,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
  activateBlog,
  deactivateBlog,
  likeBlog,
  getBlogStats,
  removeFromGallery
} from '../controllers/blogController.js';

import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getAllBlogs);
router.get('/slug/:slug', getBlogBySlug);
router.get('/:id', getBlog);
router.put('/:id/like', likeBlog);

// Protected routes (require authentication)
router.use(protect);

// Admin only routes
router.post('/', adminAuth, uploadBlogFiles([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), createBlog);

router.put('/:id', adminAuth, uploadBlogFiles([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), updateBlog);

router.delete('/:id', adminAuth, deleteBlog);
router.put('/:id/activate', adminAuth, activateBlog);
router.put('/:id/deactivate', adminAuth, deactivateBlog);
router.get('/:id/stats', adminAuth, getBlogStats);
router.delete('/:id/gallery/:imageIndex', adminAuth, removeFromGallery);

export default router;