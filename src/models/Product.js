import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxLength: [200, "Product name cannot exceed 200 characters"],
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },

    group_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: [true, "Group is required"],
    },
    color: {
      type: String,
      required: [true, "Product color is required"],
      trim: true,
      maxLength: [50, "Color cannot exceed 50 characters"],
    },
    phone: {
      type: String,
      required: false,
      trim: true,
      maxLength: [20, "Phone number cannot exceed 20 characters"],
      validate: {
        validator: function (v) {
          // Allow empty/null values, but validate format if provided
          if (!v) return true;
          // Basic phone number validation (digits, spaces, dashes, parentheses, plus)
          return /^[\+]?[\d\s\-\(\)]+$/.test(v);
        },
        message: "Phone number format is invalid",
      },
      default: null,
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },
    quantity: {
      type: Number,
      required: [true, "Product quantity is required"],
      min: [0, "Quantity cannot be negative"],
      default: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    expiration_date: {
      type: String,
      required: [true, "Expiration date is required"],
      validate: {
        validator: function (v) {
          // Validate that it's a valid date string in YYYY-MM-DD format
          return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
        },
        message: "Expiration date must be in YYYY-MM-DD format",
      },
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

productSchema.pre("save", async function (next) {
  if (this.isModified("name") || this.isNew) {
    let baseSlug = this.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .trim();

    let slug = baseSlug;
    let counter = 1;

    // Check for existing slugs and append number if needed
    while (await this.constructor.findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = slug;
  }
  next();
});

// Indexes for better query performance
productSchema.index({ name: 1 });
productSchema.index({ slug: 1 });
productSchema.index({ category_id: 1 });
productSchema.index({ group_id: 1 });
productSchema.index({ is_active: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ expiration_date: 1 });
productSchema.index({ phone: 1 });

productSchema.virtual("is_expired").get(function () {
  if (!this.expiration_date) return false;

  try {
    const expirationDate = new Date(this.expiration_date);
    // Check if the date is valid
    if (isNaN(expirationDate.getTime())) {
      return false; // Treat invalid dates as not expired
    }
    return new Date() > expirationDate;
  } catch (error) {
    return false;
  }
});

// Virtual for formatted expiration date - FIXED VERSION
productSchema.virtual("formatted_expiration_date").get(function () {
  if (!this.expiration_date) return null;

  try {
    const date = new Date(this.expiration_date);
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return this.expiration_date; // Return the string as-is if date is invalid
    }
    return date.toLocaleDateString();
  } catch (error) {
    return this.expiration_date; // Return the string as-is if conversion fails
  }
});

// Virtual for formatted price - WITH NULL CHECK
productSchema.virtual("formatted_price").get(function () {
  if (this.price === undefined || this.price === null || isNaN(this.price)) {
    return "$0.00";
  }
  try {
    return `$${Number(this.price).toFixed(2)}`;
  } catch (error) {
    return "$0.00";
  }
});

// Static method to get active products
productSchema.statics.getActiveProducts = function () {
  return this.find({ is_active: true }).populate("category_id");
};

// Static method to get products by category
productSchema.statics.getProductsByCategory = function (categoryId) {
  return this.find({ category_id: categoryId, is_active: true });
};

// Instance method to check if in stock
productSchema.methods.isInStock = function () {
  return this.quantity > 0;
};

// Instance method to reduce quantity
productSchema.methods.reduceQuantity = function (amount) {
  if (this.quantity >= amount) {
    this.quantity -= amount;
    return this.save();
  }
  throw new Error("Insufficient quantity");
};

// Instance method to add quantity
productSchema.methods.addQuantity = function (amount) {
  this.quantity += amount;
  return this.save();
};

productSchema.statics.getProductsByGroup = function (groupId) {
  return this.find({ group_id: groupId, is_active: true });
};

const Product = mongoose.model("Product", productSchema);

export default Product;
