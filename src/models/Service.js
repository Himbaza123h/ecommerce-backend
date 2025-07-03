import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Service title is required"],
      trim: true,
      maxLength: [200, "Service title cannot exceed 200 characters"],
    },
    subtitle: {
      type: String,
      required: [true, "Service subtitle is required"],
      trim: true,
      maxLength: [300, "Service subtitle cannot exceed 300 characters"],
    },
    description: {
      type: String,
      required: [true, "Service description is required"],
      trim: true,
      maxLength: [2000, "Service description cannot exceed 2000 characters"],
    },
    icon: {
      type: String,
      required: [true, "Service icon is required"],
      trim: true,
    },
    total_groups: {
      type: Number,
      default: 0,
      min: [0, "Total groups count cannot be negative"],
    },
    total_members: {
      type: Number,
      default: 0,
      min: [0, "Total members count cannot be negative"],
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual to get groups for this service
serviceSchema.virtual('groups', {
  ref: 'Group',
  localField: '_id',
  foreignField: 'service_id',
  match: { is_active: true, approval_status: 'approved' }
});

serviceSchema.pre("save", async function (next) {
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
serviceSchema.index({ title: 1 });
serviceSchema.index({ slug: 1 });
serviceSchema.index({ is_active: 1 });
serviceSchema.index({ total_groups: -1 });
serviceSchema.index({ total_members: -1 });
serviceSchema.index({ createdAt: -1 });

// Virtual for formatted groups count
serviceSchema.virtual("formatted_groups").get(function () {
  if (this.total_groups === undefined || this.total_groups === null || isNaN(this.total_groups)) {
    return "0 groups";
  }
  try {
    const count = Number(this.total_groups);
    if (count === 1) {
      return "1 group";
    }
    return `${count.toLocaleString()} groups`;
  } catch (error) {
    return "0 groups";
  }
});

// Virtual for formatted members count
serviceSchema.virtual("formatted_members").get(function () {
  if (this.total_members === undefined || this.total_members === null || isNaN(this.total_members)) {
    return "0 members";
  }
  try {
    const count = Number(this.total_members);
    if (count === 1) {
      return "1 member";
    }
    return `${count.toLocaleString()} members`;
  } catch (error) {
    return "0 members";
  }
});

// Static method to get active services
serviceSchema.statics.getActiveServices = function () {
  return this.find({ is_active: true });
};

// Static method to get services by groups count (popular services)
serviceSchema.statics.getPopularServices = function (limit = 10) {
  return this.find({ is_active: true })
    .sort({ total_groups: -1, total_members: -1 })
    .limit(limit);
};

// Static method to get services with minimum groups
serviceSchema.statics.getServicesByMinGroups = function (minGroups) {
  return this.find({ total_groups: { $gte: minGroups }, is_active: true });
};

// Instance method to check if service has groups
serviceSchema.methods.hasGroups = function () {
  return this.total_groups > 0;
};

// Instance method to update groups and members count
serviceSchema.methods.updateCounts = async function () {
  try {
    const Group = mongoose.model('Group');
    
    // Count active approved groups
    const groupsCount = await Group.countDocuments({
      service_id: this._id,
      is_active: true,
      approval_status: 'approved'
    });

    // Calculate total members across all groups
    const groups = await Group.find({
      service_id: this._id,
      is_active: true,
      approval_status: 'approved'
    });

    const totalMembers = groups.reduce((sum, group) => sum + group.members_count, 0);

    this.total_groups = groupsCount;
    this.total_members = totalMembers;
    
    return this.save();
  } catch (error) {
    console.error('Error updating service counts:', error);
    throw error;
  }
};

const Service = mongoose.model("Service", serviceSchema);

export default Service;