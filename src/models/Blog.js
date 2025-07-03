import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Blog title is required"],
      trim: true,
      maxLength: [200, "Blog title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Blog description is required"],
      trim: true,
      maxLength: [5000, "Blog description cannot exceed 5000 characters"],
    },
    thumbnail: {
      type: String,
      required: [true, "Blog thumbnail is required"],
      trim: true,
    },
    gallery: [{
      type: String,
      required: true,
      trim: true,
    }],
    service_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, "Service ID is required"],
      default: "6866e93935c41e4f646178a7",
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    views: {
      type: Number,
      default: 0,
      min: [0, "Views count cannot be negative"],
    },
    likes: {
      type: Number,
      default: 0,
      min: [0, "Likes count cannot be negative"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual to get service details
blogSchema.virtual('service', {
  ref: 'Service',
  localField: 'service_id',
  foreignField: '_id',
  justOne: true
});

blogSchema.pre("save", async function (next) {
  if (this.isModified("title") || this.isNew) {
    let baseSlug = this.title
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
blogSchema.index({ title: 1 });
blogSchema.index({ slug: 1 });
blogSchema.index({ is_active: 1 });
blogSchema.index({ service_id: 1 });
blogSchema.index({ views: -1 });
blogSchema.index({ likes: -1 });
blogSchema.index({ createdAt: -1 });
blogSchema.index({ service_id: 1, is_active: 1 });

// Virtual for formatted views count
blogSchema.virtual("formatted_views").get(function () {
  if (this.views === undefined || this.views === null || isNaN(this.views)) {
    return "0 views";
  }
  try {
    const count = Number(this.views);
    if (count === 1) {
      return "1 view";
    }
    return `${count.toLocaleString()} views`;
  } catch (error) {
    return "0 views";
  }
});

// Virtual for formatted likes count
blogSchema.virtual("formatted_likes").get(function () {
  if (this.likes === undefined || this.likes === null || isNaN(this.likes)) {
    return "0 likes";
  }
  try {
    const count = Number(this.likes);
    if (count === 1) {
      return "1 like";
    }
    return `${count.toLocaleString()} likes`;
  } catch (error) {
    return "0 likes";
  }
});

// Virtual for gallery count
blogSchema.virtual("gallery_count").get(function () {
  return this.gallery ? this.gallery.length : 0;
});

// Virtual for reading time (estimate based on description length)
blogSchema.virtual("estimated_reading_time").get(function () {
  if (!this.description) return "1 min read";
  const wordsPerMinute = 200;
  const wordCount = this.description.trim().split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / wordsPerMinute);
  return `${readingTime} min read`;
});

// Static method to get active blogs
blogSchema.statics.getActiveBlogs = function () {
  return this.find({ is_active: true });
};

// Static method to get popular blogs (by views and likes)
blogSchema.statics.getPopularBlogs = function (limit = 10) {
  return this.find({ is_active: true })
    .sort({ views: -1, likes: -1, createdAt: -1 })
    .limit(limit);
};

// Static method to get recent blogs
blogSchema.statics.getRecentBlogs = function (limit = 10) {
  return this.find({ is_active: true })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get blogs by service
blogSchema.statics.getBlogsByService = function (serviceId) {
  return this.find({ service_id: serviceId, is_active: true });
};

// Instance method to increment views
blogSchema.methods.incrementViews = async function () {
  try {
    this.views += 1;
    return this.save();
  } catch (error) {
    console.error('Error incrementing views:', error);
    throw error;
  }
};

// Instance method to increment likes
blogSchema.methods.incrementLikes = async function () {
  try {
    this.likes += 1;
    return this.save();
  } catch (error) {
    console.error('Error incrementing likes:', error);
    throw error;
  }
};

// Instance method to check if blog has gallery
blogSchema.methods.hasGallery = function () {
  return this.gallery && this.gallery.length > 0;
};

// Instance method to add image to gallery
blogSchema.methods.addToGallery = async function (imageUrl) {
  try {
    if (!this.gallery) {
      this.gallery = [];
    }
    this.gallery.push(imageUrl);
    return this.save();
  } catch (error) {
    console.error('Error adding to gallery:', error);
    throw error;
  }
};

// Instance method to remove image from gallery
blogSchema.methods.removeFromGallery = async function (imageUrl) {
  try {
    if (!this.gallery) return this;
    this.gallery = this.gallery.filter(img => img !== imageUrl);
    return this.save();
  } catch (error) {
    console.error('Error removing from gallery:', error);
    throw error;
  }
};

const Blog = mongoose.model("Blog", blogSchema);

export default Blog;