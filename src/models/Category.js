import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true,
    maxLength: [100, 'Category name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Category description is required'],
    trim: true,
    maxLength: [500, 'Description cannot exceed 500 characters']
  },
  logo_url: {
    type: String,
    default: '',
    trim: true
  },
  logo_public_id: {
    type: String,
    default: '',
    trim: true
  },
  counts: {
    type: Number,
    default: 0,
    min: [0, 'Count cannot be negative']
  },
  is_active: {
    type: Boolean,
    default: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  }
}, {
  timestamps: true, // This adds createdAt and updatedAt automatically
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create slug from name before saving
categorySchema.pre('save', function(next) {
  if (this.isModified('name') || this.isNew) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .trim();
  }
  next();
});

// Index for better query performance
categorySchema.index({ name: 1 });
categorySchema.index({ slug: 1 });
categorySchema.index({ is_active: 1 });
categorySchema.index({ createdAt: -1 });

// Virtual for formatted creation date
categorySchema.virtual('formatted_date').get(function() {
  if (!this.createdAt) return null;
  
  try {
    // Check if createdAt is a valid date
    if (isNaN(this.createdAt.getTime())) {
      return null;
    }
    return this.createdAt.toLocaleDateString();
  } catch (error) {
    return null;
  }
});

// Static method to get active categories
categorySchema.statics.getActiveCategories = function() {
  return this.find({ is_active: true }).sort({ name: 1 });
};

// Instance method to increment count
categorySchema.methods.incrementCount = function() {
  this.counts += 1;
  return this.save();
};

// Instance method to decrement count
categorySchema.methods.decrementCount = function() {
  if (this.counts > 0) {
    this.counts -= 1;
  }
  return this.save();
};

const Category = mongoose.model('Category', categorySchema);

export default Category;