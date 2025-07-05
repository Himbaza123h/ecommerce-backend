import express from 'express';
import { 
  register, 
  login, 
  logout, 
  getMe, 
  updateProfile,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  reactivateUser
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { adminAuth } from '../middleware/adminMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/users', adminAuth, getAllUsers);
router.get('/users/:id', adminAuth, getUserById)
router.put('/users/:id', adminAuth, updateUser);
router.delete('/users/:id', adminAuth, deleteUser);
router.patch('/users/:id/reactivate', adminAuth, reactivateUser);

export default router;