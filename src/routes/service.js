import express from 'express';
import { uploadSingle } from "../middleware/multer.js";
import { adminAuth } from "../middleware/adminMiddleware.js";
import {
  createService,
  getAllServices,
  getService,
  updateService,
  deleteService,
  activateService,
  deactivateService,
  updateServiceStats,
  getServiceStats
} from '../controllers/serviceController.js';

import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getAllServices);
router.get('/:id', getService);

// Protected routes (require authentication)
router.use(protect);

// Admin only routes
router.post('/', adminAuth, uploadSingle("icon"), createService);
router.put('/:id', adminAuth, uploadSingle("icon"), updateService);
router.delete('/:id', adminAuth, deleteService);
router.put('/:id/activate', adminAuth, activateService);
router.put('/:id/deactivate', adminAuth, deactivateService);
router.put('/:id/update-stats', adminAuth, updateServiceStats);
router.get('/:id/stats', adminAuth, getServiceStats);

export default router;