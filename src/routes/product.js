import express from "express";
import { uploadMultiple } from "../middleware/multer.js";
import { adminAuth } from "../middleware/adminMiddleware.js";
import {
  createProduct,
  getAllProducts,
  getActiveProducts,
  getProductById,
  getProductBySlug,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  addProductImages,
  getProductImages,
  updateProductImage,
  deleteProductImage,
  setPrimaryImage,
  getProductStats,
  getProductsByGroup,
  getActiveProductsByGroup,
  
} from "../controllers/productController.js";

import {
  validateCreateProduct,
  validateUpdateProduct,
  validateObjectId,
  validateSlug,
  validateProductQueryParams,
  validateProductImageParams,
  validateImageUpdate,
  handleValidationErrors,
} from "../middleware/productValidation.js";

const router = express.Router();

// Public routes (no authentication required)
router.get(
  "/active",
  validateProductQueryParams,
  handleValidationErrors,
  getActiveProducts
);

router.get(
  "/slug/:slug",
  validateSlug,
  handleValidationErrors,
  getProductBySlug
);

router.get("/:id", validateObjectId, handleValidationErrors, getProductById);

router.get(
  "/",
  validateProductQueryParams,
  handleValidationErrors,
  getAllProducts
);

// Public route for getting product images
router.get(
  "/:product_id/images",
  validateProductImageParams,
  handleValidationErrors,
  getProductImages
);

// Admin-only protected routes

// Get product statistics (admin only)
router.get("/admin/stats", adminAuth, getProductStats);

// Create product with multiple image uploads (admin only)
router.post(
  "/",
  adminAuth,
  uploadMultiple("images", 10), // Allow up to 10 images
  validateCreateProduct,
  handleValidationErrors,
  createProduct
);

// Update product (admin only)
router.put(
  "/:id",
  adminAuth,
  validateObjectId,
  validateUpdateProduct,
  handleValidationErrors,
  updateProduct
);

// Toggle product active status (admin only)
router.patch(
  "/:id/toggle-status",
  adminAuth,
  validateObjectId,
  handleValidationErrors,
  toggleProductStatus
);

// Delete product (admin only)
router.delete(
  "/:id",
  adminAuth,
  validateObjectId,
  handleValidationErrors,
  deleteProduct
);

// Product Image Management Routes (Admin only)

// Add images to existing product (admin only)
router.post(
  "/:product_id/images",
  adminAuth,
  uploadMultiple("images", 10),
  validateProductImageParams,
  handleValidationErrors,
  addProductImages
);

// Update specific product image (admin only)
router.put(
  "/:product_id/images/:image_id",
  adminAuth,
  validateProductImageParams,
  validateImageUpdate,
  handleValidationErrors,
  updateProductImage
);

// Delete specific product image (admin only)
router.delete(
  "/:product_id/images/:image_id",
  adminAuth,
  validateProductImageParams,
  handleValidationErrors,
  deleteProductImage
);

// Set primary image for product (admin only)
router.patch(
  "/:product_id/images/:image_id/set-primary",
  adminAuth,
  validateProductImageParams,
  handleValidationErrors,
  setPrimaryImage
);

router.get("/group/:group_id", getProductsByGroup);

// Get active products by group (public endpoint)
router.get("/group/:group_id/active", getActiveProductsByGroup);

export default router;
