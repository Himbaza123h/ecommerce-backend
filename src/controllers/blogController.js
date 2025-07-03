import Blog from "../models/Blog.js";
import Service from "../models/Service.js";
import mongoose from "mongoose";
import { uploadImage, deleteImage } from "../config/cloudinary.js";

// @desc    Create a new blog (Admin only)
// @route   POST /api/blogs
// @access  Private/Admin
export const createBlog = async (req, res) => {
  try {
    const { title, description, is_active } = req.body;

    // Validation
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields: title, description",
      });
    }

    // Check if blog with same title already exists
    const existingBlog = await Blog.findOne({ title });
    if (existingBlog) {
      return res.status(400).json({
        success: false,
        message: "Blog with this title already exists",
      });
    }

    // Verify service exists
    const service = await Service.findById("6866e93935c41e4f646178a7");
    if (!service) {
      return res.status(400).json({
        success: false,
        message: "Default service not found",
      });
    }

    let thumbnailUrl = null;
    let galleryUrls = [];

    // Handle file uploads
    if (req.files) {
      // Handle thumbnail upload
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        try {
          const thumbnailFile = req.files.thumbnail[0];
          const fileStr = `data:${thumbnailFile.mimetype};base64,${thumbnailFile.buffer.toString('base64')}`;
          const thumbnailResult = await uploadImage(fileStr, "blogs/thumbnails");
          thumbnailUrl = thumbnailResult.url;
        } catch (error) {
          console.error("Thumbnail upload error:", error);
          return res.status(400).json({
            success: false,
            message: "Thumbnail upload failed",
          });
        }
      }

      // Handle gallery uploads
      if (req.files.gallery && req.files.gallery.length > 0) {
        try {
          for (const file of req.files.gallery) {
            const fileStr = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
            const galleryResult = await uploadImage(fileStr, "blogs/gallery");
            galleryUrls.push(galleryResult.url);
          }
        } catch (error) {
          console.error("Gallery upload error:", error);
          // Clean up uploaded thumbnail if gallery fails
          if (thumbnailUrl) {
            try {
              const publicId = thumbnailUrl.split("/").pop().split(".")[0];
              await deleteImage(`blogs/thumbnails/${publicId}`);
            } catch (cleanupError) {
              console.error("Cleanup error:", cleanupError);
            }
          }
          return res.status(400).json({
            success: false,
            message: "Gallery upload failed",
          });
        }
      }
    }

    // Ensure we have at least one gallery image
    if (galleryUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one gallery image is required",
      });
    }

    // Create blog
    const blog = await Blog.create({
      title,
      description,
      thumbnail: thumbnailUrl || "default-thumbnail-url",
      gallery: galleryUrls,
      service_id: "6866e93935c41e4f646178a7",
      is_active: is_active ? JSON.parse(is_active) : true,
    });

    // Populate service data
    await blog.populate('service');

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      blog,
    });
  } catch (error) {
    console.error("Create blog error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0],
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error during blog creation",
    });
  }
};

// @desc    Get all blogs
// @route   GET /api/blogs
// @access  Public
export const getAllBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, active_only = "true", sort = "recent" } = req.query;

    const query = active_only === "true" ? { is_active: true } : {};

    let sortOptions = {};
    switch (sort) {
      case "popular":
        sortOptions = { views: -1, likes: -1, createdAt: -1 };
        break;
      case "views":
        sortOptions = { views: -1 };
        break;
      case "likes":
        sortOptions = { likes: -1 };
        break;
      case "recent":
      default:
        sortOptions = { createdAt: -1 };
        break;
    }

    const blogs = await Blog.find(query)
      .populate('service', 'title slug')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Blog.countDocuments(query);

    res.status(200).json({
      success: true,
      count: blogs.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      blogs,
    });
  } catch (error) {
    console.error("Get blogs error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get single blog
// @route   GET /api/blogs/:id
// @access  Public
export const getBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).populate('service', 'title slug description');

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Increment views
    await blog.incrementViews();

    res.status(200).json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error("Get blog error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get blog by slug
// @route   GET /api/blogs/slug/:slug
// @access  Public
export const getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug, is_active: true })
      .populate('service', 'title slug description');

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Increment views
    await blog.incrementViews();

    res.status(200).json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error("Get blog by slug error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update blog (Admin only)
// @route   PUT /api/blogs/:id
// @access  Private/Admin
export const updateBlog = async (req, res) => {
  try {
    const { title, description, is_active } = req.body;
    const blogId = req.params.id;

    let blog = await Blog.findById(blogId);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Check if title is being updated and if it's already taken
    if (title && title !== blog.title) {
      const existingBlog = await Blog.findOne({
        title,
        _id: { $ne: blogId },
      });

      if (existingBlog) {
        return res.status(400).json({
          success: false,
          message: "Blog with this title already exists",
        });
      }
    }

    let thumbnailUrl = blog.thumbnail;
    let galleryUrls = [...blog.gallery];

    // Handle file uploads
    if (req.files) {
      // Handle thumbnail update
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        try {
          // Delete old thumbnail if it exists and it's not the default
          if (blog.thumbnail && blog.thumbnail !== "default-thumbnail-url") {
            const publicId = blog.thumbnail.split("/").pop().split(".")[0];
            await deleteImage(`blogs/thumbnails/${publicId}`);
          }

          const thumbnailFile = req.files.thumbnail[0];
          const fileStr = `data:${thumbnailFile.mimetype};base64,${thumbnailFile.buffer.toString('base64')}`;
          const thumbnailResult = await uploadImage(fileStr, "blogs/thumbnails");
          thumbnailUrl = thumbnailResult.url;
        } catch (error) {
          console.error("Thumbnail upload error:", error);
          return res.status(400).json({
            success: false,
            message: "Thumbnail upload failed",
          });
        }
      }

      // Handle gallery additions
      if (req.files.gallery && req.files.gallery.length > 0) {
        try {
          for (const file of req.files.gallery) {
            const fileStr = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
            const galleryResult = await uploadImage(fileStr, "blogs/gallery");
            galleryUrls.push(galleryResult.url);
          }
        } catch (error) {
          console.error("Gallery upload error:", error);
          return res.status(400).json({
            success: false,
            message: "Gallery upload failed",
          });
        }
      }
    }

    blog = await Blog.findByIdAndUpdate(
      blogId,
      {
        ...(title && { title }),
        ...(description && { description }),
        ...(is_active !== undefined && { is_active: JSON.parse(is_active) }),
        thumbnail: thumbnailUrl,
        gallery: galleryUrls,
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate('service', 'title slug description');

    res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      blog,
    });
  } catch (error) {
    console.error("Update blog error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0],
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error during blog update",
    });
  }
};

// @desc    Delete blog (Admin only)
// @route   DELETE /api/blogs/:id
// @access  Private/Admin
export const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Delete thumbnail from cloudinary if it exists
    if (blog.thumbnail && blog.thumbnail !== "default-thumbnail-url") {
      try {
        const publicId = blog.thumbnail.split("/").pop().split(".")[0];
        await deleteImage(`blogs/thumbnails/${publicId}`);
      } catch (error) {
        console.error("Thumbnail deletion error:", error);
      }
    }

    // Delete gallery images from cloudinary
    if (blog.gallery && blog.gallery.length > 0) {
      for (const imageUrl of blog.gallery) {
        try {
          const publicId = imageUrl.split("/").pop().split(".")[0];
          await deleteImage(`blogs/gallery/${publicId}`);
        } catch (error) {
          console.error("Gallery image deletion error:", error);
        }
      }
    }

    await Blog.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("Delete blog error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Activate blog (Admin only)
// @route   PUT /api/blogs/:id/activate
// @access  Private/Admin
export const activateBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      { is_active: true },
      { new: true }
    ).populate('service', 'title slug');

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Blog activated successfully",
      blog,
    });
  } catch (error) {
    console.error("Activate blog error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Deactivate blog (Admin only)
// @route   PUT /api/blogs/:id/deactivate
// @access  Private/Admin
export const deactivateBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      { new: true }
    ).populate('service', 'title slug');

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Blog deactivated successfully",
      blog,
    });
  } catch (error) {
    console.error("Deactivate blog error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Like blog
// @route   PUT /api/blogs/:id/like
// @access  Public
export const likeBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    await blog.incrementLikes();

    res.status(200).json({
      success: true,
      message: "Blog liked successfully",
      likes: blog.likes,
    });
  } catch (error) {
    console.error("Like blog error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get blog statistics (Admin only)
// @route   GET /api/blogs/:id/stats
// @access  Private/Admin
export const getBlogStats = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).populate('service', 'title');

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    const stats = {
      id: blog._id,
      title: blog.title,
      views: blog.views,
      likes: blog.likes,
      gallery_count: blog.gallery_count,
      estimated_reading_time: blog.estimated_reading_time,
      is_active: blog.is_active,
      created_at: blog.createdAt,
      updated_at: blog.updatedAt,
      service: blog.service
    };

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Get blog stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Remove image from gallery (Admin only)
// @route   DELETE /api/blogs/:id/gallery/:imageIndex
// @access  Private/Admin
export const removeFromGallery = async (req, res) => {
  try {
    const { id, imageIndex } = req.params;
    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    const index = parseInt(imageIndex);
    if (index < 0 || index >= blog.gallery.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid image index",
      });
    }

    // Cannot remove if it's the last image
    if (blog.gallery.length === 1) {
      return res.status(400).json({
        success: false,
        message: "Cannot remove the last image from gallery",
      });
    }

    const imageUrl = blog.gallery[index];

    // Delete from cloudinary
    try {
      const publicId = imageUrl.split("/").pop().split(".")[0];
      await deleteImage(`blogs/gallery/${publicId}`);
    } catch (error) {
      console.error("Image deletion error:", error);
    }

    // Remove from array
    blog.gallery.splice(index, 1);
    await blog.save();

    res.status(200).json({
      success: true,
      message: "Image removed from gallery successfully",
      blog,
    });
  } catch (error) {
    console.error("Remove from gallery error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};