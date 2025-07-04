import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: [true, "Product is required"],
  },
  quantity: {
    type: Number,
    required: [true, "Quantity is required"],
    min: [1, "Quantity must be at least 1"],
    default: 1,
  },
  price_at_time: {
    type: Number,
    required: [true, "Price at time of adding is required"],
    min: [0, "Price cannot be negative"],
  },
  added_at: {
    type: Date,
    default: Date.now,
  },
});

const cartSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    items: [cartItemSchema],
    status: {
      type: String,
      enum: ["active", "pending", "approved", "rejected", "cancelled"],
      default: "active",
    },
    total_amount: {
      type: Number,
      default: 0,
      min: [0, "Total amount cannot be negative"],
    },
    total_items: {
      type: Number,
      default: 0,
      min: [0, "Total items cannot be negative"],
    },
    notes: {
      type: String,
      maxLength: [500, "Notes cannot exceed 500 characters"],
      trim: true,
    },
    admin_notes: {
      type: String,
      maxLength: [500, "Admin notes cannot exceed 500 characters"],
      trim: true,
    },
    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approved_at: {
      type: Date,
    },
    rejected_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejected_at: {
      type: Date,
    },
    submitted_at: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
cartSchema.index({ user_id: 1, status: 1 });
cartSchema.index({ status: 1 });
cartSchema.index({ createdAt: -1 });
cartSchema.index({ approved_at: -1 });
cartSchema.index({ rejected_at: -1 });

// Virtual for formatted total amount
cartSchema.virtual("formatted_total_amount").get(function () {
  if (this.total_amount === undefined || this.total_amount === null || isNaN(this.total_amount)) {
    return "$0.00";
  }
  try {
    return `$${Number(this.total_amount).toFixed(2)}`;
  } catch (error) {
    return "$0.00";
  }
});

// Virtual for cart age
cartSchema.virtual("cart_age").get(function () {
  if (!this.createdAt) return 0;
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24)); // Days
});

// Pre-save middleware to calculate totals
cartSchema.pre("save", function (next) {
  if (this.items && this.items.length > 0) {
    this.total_items = this.items.reduce((total, item) => total + item.quantity, 0);
    this.total_amount = this.items.reduce(
      (total, item) => total + (item.price_at_time * item.quantity),
      0
    );
  } else {
    this.total_items = 0;
    this.total_amount = 0;
  }
  next();
});

// Static method to get user's active cart
cartSchema.statics.getUserActiveCart = function (userId) {
  return this.findOne({ user_id: userId, status: "active" })
    .populate("items.product_id", "name price quantity is_active expiration_date")
    .populate("user_id", "fullName username phone");
};

// Static method to get carts by status
cartSchema.statics.getCartsByStatus = function (status) {
  return this.find({ status })
    .populate("items.product_id", "name price quantity is_active expiration_date")
    .populate("user_id", "fullName username phone")
    .populate("approved_by", "fullName username")
    .populate("rejected_by", "fullName username")
    .sort({ createdAt: -1 });
};

// Instance method to add item to cart
cartSchema.methods.addItem = function (productId, quantity, priceAtTime) {
  const existingItemIndex = this.items.findIndex(
    (item) => item.product_id.toString() === productId.toString()
  );

  if (existingItemIndex > -1) {
    // Update existing item quantity
    this.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new item
    this.items.push({
      product_id: productId,
      quantity,
      price_at_time: priceAtTime,
    });
  }

  return this.save();
};

// Instance method to remove item from cart
cartSchema.methods.removeItem = function (productId) {
  this.items = this.items.filter(
    (item) => item.product_id.toString() !== productId.toString()
  );
  return this.save();
};

// Instance method to update item quantity
cartSchema.methods.updateItemQuantity = function (productId, newQuantity) {
  const itemIndex = this.items.findIndex(
    (item) => item.product_id.toString() === productId.toString()
  );

  if (itemIndex > -1) {
    if (newQuantity <= 0) {
      // Remove item if quantity is 0 or negative
      this.items.splice(itemIndex, 1);
    } else {
      this.items[itemIndex].quantity = newQuantity;
    }
  }

  return this.save();
};

// Instance method to clear all items
cartSchema.methods.clearCart = function () {
  this.items = [];
  return this.save();
};

// Instance method to submit cart for approval
cartSchema.methods.submitForApproval = function (notes = "") {
  this.status = "pending";
  this.notes = notes;
  this.submitted_at = new Date();
  return this.save();
};

// Instance method to approve cart
cartSchema.methods.approveCart = function (adminId, adminNotes = "") {
  this.status = "approved";
  this.admin_notes = adminNotes;
  this.approved_by = adminId;
  this.approved_at = new Date();
  return this.save();
};

// Instance method to reject cart
cartSchema.methods.rejectCart = function (adminId, adminNotes = "") {
  this.status = "rejected";
  this.admin_notes = adminNotes;
  this.rejected_by = adminId;
  this.rejected_at = new Date();
  return this.save();
};

// Instance method to cancel cart
cartSchema.methods.cancelCart = function () {
  this.status = "cancelled";
  return this.save();
};

// Instance method to check if cart can be modified
cartSchema.methods.canBeModified = function () {
  return this.status === "active";
};

// Instance method to check if cart can be approved/rejected
cartSchema.methods.canBeProcessed = function () {
  return this.status === "pending";
};

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;