import Category from '../models/Category.js';
import { uploadImage, deleteImage } from '../config/cloudinary.js';

// Create new category
export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Check if category already exists
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }

    let logo_url = '';
    let logo_public_id = '';

    // Handle logo upload if provided
    if (req.file) {
      const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      const uploadResult = await uploadImage(fileStr, 'ecommerce/categories');
      logo_url = uploadResult.url;
      logo_public_id = uploadResult.public_id;
    }

    // Create category
    const category = new Category({
      name,
      description,
      logo_url,
      logo_public_id
    });

    const savedCategory = await category.save();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: savedCategory
    });

  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error.message
    });
  }
};

// Get all categories
export const getAllCategories = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      is_active,
      sort = 'name'
    } = req.query;

    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (is_active !== undefined) {
      query.is_active = is_active === 'true';
    }

    // Sort options
    const sortOptions = {};
    if (sort === 'name') sortOptions.name = 1;
    else if (sort === '-name') sortOptions.name = -1;
    else if (sort === 'createdAt') sortOptions.createdAt = 1;
    else if (sort === '-createdAt') sortOptions.createdAt = -1;
    else if (sort === 'counts') sortOptions.counts = 1;
    else if (sort === '-counts') sortOptions.counts = -1;
    else sortOptions.name = 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const categories = await Category.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Category.countDocuments(query);

    res.json({
      success: true,
      data: categories,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
};

// Get active categories only
export const getActiveCategories = async (req, res) => {
  try {
    const categories = await Category.getActiveCategories();

    res.json({
      success: true,
      data: categories,
      count: categories.length
    });

  } catch (error) {
    console.error('Get active categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active categories',
      error: error.message
    });
  }
};

// Get category by ID
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      data: category
    });

  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message
    });
  }
};

// Get category by slug
export const getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await Category.findOne({ slug, is_active: true });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      data: category
    });

  } catch (error) {
    console.error('Get category by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message
    });
  }
};

// Update category
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if name is being changed and if it already exists
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: id }
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }
    }

    // Handle logo update
    if (req.file) {
      // Delete old logo if exists
      if (category.logo_public_id) {
        await deleteImage(category.logo_public_id);
      }

      // Upload new logo
      const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      const uploadResult = await uploadImage(fileStr, 'ecommerce/categories');
      category.logo_url = uploadResult.url;
      category.logo_public_id = uploadResult.public_id;
    }

    // Update fields
    if (name) category.name = name;
    if (description) category.description = description;
    if (is_active !== undefined) category.is_active = is_active;

    const updatedCategory = await category.save();

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory
    });

  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error.message
    });
  }
};

// Delete category
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has products (counts > 0)
    if (category.counts > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing products. Please move or delete products first.'
      });
    }

    // Delete logo from Cloudinary if exists
    if (category.logo_public_id) {
      await deleteImage(category.logo_public_id);
    }

    await Category.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error.message
    });
  }
};

// Toggle category status
export const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    category.is_active = !category.is_active;
    const updatedCategory = await category.save();

    res.json({
      success: true,
      message: `Category ${category.is_active ? 'activated' : 'deactivated'} successfully`,
      data: updatedCategory
    });

  } catch (error) {
    console.error('Toggle category status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle category status',
      error: error.message
    });
  }
};

// Get category statistics
export const getCategoryStats = async (req, res) => {
  try {
    const totalCategories = await Category.countDocuments();
    const activeCategories = await Category.countDocuments({ is_active: true });
    const inactiveCategories = await Category.countDocuments({ is_active: false });
    const totalProducts = await Category.aggregate([
      { $group: { _id: null, total: { $sum: '$counts' } } }
    ]);

    const topCategories = await Category.find({ is_active: true })
      .sort({ counts: -1 })
      .limit(5)
      .select('name counts logo_url');

    res.json({
      success: true,
      data: {
        total_categories: totalCategories,
        active_categories: activeCategories,
        inactive_categories: inactiveCategories,
        total_products: totalProducts[0]?.total || 0,
        top_categories: topCategories
      }
    });

  } catch (error) {
    console.error('Get category stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category statistics',
      error: error.message
    });
  }
};