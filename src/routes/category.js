import express from 'express';
import { uploadSingle } from '../middleware/multer.js';
import { adminAuth } from '../middleware/adminMiddleware.js';
import {
  createCategory,
  getAllCategories,
  getActiveCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  getCategoryStats
} from '../controllers/categoryController.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/active', getActiveCategories);
router.get('/slug/:slug', getCategoryBySlug);
router.get('/:id', getCategoryById);
router.get('/', getAllCategories);

// Admin-only protected routes
// Get category statistics (admin only)
router.get('/stats', adminAuth, getCategoryStats);

// Create category with optional logo upload (admin only)
router.post('/', adminAuth, uploadSingle('logo'), createCategory);

// Update category with optional logo upload (admin only)
router.put('/:id', adminAuth, uploadSingle('logo'), updateCategory);

// Toggle category active status (admin only)
router.patch('/:id/toggle-status', adminAuth, toggleCategoryStatus);

// Delete category (admin only)
router.delete('/:id', adminAuth, deleteCategory);

export default router;