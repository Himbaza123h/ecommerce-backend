import Product from "../models/Product.js";
import ProductImage from "../models/ProductImage.js";
import Category from "../models/Category.js";
import Group from "../models/Group.js";
import { uploadImage, deleteImage } from "../config/cloudinary.js";

// Create new product
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      category_id,
      group_id,
      color,
      price,
      quantity,
      expiration_date,
      phone,
    } = req.body;

    // Verify category exists and is active
    const category = await Category.findById(category_id);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category not found",
      });
    }

    if (!category.is_active) {
      return res.status(400).json({
        success: false,
        message: "Cannot create product in inactive category",
      });
    }

    const group = await Group.findById(group_id);
    if (!group) {
      return res.status(400).json({
        success: false,
        message: "Group not found",
      });
    }

    if (!group.is_active) {
      return res.status(400).json({
        success: false,
        message: "Cannot create product in inactive group",
      });
    }

    // Create product
    const product = new Product({
      name,
      category_id,
      group_id,
      color,
      price: parseFloat(price),
      quantity: parseInt(quantity),
      expiration_date: expiration_date,
      phone: phone || null,
    });

    const savedProduct = await product.save();

    // Handle image uploads if provided
    let uploadedImages = [];
    if (req.files && req.files.length > 0) {
      try {
        const imageUploadPromises = req.files.map(async (file, index) => {
          const fileStr = `data:${file.mimetype};base64,${file.buffer.toString(
            "base64"
          )}`;
          const uploadResult = await uploadImage(fileStr, "ecommerce/products");

          return new ProductImage({
            product_id: savedProduct._id,
            image_url: uploadResult.url,
            image_public_id: uploadResult.public_id,
            is_primary: index === 0, // First image is primary
            order: index,
          });
        });

        uploadedImages = await Promise.all(imageUploadPromises);
        await ProductImage.insertMany(uploadedImages);
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        // Product is created but images failed - log this
      }
    }

    // Increment category count
    await category.incrementCount();

    // Populate the response with category and images
    const populatedProduct = await Product.findById(savedProduct._id)
      .populate("category_id", "name slug")
      .populate("group_id", "name slug");

    const productImages = await ProductImage.getProductImages(savedProduct._id);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: {
        ...populatedProduct.toObject(),
        images: productImages,
      },
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: error.message,
    });
  }
};

// Get all products
export const getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      category_id,
      group_id,
      is_active,
      in_stock,
      min_price,
      max_price,
      color,
      sort = "-createdAt",
      include_expired = "false",
    } = req.query;

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { color: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (category_id) {
      query.category_id = category_id;
    }

    if (group_id) {
      query.group_id = group_id;
    }

    if (is_active !== undefined) {
      query.is_active = is_active === "true";
    }

    if (in_stock === "true") {
      query.quantity = { $gt: 0 };
    } else if (in_stock === "false") {
      query.quantity = 0;
    }

    if (min_price || max_price) {
      query.price = {};
      if (min_price) query.price.$gte = parseFloat(min_price);
      if (max_price) query.price.$lte = parseFloat(max_price);
    }

    if (color) {
      query.color = { $regex: color, $options: "i" };
    }

    // Handle expiration filter
    if (include_expired === "false") {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
      query.expiration_date = { $gt: today };
    }
    // Sort options
    const sortOptions = {};
    if (sort === "name") sortOptions.name = 1;
    else if (sort === "-name") sortOptions.name = -1;
    else if (sort === "price") sortOptions.price = 1;
    else if (sort === "-price") sortOptions.price = -1;
    else if (sort === "quantity") sortOptions.quantity = 1;
    else if (sort === "-quantity") sortOptions.quantity = -1;
    else if (sort === "createdAt") sortOptions.createdAt = 1;
    else if (sort === "-createdAt") sortOptions.createdAt = -1;
    else if (sort === "expiration_date") sortOptions.expiration_date = 1;
    else if (sort === "-expiration_date") sortOptions.expiration_date = -1;
    else sortOptions.createdAt = -1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find(query)
      .populate("category_id", "name slug logo_url")
      .populate("group_id", "name slug")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get images for each product
    const productsWithImages = await Promise.all(
      products.map(async (product) => {
        const images = await ProductImage.getProductImages(product._id);
        return {
          ...product.toObject(),
          images,
        };
      })
    );

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: productsWithImages,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

// Get active products only
export const getActiveProducts = async (req, res) => {
  try {
    const { category_id, group_id, limit = 20 } = req.query;

    const query = {
      is_active: true,
      expiration_date: { $gt: new Date().toISOString().split("T")[0] },
    };

    if (category_id) {
      query.category_id = category_id;
    }

    if (group_id) {
      query.group_id = group_id;
    }

    const products = await Product.find(query)
      .populate("category_id", "name slug")
      .populate("group_id", "name slug")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Get images for each product
    const productsWithImages = await Promise.all(
      products.map(async (product) => {
        const images = await ProductImage.getProductImages(product._id);
        return {
          ...product.toObject(),
          images,
        };
      })
    );

    res.json({
      success: true,
      data: productsWithImages,
      count: productsWithImages.length,
    });
  } catch (error) {
    console.error("Get active products error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active products",
      error: error.message,
    });
  }
};

// Get product by ID
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .populate("category_id", "name slug description logo_url")
      .populate("group_id", "name slug description");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const images = await ProductImage.getProductImages(product._id);

    res.json({
      success: true,
      data: {
        ...product.toObject(),
        images,
      },
    });
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message,
    });
  }
};

// Get product by slug
export const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ slug, is_active: true })
      .populate("category_id", "name slug description logo_url")
      .populate("group_id", "name slug description");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const images = await ProductImage.getProductImages(product._id);

    res.json({
      success: true,
      data: {
        ...product.toObject(),
        images,
      },
    });
  } catch (error) {
    console.error("Get product by slug error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message,
    });
  }
};

// Update product
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      category_id,
      group_id,
      color,
      price,
      quantity,
      is_active,
      expiration_date,
      phone,
    } = req.body;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // If category is being changed, verify new category exists
    if (category_id && category_id !== product.category_id.toString()) {
      const newCategory = await Category.findById(category_id);
      if (!newCategory) {
        return res.status(400).json({
          success: false,
          message: "New category not found",
        });
      }

      if (!newCategory.is_active) {
        return res.status(400).json({
          success: false,
          message: "Cannot move product to inactive category",
        });
      }

      if (group_id && group_id !== product.group_id.toString()) {
        const newGroup = await Group.findById(group_id);
        if (!newGroup) {
          return res.status(400).json({
            success: false,
            message: "New group not found",
          });
        }

        if (!newGroup.is_active) {
          return res.status(400).json({
            success: false,
            message: "Cannot move product to inactive group",
          });
        }
      }

      // Update category counts
      const oldCategory = await Category.findById(product.category_id);
      if (oldCategory) {
        await oldCategory.decrementCount();
      }
      await newCategory.incrementCount();
    }

    // Update fields
    if (name) product.name = name;
    if (category_id) product.category_id = category_id;
    if (group_id) product.group_id = group_id;
    if (color) product.color = color;
    if (price !== undefined) product.price = parseFloat(price);
    if (quantity !== undefined) product.quantity = parseInt(quantity);
    if (is_active !== undefined) product.is_active = is_active;
    if (expiration_date) product.expiration_date = expiration_date;
    if (phone !== undefined) product.phone = phone || null;

    const updatedProduct = await product.save();

    // Populate the response
    const populatedProduct = await Product.findById(updatedProduct._id)
      .populate("category_id", "name slug")
      .populate("group_id", "name slug");

    const images = await ProductImage.getProductImages(updatedProduct._id);

    res.json({
      success: true,
      message: "Product updated successfully",
      data: {
        ...populatedProduct.toObject(),
        images,
      },
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
    });
  }
};

// Delete product
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Delete all product images from Cloudinary and database
    const productImages = await ProductImage.find({ product_id: id });

    for (const image of productImages) {
      try {
        await deleteImage(image.image_public_id);
      } catch (deleteError) {
        console.error("Error deleting image:", deleteError);
      }
    }

    await ProductImage.deleteMany({ product_id: id });

    // Update category count
    const category = await Category.findById(product.category_id);
    if (category) {
      await category.decrementCount();
    }

    await Product.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
};

// Toggle product status
export const toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.is_active = !product.is_active;
    const updatedProduct = await product.save();

    res.json({
      success: true,
      message: `Product ${
        product.is_active ? "activated" : "deactivated"
      } successfully`,
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Toggle product status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle product status",
      error: error.message,
    });
  }
};

// Add images to product
export const addProductImages = async (req, res) => {
  try {
    const { product_id } = req.params;

    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No images provided",
      });
    }

    // Get current image count for ordering
    const currentImageCount = await ProductImage.countDocuments({ product_id });

    const imageUploadPromises = req.files.map(async (file, index) => {
      const fileStr = `data:${file.mimetype};base64,${file.buffer.toString(
        "base64"
      )}`;
      const uploadResult = await uploadImage(fileStr, "ecommerce/products");

      return new ProductImage({
        product_id,
        image_url: uploadResult.url,
        image_public_id: uploadResult.public_id,
        is_primary: currentImageCount === 0 && index === 0, // First image is primary if no images exist
        order: currentImageCount + index,
      });
    });

    const uploadedImages = await Promise.all(imageUploadPromises);
    const savedImages = await ProductImage.insertMany(uploadedImages);

    res.status(201).json({
      success: true,
      message: "Images added successfully",
      data: savedImages,
    });
  } catch (error) {
    console.error("Add product images error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add images",
      error: error.message,
    });
  }
};

// Get product images
export const getProductImages = async (req, res) => {
  try {
    const { product_id } = req.params;

    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const images = await ProductImage.getProductImages(product_id);

    res.json({
      success: true,
      data: images,
      count: images.length,
    });
  } catch (error) {
    console.error("Get product images error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product images",
      error: error.message,
    });
  }
};

// Update product image
export const updateProductImage = async (req, res) => {
  try {
    const { product_id, image_id } = req.params;
    const { is_active, is_primary, order } = req.body;

    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const image = await ProductImage.findOne({ _id: image_id, product_id });
    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    // Update fields
    if (is_active !== undefined) image.is_active = is_active;
    if (order !== undefined) image.order = parseInt(order);
    if (is_primary !== undefined) image.is_primary = is_primary;

    const updatedImage = await image.save();

    res.json({
      success: true,
      message: "Image updated successfully",
      data: updatedImage,
    });
  } catch (error) {
    console.error("Update product image error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update image",
      error: error.message,
    });
  }
};

// Delete product image
export const deleteProductImage = async (req, res) => {
  try {
    const { product_id, image_id } = req.params;

    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const image = await ProductImage.findOne({ _id: image_id, product_id });
    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    // Delete image from Cloudinary
    try {
      await deleteImage(image.image_public_id);
    } catch (deleteError) {
      console.error("Error deleting image from Cloudinary:", deleteError);
    }

    // If this was the primary image, set another image as primary
    if (image.is_primary) {
      const nextImage = await ProductImage.findOne({
        product_id,
        _id: { $ne: image_id },
        is_active: true,
      }).sort({ order: 1 });

      if (nextImage) {
        nextImage.is_primary = true;
        await nextImage.save();
      }
    }

    await ProductImage.findByIdAndDelete(image_id);

    res.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Delete product image error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete image",
      error: error.message,
    });
  }
};

// Set primary image
export const setPrimaryImage = async (req, res) => {
  try {
    const { product_id, image_id } = req.params;

    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const image = await ProductImage.findOne({ _id: image_id, product_id });
    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    if (!image.is_active) {
      return res.status(400).json({
        success: false,
        message: "Cannot set inactive image as primary",
      });
    }

    const updatedImage = await ProductImage.setPrimaryImage(
      image_id,
      product_id
    );

    res.json({
      success: true,
      message: "Primary image set successfully",
      data: updatedImage,
    });
  } catch (error) {
    console.error("Set primary image error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set primary image",
      error: error.message,
    });
  }
};

// Get product statistics
export const getProductStats = async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ is_active: true });
    const inactiveProducts = await Product.countDocuments({ is_active: false });
    const outOfStockProducts = await Product.countDocuments({ quantity: 0 });
    const expiredProducts = await Product.countDocuments({
      expiration_date: { $lte: new Date().toISOString().split("T")[0] },
    });
    const lowStockProducts = await Product.countDocuments({
      quantity: { $gt: 0, $lte: 10 },
    });

    // Category-wise product count
    const productsByCategory = await Product.aggregate([
      {
        $group: {
          _id: "$category_id",
          count: { $sum: 1 },
          total_value: { $sum: { $multiply: ["$price", "$quantity"] } },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: "$category",
      },
      {
        $project: {
          category_name: "$category.name",
          count: 1,
          total_value: 1,
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    const productsByGroup = await Product.aggregate([
      {
        $group: {
          _id: "$group_id",
          count: { $sum: 1 },
          total_value: { $sum: { $multiply: ["$price", "$quantity"] } },
        },
      },
      {
        $lookup: {
          from: "groups",
          localField: "_id",
          foreignField: "_id",
          as: "group",
        },
      },
      {
        $unwind: "$group",
      },
      {
        $project: {
          group_name: "$group.name",
          count: 1,
          total_value: 1,
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Top selling products (by quantity)
    const topProducts = await Product.find({ is_active: true })
      .populate("category_id", "name")
      .sort({ quantity: -1 })
      .limit(5)
      .select("name price quantity category_id");

    // Price range statistics
    const priceStats = await Product.aggregate([
      {
        $group: {
          _id: null,
          min_price: { $min: "$price" },
          max_price: { $max: "$price" },
          avg_price: { $avg: "$price" },
          total_inventory_value: {
            $sum: { $multiply: ["$price", "$quantity"] },
          },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        total_products: totalProducts,
        active_products: activeProducts,
        inactive_products: inactiveProducts,
        out_of_stock_products: outOfStockProducts,
        expired_products: expiredProducts,
        low_stock_products: lowStockProducts,
        products_by_category: productsByCategory,
        products_by_group: productsByGroup,
        top_products: topProducts,
        price_statistics: priceStats[0] || {
          min_price: 0,
          max_price: 0,
          avg_price: 0,
          total_inventory_value: 0,
        },
      },
    });
  } catch (error) {
    console.error("Get product stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product statistics",
      error: error.message,
    });
  }
};

// Get products by group ID
export const getProductsByGroup = async (req, res) => {
  try {
    const { group_id } = req.params;
    const {
      page = 1,
      limit = 10,
      search = "",
      category_id,
      is_active,
      in_stock,
      min_price,
      max_price,
      color,
      sort = "-createdAt",
      include_expired = "false",
    } = req.query;

    // Verify group exists and is active
    const group = await Group.findById(group_id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    if (!group.is_active) {
      return res.status(403).json({
        success: false,
        message: "Group is not active",
      });
    }

    // Build query
    const query = { group_id };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { color: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (category_id) {
      query.category_id = category_id;
    }

    if (is_active !== undefined) {
      query.is_active = is_active === "true";
    }

    if (in_stock === "true") {
      query.quantity = { $gt: 0 };
    } else if (in_stock === "false") {
      query.quantity = 0;
    }

    if (min_price || max_price) {
      query.price = {};
      if (min_price) query.price.$gte = parseFloat(min_price);
      if (max_price) query.price.$lte = parseFloat(max_price);
    }

    if (color) {
      query.color = { $regex: color, $options: "i" };
    }

    // Handle expiration filter
    if (include_expired === "false") {
      const today = new Date().toISOString().split("T")[0];
      query.expiration_date = { $gt: today };
    }

    // Sort options
    const sortOptions = {};
    if (sort === "name") sortOptions.name = 1;
    else if (sort === "-name") sortOptions.name = -1;
    else if (sort === "price") sortOptions.price = 1;
    else if (sort === "-price") sortOptions.price = -1;
    else if (sort === "quantity") sortOptions.quantity = 1;
    else if (sort === "-quantity") sortOptions.quantity = -1;
    else if (sort === "createdAt") sortOptions.createdAt = 1;
    else if (sort === "-createdAt") sortOptions.createdAt = -1;
    else if (sort === "expiration_date") sortOptions.expiration_date = 1;
    else if (sort === "-expiration_date") sortOptions.expiration_date = -1;
    else sortOptions.createdAt = -1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find(query)
      .populate("category_id", "name slug logo_url")
      .populate("group_id", "name slug")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get images for each product
    const productsWithImages = await Promise.all(
      products.map(async (product) => {
        const images = await ProductImage.getProductImages(product._id);
        return {
          ...product.toObject(),
          images,
        };
      })
    );

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      message: `Products for group: ${group.name}`,
      data: productsWithImages,
      group_info: {
        id: group._id,
        name: group.name,
        slug: group.slug,
        description: group.description,
        members_count: group.members_count,
      },
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get products by group error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products for group",
      error: error.message,
    });
  }
};

// Get active products by group ID (for public viewing)
export const getActiveProductsByGroup = async (req, res) => {
  try {
    const { group_id } = req.params;
    const { limit = 20 } = req.query;

    // Verify group exists and is active
    const group = await Group.findById(group_id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    if (!group.is_active) {
      return res.status(403).json({
        success: false,
        message: "Group is not active",
      });
    }

    const query = {
      group_id,
      is_active: true,
      expiration_date: { $gt: new Date().toISOString().split("T")[0] },
    };

    const products = await Product.find(query)
      .populate("category_id", "name slug")
      .populate("group_id", "name slug")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Get images for each product
    const productsWithImages = await Promise.all(
      products.map(async (product) => {
        const images = await ProductImage.getProductImages(product._id);
        return {
          ...product.toObject(),
          images,
        };
      })
    );

    res.json({
      success: true,
      message: `Active products for group: ${group.name}`,
      data: productsWithImages,
      count: productsWithImages.length,
      group_info: {
        id: group._id,
        name: group.name,
        slug: group.slug,
        description: group.description,
        members_count: group.members_count,
      },
    });
  } catch (error) {
    console.error("Get active products by group error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active products for group",
      error: error.message,
    });
  }
};
