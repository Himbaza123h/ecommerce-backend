import mongoose from 'mongoose';

const productImageSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  image_url: {
    type: String,
    required: [true, 'Image URL is required'],
    trim: true
  },
  image_public_id: {
    type: String,
    required: [true, 'Image public ID is required'],
    trim: true
  },
  is_active: {
    type: Boolean,
    default: true
  },
  is_primary: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
productImageSchema.index({ product_id: 1 });
productImageSchema.index({ is_active: 1 });
productImageSchema.index({ is_primary: 1 });
productImageSchema.index({ order: 1 });

// Ensure only one primary image per product
productImageSchema.pre('save', async function(next) {
  if (this.is_primary && this.isModified('is_primary')) {
    // Remove primary status from other images of the same product
    await ProductImage.updateMany(
      { 
        product_id: this.product_id, 
        _id: { $ne: this._id } 
      },
      { is_primary: false }
    );
  }
  next();
});

// Static method to get active images for a product
productImageSchema.statics.getProductImages = function(productId) {
  return this.find({ 
    product_id: productId, 
    is_active: true 
  }).sort({ is_primary: -1, order: 1 });
};

// Static method to get primary image for a product
productImageSchema.statics.getPrimaryImage = function(productId) {
  return this.findOne({ 
    product_id: productId, 
    is_primary: true, 
    is_active: true 
  });
};

// Static method to set primary image
productImageSchema.statics.setPrimaryImage = async function(imageId, productId) {
  // First, remove primary status from all images of the product
  await this.updateMany(
    { product_id: productId },
    { is_primary: false }
  );
  
  // Then set the specified image as primary
  return this.findByIdAndUpdate(
    imageId,
    { is_primary: true },
    { new: true }
  );
};

const ProductImage = mongoose.model('ProductImage', productImageSchema);

export default ProductImage;