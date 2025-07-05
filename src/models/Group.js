import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Group name is required"],
      trim: true,
      maxLength: [200, "Group name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Group description is required"],
      trim: true,
      maxLength: [1000, "Group description cannot exceed 1000 characters"],
    },
    group_icon: {
      type: String,
      required: [true, "Group icon is required"],
      trim: true,
    },
    link: {
      type: String,
      required: false,
      trim: true,
      validate: {
        validator: function (v) {
          // Only validate if link is provided
          if (!v) return true;

          // Basic URL validation
          const urlRegex = /^https?:\/\/.+/;
          return urlRegex.test(v);
        },
        message: "Please provide a valid URL starting with http:// or https://",
      },
    },
    is_active: {
      type: Boolean,
      default: false, // Groups need admin approval first
    },
    is_private: {
      type: Boolean,
      default: false, // false = public (free to join), true = private (requires approval)
    },
    service_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: [true, "Service is required"],
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Group creator is required"],
    },
    group_admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Group admin is required"],
    },
    members_count: {
      type: Number,
      default: 0,
      min: [0, "Members count cannot be negative"],
    },
    // Array to store user IDs who joined the group
    joined_users: [
      {
        user_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        joined_at: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        role: {
          type: String,
          enum: ["member", "admin"],
          default: "member",
        },
      },
    ],
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    approval_status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save middleware to generate slug
groupSchema.pre("save", async function (next) {
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

// Post-save hook to update service counts
groupSchema.post("save", async function (doc) {
  try {
    const Service = mongoose.model("Service");
    const service = await Service.findById(doc.service_id);
    if (service) {
      await service.updateCounts();
    }
  } catch (error) {
    console.error("Error updating service counts after group save:", error);
  }
});

// Post-remove hook to update service counts
groupSchema.post("findOneAndDelete", async function (doc) {
  try {
    if (doc) {
      const Service = mongoose.model("Service");
      const service = await Service.findById(doc.service_id);
      if (service) {
        await service.updateCounts();
      }
    }
  } catch (error) {
    console.error("Error updating service counts after group deletion:", error);
  }
});

// Post-update hook to update service counts
groupSchema.post("findOneAndUpdate", async function (doc) {
  try {
    if (doc) {
      const Service = mongoose.model("Service");
      const service = await Service.findById(doc.service_id);
      if (service) {
        await service.updateCounts();
      }
    }
  } catch (error) {
    console.error("Error updating service counts after group update:", error);
  }
});

// Indexes for better query performance
groupSchema.index({ name: 1 });
groupSchema.index({ slug: 1 });
groupSchema.index({ is_active: 1 });
groupSchema.index({ is_private: 1 });
groupSchema.index({ service_id: 1 });
groupSchema.index({ created_by: 1 });
groupSchema.index({ group_admin: 1 });
groupSchema.index({ members_count: -1 });
groupSchema.index({ createdAt: -1 });
groupSchema.index({ approval_status: 1 });

// Virtual for formatted members count
groupSchema.virtual("formatted_members").get(function () {
  if (
    this.members_count === undefined ||
    this.members_count === null ||
    isNaN(this.members_count)
  ) {
    return "0 members";
  }
  try {
    const count = Number(this.members_count);
    if (count === 1) {
      return "1 member";
    }
    return `${count.toLocaleString()} members`;
  } catch (error) {
    return "0 members";
  }
});

// Static method to get active groups
groupSchema.statics.getActiveGroups = function () {
  return this.find({ is_active: true, approval_status: "approved" });
};

// Static method to get groups by service
groupSchema.statics.getGroupsByService = function (serviceId) {
  return this.find({
    service_id: serviceId,
    is_active: true,
    approval_status: "approved",
  });
};

// Static method to get popular groups
groupSchema.statics.getPopularGroups = function (limit = 10) {
  return this.find({ is_active: true, approval_status: "approved" })
    .sort({ members_count: -1 })
    .limit(limit);
};

// Instance method to check if group has members
groupSchema.methods.hasMembers = function () {
  return this.members_count > 0;
};

// Instance method to update members count
groupSchema.methods.updateMembersCount = function () {
  const approvedMembers = this.joined_users.filter(
    (user) => user.status === "approved"
  ).length;
  this.members_count = approvedMembers;
  return this.save();
};

// Instance method to check if user is group admin
groupSchema.methods.isGroupAdmin = function (userId) {
  return this.group_admin.toString() === userId.toString();
};

// Instance method to check if user is member
groupSchema.methods.isMember = function (userId) {
  return this.joined_users.some(
    (user) =>
      user.user_id.toString() === userId.toString() &&
      user.status === "approved"
  );
};

const Group = mongoose.model("Group", groupSchema);

export default Group;
