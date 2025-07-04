import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

// Get user's active cart
export const getUserCart = async (req, res) => {
  try {
    const userId = req.user.id;

    let cart = await Cart.getUserActiveCart(userId);

    // If no active cart exists, create one
    if (!cart) {
      cart = new Cart({ user_id: userId });
      await cart.save();
      cart = await Cart.getUserActiveCart(userId);
    }

    // Check if any products in cart are no longer available
    const validItems = [];
    let hasChanges = false;

    for (const item of cart.items) {
      const product = item.product_id;
      
      // Check if product exists, is active, and not expired
      if (product && product.is_active && !product.is_expired) {
        // Check if requested quantity is available
        if (item.quantity <= product.quantity) {
          validItems.push(item);
        } else {
          // Reduce quantity to available stock
          if (product.quantity > 0) {
            item.quantity = product.quantity;
            validItems.push(item);
            hasChanges = true;
          } else {
            hasChanges = true; // Item will be removed
          }
        }
      } else {
        hasChanges = true; // Item will be removed
      }
    }

    // Update cart if there were changes
    if (hasChanges) {
      cart.items = validItems;
      await cart.save();
    }

    res.json({
      success: true,
      data: cart,
      message: hasChanges ? "Cart updated due to product availability changes" : null,
    });
  } catch (error) {
    console.error("Get user cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cart",
      error: error.message,
    });
  }
};

// Add item to cart
export const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, quantity = 1 } = req.body;

    // Validate product exists and is available
    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!product.is_active) {
      return res.status(400).json({
        success: false,
        message: "Product is not active",
      });
    }

    if (product.is_expired) {
      return res.status(400).json({
        success: false,
        message: "Product has expired",
      });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantity} items available in stock`,
      });
    }

    // Get or create user's active cart
    let cart = await Cart.getUserActiveCart(userId);
    if (!cart) {
      cart = new Cart({ user_id: userId });
    }

    // Check if adding this quantity would exceed available stock
    const existingItem = cart.items.find(
      (item) => item.product_id.toString() === product_id.toString()
    );
    
    const currentQuantityInCart = existingItem ? existingItem.quantity : 0;
    const totalRequestedQuantity = currentQuantityInCart + quantity;

    if (totalRequestedQuantity > product.quantity) {
      return res.status(400).json({
        success: false,
        message: `Cannot add ${quantity} items. Only ${product.quantity - currentQuantityInCart} more items available`,
      });
    }

    // Add item to cart
    await cart.addItem(product_id, quantity, product.price);

    // Populate the cart for response
    const populatedCart = await Cart.getUserActiveCart(userId);

    res.json({
      success: true,
      message: "Item added to cart successfully",
      data: populatedCart,
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add item to cart",
      error: error.message,
    });
  }
};

// Update item quantity in cart
export const updateCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id } = req.params;
    const { quantity } = req.body;

    const cart = await Cart.getUserActiveCart(userId);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    if (!cart.canBeModified()) {
      return res.status(400).json({
        success: false,
        message: "Cart cannot be modified in its current status",
      });
    }

    // If quantity is 0 or negative, remove the item
    if (quantity <= 0) {
      await cart.removeItem(product_id);
      const updatedCart = await Cart.getUserActiveCart(userId);
      return res.json({
        success: true,
        message: "Item removed from cart",
        data: updatedCart,
      });
    }

    // Validate product availability
    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (quantity > product.quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantity} items available in stock`,
      });
    }

    await cart.updateItemQuantity(product_id, quantity);
    const updatedCart = await Cart.getUserActiveCart(userId);

    res.json({
      success: true,
      message: "Cart item updated successfully",
      data: updatedCart,
    });
  } catch (error) {
    console.error("Update cart item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update cart item",
      error: error.message,
    });
  }
};

// Remove item from cart
export const removeFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id } = req.params;

    const cart = await Cart.getUserActiveCart(userId);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    if (!cart.canBeModified()) {
      return res.status(400).json({
        success: false,
        message: "Cart cannot be modified in its current status",
      });
    }

    await cart.removeItem(product_id);
    const updatedCart = await Cart.getUserActiveCart(userId);

    res.json({
      success: true,
      message: "Item removed from cart successfully",
      data: updatedCart,
    });
  } catch (error) {
    console.error("Remove from cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove item from cart",
      error: error.message,
    });
  }
};

// Clear all items from cart
export const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await Cart.getUserActiveCart(userId);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    if (!cart.canBeModified()) {
      return res.status(400).json({
        success: false,
        message: "Cart cannot be modified in its current status",
      });
    }

    await cart.clearCart();
    const updatedCart = await Cart.getUserActiveCart(userId);

    res.json({
      success: true,
      message: "Cart cleared successfully",
      data: updatedCart,
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear cart",
      error: error.message,
    });
  }
};

// Submit cart for approval
export const submitCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notes = "" } = req.body;

    const cart = await Cart.getUserActiveCart(userId);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    if (cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot submit empty cart",
      });
    }

    if (!cart.canBeModified()) {
      return res.status(400).json({
        success: false,
        message: "Cart cannot be submitted in its current status",
      });
    }

    // Validate all items are still available
    for (const item of cart.items) {
      const product = await Product.findById(item.product_id);
      if (!product || !product.is_active || product.is_expired) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.product_id} is no longer available`,
        });
      }

      if (item.quantity > product.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product ${product.name}. Only ${product.quantity} available`,
        });
      }
    }

    await cart.submitForApproval(notes);
    const updatedCart = await Cart.getUserActiveCart(userId);

    res.json({
      success: true,
      message: "Cart submitted for approval successfully",
      data: updatedCart,
    });
  } catch (error) {
    console.error("Submit cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit cart",
      error: error.message,
    });
  }
};

// Cancel cart (user can cancel their own cart)
export const cancelCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { cart_id } = req.params;

    const cart = await Cart.findById(cart_id).populate("user_id", "fullName username");
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Check if user owns this cart
    if (cart.user_id._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only cancel your own cart",
      });
    }

    if (cart.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cart is already cancelled",
      });
    }

    if (cart.status === "approved") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel approved cart",
      });
    }

    await cart.cancelCart();

    res.json({
      success: true,
      message: "Cart cancelled successfully",
      data: cart,
    });
  } catch (error) {
    console.error("Cancel cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel cart",
      error: error.message,
    });
  }
};

// Get user's cart history
export const getUserCartHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 10, 
      status 
    } = req.query;

    const query = { user_id: userId };
    
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const carts = await Cart.find(query)
      .populate("items.product_id", "name price")
      .populate("approved_by", "fullName username")
      .populate("rejected_by", "fullName username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Cart.countDocuments(query);

    res.json({
      success: true,
      data: carts,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get user cart history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cart history",
      error: error.message,
    });
  }
};

// ADMIN FUNCTIONS

// Get all carts (admin only)
export const getAllCarts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      user_id,
      sort = "-createdAt" 
    } = req.query;

    const query = {};
    
    if (status) {
      query.status = status;
    }

    if (user_id) {
      query.user_id = user_id;
    }

    // Sort options
    const sortOptions = {};
    if (sort === "createdAt") sortOptions.createdAt = 1;
    else if (sort === "-createdAt") sortOptions.createdAt = -1;
    else if (sort === "total_amount") sortOptions.total_amount = 1;
    else if (sort === "-total_amount") sortOptions.total_amount = -1;
    else if (sort === "submitted_at") sortOptions.submitted_at = 1;
    else if (sort === "-submitted_at") sortOptions.submitted_at = -1;
    else sortOptions.createdAt = -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const carts = await Cart.find(query)
      .populate("items.product_id", "name price quantity")
      .populate("user_id", "fullName username phone")
      .populate("approved_by", "fullName username")
      .populate("rejected_by", "fullName username")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Cart.countDocuments(query);

    res.json({
      success: true,
      data: carts,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get all carts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch carts",
      error: error.message,
    });
  }
};

// Get pending carts (admin only)
export const getPendingCarts = async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const carts = await Cart.getCartsByStatus("pending")
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: carts,
      count: carts.length,
    });
  } catch (error) {
    console.error("Get pending carts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending carts",
      error: error.message,
    });
  }
};

// Get approved carts (admin only)
export const getApprovedCarts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const carts = await Cart.getCartsByStatus("approved")
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Cart.countDocuments({ status: "approved" });

    res.json({
      success: true,
      data: carts,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get approved carts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch approved carts",
      error: error.message,
    });
  }
};

// Get rejected carts (admin only)
export const getRejectedCarts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const carts = await Cart.getCartsByStatus("rejected")
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Cart.countDocuments({ status: "rejected" });

    res.json({
      success: true,
      data: carts,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get rejected carts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch rejected carts",
      error: error.message,
    });
  }
};

// Approve cart (admin only)
export const approveCart = async (req, res) => {
  try {
    const { cart_id } = req.params;
    const { admin_notes = "" } = req.body;
    const adminId = req.user.id;

    const cart = await Cart.findById(cart_id)
      .populate("items.product_id", "name price quantity")
      .populate("user_id", "fullName username phone");

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    if (!cart.canBeProcessed()) {
      return res.status(400).json({
        success: false,
        message: "Cart cannot be processed in its current status",
      });
    }

    // Validate all items are still available
    for (const item of cart.items) {
      const product = item.product_id;
      if (!product || !product.is_active || product.is_expired) {
        return res.status(400).json({
          success: false,
          message: `Product ${product ? product.name : 'Unknown'} is no longer available`,
        });
      }

      if (item.quantity > product.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product ${product.name}. Only ${product.quantity} available`,
        });
      }
    }

    await cart.approveCart(adminId, admin_notes);

    // Optionally reduce product quantities here
    // for (const item of cart.items) {
    //   const product = await Product.findById(item.product_id);
    //   await product.reduceQuantity(item.quantity);
    // }

    res.json({
      success: true,
      message: "Cart approved successfully",
      data: cart,
    });
  } catch (error) {
    console.error("Approve cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve cart",
      error: error.message,
    });
  }
};

// Reject cart (admin only)
export const rejectCart = async (req, res) => {
  try {
    const { cart_id } = req.params;
    const { admin_notes = "" } = req.body;
    const adminId = req.user.id;

    const cart = await Cart.findById(cart_id)
      .populate("items.product_id", "name price")
      .populate("user_id", "fullName username phone");

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    if (!cart.canBeProcessed()) {
      return res.status(400).json({
        success: false,
        message: "Cart cannot be processed in its current status",
      });
    }

    await cart.rejectCart(adminId, admin_notes);

    res.json({
      success: true,
      message: "Cart rejected successfully",
      data: cart,
    });
  } catch (error) {
    console.error("Reject cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject cart",
      error: error.message,
    });
  }
};
