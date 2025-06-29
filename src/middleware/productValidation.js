import { body, param, query, validationResult } from "express-validator";

// Validation rules for creating product
export const validateCreateProduct = [
  body("name")
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ min: 2, max: 200 })
    .withMessage("Product name must be between 2 and 200 characters")
    .trim(),

  body("category_id")
    .notEmpty()
    .withMessage("Category is required")
    .isMongoId()
    .withMessage("Invalid category ID format"),

  body("color")
    .notEmpty()
    .withMessage("Product color is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Color must be between 2 and 50 characters")
    .trim(),

  body("price")
    .notEmpty()
    .withMessage("Product price is required")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("quantity")
    .notEmpty()
    .withMessage("Product quantity is required")
    .isInt({ min: 0 })
    .withMessage("Quantity must be a non-negative integer"),

  body("expiration_date")
    .notEmpty()
    .withMessage("Expiration date is required")
    .isISO8601()
    .withMessage("Expiration date must be a valid date")
    .custom((value) => {
      const expirationDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (expirationDate <= today) {
        throw new Error("Expiration date must be in the future");
      }
      return true;
    }),
];

// Validation rules for updating product
export const validateUpdateProduct = [
  body("name")
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage("Product name must be between 2 and 200 characters")
    .trim(),

  body("category_id")
    .optional()
    .isMongoId()
    .withMessage("Invalid category ID format"),

  body("color")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("Color must be between 2 and 50 characters")
    .trim(),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("quantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Quantity must be a non-negative integer"),

  body("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active must be a boolean value"),

  body("expiration_date")
    .optional()
    .isISO8601()
    .withMessage("Expiration date must be a valid date")
    .custom((value) => {
      if (value) {
        const expirationDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (expirationDate <= today) {
          throw new Error("Expiration date must be in the future");
        }
      }
      return true;
    }),
];

// Validation for MongoDB ObjectId
export const validateObjectId = [
  param("id").isMongoId().withMessage("Invalid product ID format"),
];

export const sanitizeFormData = (req, res, next) => {
  // Convert 'undefined' strings to actual undefined
  for (const key in req.body) {
    if (req.body[key] === 'undefined' || req.body[key] === 'null' || req.body[key] === '') {
      req.body[key] = undefined;
    } 
  }
  next();
};

// Validation for slug
export const validateSlug = [
  param("slug")
    .notEmpty()
    .withMessage("Slug is required")
    .isLength({ min: 1, max: 200 })
    .withMessage("Slug must be between 1 and 200 characters")
    .matches(/^[a-z0-9-]+$/)
    .withMessage(
      "Slug can only contain lowercase letters, numbers, and hyphens"
    ),
];

// Validation for product query parameters
export const validateProductQueryParams = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("search")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Search query cannot exceed 100 characters"),

  query("category_id")
    .optional()
    .isMongoId()
    .withMessage("Invalid category ID format"),

  query("is_active")
    .optional()
    .isIn(["true", "false"])
    .withMessage("is_active must be true or false"),

  query("in_stock")
    .optional()
    .isIn(["true", "false"])
    .withMessage("in_stock must be true or false"),

  query("min_price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("min_price must be a positive number"),

  query("max_price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("max_price must be a positive number"),

  query("color")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Color filter cannot exceed 50 characters"),

  query("sort")
    .optional()
    .isIn([
      "name",
      "-name",
      "price",
      "-price",
      "quantity",
      "-quantity",
      "createdAt",
      "-createdAt",
      "expiration_date",
      "-expiration_date",
    ])
    .withMessage("Invalid sort parameter"),

  query("include_expired")
    .optional()
    .isIn(["true", "false"])
    .withMessage("include_expired must be true or false"),
];

// Validation for product image operations
export const validateProductImageParams = [
  param("product_id").isMongoId().withMessage("Invalid product ID format"),

  param("image_id")
    .optional()
    .isMongoId()
    .withMessage("Invalid image ID format"),
];

// Validation for image update
export const validateImageUpdate = [
  body("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active must be a boolean value"),

  body("is_primary")
    .optional()
    .isBoolean()
    .withMessage("is_primary must be a boolean value"),

  body("order")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Order must be a non-negative integer"),
];

// Middleware to handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation errors",
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value,
      })),
    });
  }

  next();
};
