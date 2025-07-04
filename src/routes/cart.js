import express from "express";
import { protect } from '../middleware/auth.js';
import { adminAuth } from "../middleware/adminMiddleware.js";
import {
  getUserCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  submitCart,
  cancelCart,
  getUserCartHistory,
  getAllCarts,
  getPendingCarts,
  getApprovedCarts,
  getRejectedCarts,
  approveCart,
  rejectCart,
} from "../controllers/cartController.js";

import {
  validateAddToCart,
  validateUpdateCartItem,
  validateSubmitCart,
  validateCartId,
  validateProductId,
  validateCartQueryParams,
  validateCartApprovalParams,
  handleValidationErrors,
} from "../middleware/cartValidation.js";

const router = express.Router();

// User cart routes (authentication required)

// Get user's active cart
router.get(
  "/",
  protect,
  getUserCart
);

// Add item to cart
router.post(
  "/add",
  protect,
  validateAddToCart,
  handleValidationErrors,
  addToCart
);

// Update item quantity in cart
router.put(
  "/items/:product_id",
  protect,
  validateProductId,
  validateUpdateCartItem,
  handleValidationErrors,
  updateCartItem
);

// Remove item from cart
router.delete(
  "/items/:product_id",
  protect,
  validateProductId,
  handleValidationErrors,
  removeFromCart
);

// Clear all items from cart
router.delete(
  "/clear",
  protect,
  clearCart
);

// Submit cart for approval
router.post(
  "/submit",
  protect,
  validateSubmitCart,
  handleValidationErrors,
  submitCart
);

// Cancel cart (user can cancel their own cart)
router.patch(
  "/:cart_id/cancel",
  protect,
  validateCartId,
  handleValidationErrors,
  cancelCart
);

// Get user's cart history
router.get(
  "/history",
  protect,
  validateCartQueryParams,
  handleValidationErrors,
  getUserCartHistory
);

// Admin-only protected routes

// Get all carts (admin only)
router.get(
  "/admin/all",
  adminAuth,
  validateCartQueryParams,
  handleValidationErrors,
  getAllCarts
);

// Get pending carts (admin only)
router.get(
  "/admin/pending",
  adminAuth,
  getPendingCarts
);

// Get approved carts (admin only)
router.get(
  "/admin/approved",
  adminAuth,
  validateCartQueryParams,
  handleValidationErrors,
  getApprovedCarts
);

// Get rejected carts (admin only)
router.get(
  "/admin/rejected",
  adminAuth,
  validateCartQueryParams,
  handleValidationErrors,
  getRejectedCarts
);

// Approve cart (admin only)
router.patch(
  "/admin/:cart_id/approve",
  adminAuth,
  validateCartId,
  validateCartApprovalParams,
  handleValidationErrors,
  approveCart
);

// Reject cart (admin only)
router.patch(
  "/admin/:cart_id/reject",
  adminAuth,
  validateCartId,
  validateCartApprovalParams,
  handleValidationErrors,
  rejectCart
);

export default router;