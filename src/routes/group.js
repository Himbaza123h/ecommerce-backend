import express from 'express';
import { uploadSingle } from "../middleware/multer.js";
import { adminAuth } from "../middleware/adminMiddleware.js";
import {
  createGroup,
  getAllGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  approveGroup,
  rejectGroup,
  joinGroup,
  approveUserJoin,
  rejectUserJoin,
  getGroupJoinRequests,
  getMyGroups,
  getPendingGroups,
  getGroupsByService
} from '../controllers/groupController.js';

import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getAllGroups);
router.get('/service/:serviceId', getGroupsByService);

// Protected routes (require authentication)
router.use(protect);

// User routes - specific routes before parameterized ones
router.get('/my-groups', getMyGroups);
router.post('/', uploadSingle("group_icon"), createGroup);
router.post('/:id/join', joinGroup);

// Group admin routes
router.put('/:id/approve/:userId', approveUserJoin);
router.put('/:id/reject/:userId', rejectUserJoin);
router.get('/:id/requests', getGroupJoinRequests);
router.put('/:id', uploadSingle("group_icon"), updateGroup);
router.delete('/:id', deleteGroup);

// System admin only routes
router.get('/pending', adminAuth, getPendingGroups);
router.put('/:id/approve', adminAuth, approveGroup);
router.put('/:id/reject', adminAuth, rejectGroup);

// Public parameterized routes (after protected routes to avoid conflicts)
router.get('/:id', getGroup);

export default router;