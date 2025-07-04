import { body, param, query, validationResult } from "express-validator";
import mongoose from "mongoose";

// Validation for adding items to cart
export const validateAddToCart = [
  body("product_id")
    .notEmpty()
    .withMessage("Product ID is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid product ID format");
      }
      return true;
    }),
  body("quantity")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Quantity must be a positive integer between 1 and 1000"),
];

// Validation for updating cart item quantity
export const validateUpdateCartItem = [
  body("quantity")
    .isInt({ min: 0, max: 1000 })
    .withMessage("Quantity must be an integer between 0 and 1000"),
];

// Validation for submitting cart
export const validateSubmitCart = [
  body("notes")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes must be a string with maximum 500 characters"),
];

// Validation for cart ID parameter
export const validateCartId = [
  param("cart_id")
    .notEmpty()
    .withMessage("Cart ID is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid cart ID format");
      }
      return true;
    }),
];

// Validation for product ID parameter
export const validateProductId = [
  param("product_id")
    .notEmpty()
    .withMessage("Product ID is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid product ID format");
      }
      return true;
    }),
];

// Validation for cart query parameters
export const validateCartQueryParams = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("status")
    .optional()
    .isIn(["active", "pending", "approved", "rejected", "cancelled"])
    .withMessage("Status must be one of: active, pending, approved, rejected, cancelled"),
  query("user_id")
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid user ID format");
      }
      return true;
    }),
  query("sort")
    .optional()
    .isIn([
      "createdAt",
      "-createdAt",
      "total_amount",
      "-total_amount",
      "submitted_at",
      "-submitted_at",
    ])
    .withMessage(
      "Sort must be one of: createdAt, -createdAt, total_amount, -total_amount, submitted_at, -submitted_at"
    ),
];

// Validation for cart approval/rejection parameters
export const validateCartApprovalParams = [
  body("admin_notes")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Admin notes must be a string with maximum 1000 characters"),
];

// Handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value,
      })),
    });
  }
  next();
};