import Group from "../models/Group.js";
import Service from "../models/Service.js";
import { uploadImage, deleteImage } from "../config/cloudinary.js";

// @desc    Create a new group (User can create, needs admin approval)
// @route   POST /api/groups
// @access  Private/User
export const createGroup = async (req, res) => {
  try {
    const { name, description, is_private, service_id, link } = req.body;
    const userId = req.user.id;

    // Validation
    if (!name || !description || !service_id) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required fields: name, description, service_id",
      });
    }

    // Check if service exists and is active
    const service = await Service.findOne({ _id: service_id, is_active: true });
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found or is inactive",
      });
    }

    // Check if group with same name already exists in this service
    const existingGroup = await Group.findOne({
      name,
      service_id: service_id,
    });
    if (existingGroup) {
      return res.status(400).json({
        success: false,
        message: "Group with this name already exists in this service",
      });
    }

    let iconUrl = null;

    // Handle icon upload if provided
    if (req.file) {
      try {
        const fileStr = `data:${
          req.file.mimetype
        };base64,${req.file.buffer.toString("base64")}`;
        const iconResult = await uploadImage(fileStr, "groups/icons");
        iconUrl = iconResult.url;
      } catch (error) {
        console.error("Icon upload error:", error);
        return res.status(400).json({
          success: false,
          message: "Icon upload failed",
        });
      }
    }

    // Create group
    const group = await Group.create({
      name,
      description,
      group_icon: iconUrl || "default-group-icon-url",
      is_private: is_private ? JSON.parse(is_private) : false,
      service_id,
      created_by: userId,
      group_admin: userId,
      approval_status: "pending",
      is_active: false,
      ...(link && { link }), // Add link if provided
    });

    res.status(201).json({
      success: true,
      message: "Group created successfully. Waiting for admin approval.",
      group,
    });
  } catch (error) {
    console.error("Create group error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0],
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error during group creation",
    });
  }
};

// @desc    Get all groups (with filtering options)
// @route   GET /api/groups
// @access  Public (but behavior changes based on auth)
export const getAllGroups = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      service_id,
      is_private,
      pending,
      approved,
      owner
    } = req.query;

    let query = {};
    
    // Check user authentication and role
    const isAuthenticated = req.user && req.user.id;
    const isAdmin = isAuthenticated && req.user.role === "admin";
    const userId = isAuthenticated ? req.user.id : null;

    // Apply filtering logic based on user role and parameters
    if (isAdmin) {
      // Admin sees all groups by default
      if (pending === "true") {
        query.approval_status = "pending";
      } else if (approved === "true") {
        query.is_active = true;
        query.approval_status = "approved";
      }
      // If neither pending nor approved is specified, show all groups
    } else if (isAuthenticated && owner === "true") {
      // Authenticated user requesting only their groups
      query.$or = [
        { created_by: userId },
        { group_admin: userId }
      ];
    } else {
      // Public access or regular user - only show active and approved groups
      query.is_active = true;
      query.approval_status = "approved";
    }

    // Apply additional filters
    if (service_id) {
      query.service_id = service_id;
    }

    if (is_private !== undefined) {
      query.is_private = is_private === "true";
    }

    const groups = await Group.find(query)
      .populate("service_id", "title subtitle")
      .populate("group_admin", "fullName username")
      .populate("created_by", "fullName username")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Group.countDocuments(query);

    res.status(200).json({
      success: true,
      count: groups.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      groups,
    });
  } catch (error) {
    console.error("Get groups error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get single group
// @route   GET /api/groups/:id
// @access  Public
export const getGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate("service_id", "title subtitle")
      .populate("group_admin", "fullName username")
      .populate("joined_users.user_id", "fullName username");

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    res.status(200).json({
      success: true,
      group,
    });
  } catch (error) {
    console.error("Get group error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update group (Group Admin or System Admin only)
// @route   PUT /api/groups/:id
// @access  Private/GroupAdmin or Admin
export const updateGroup = async (req, res) => {
  try {
    const { name, description, is_private, link } = req.body;
    const groupId = req.params.id;
    const userId = req.user.id;

    let group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // Check if user is group admin or system admin
    const isGroupAdmin = group.group_admin.toString() === userId;
    const isSystemAdmin = req.user.role === "admin";

    if (!isGroupAdmin && !isSystemAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this group",
      });
    }

    // Check if name is being updated and if it's already taken
    if (name && name !== group.name) {
      const existingGroup = await Group.findOne({
        name,
        service_id: group.service_id,
        _id: { $ne: groupId },
      });

      if (existingGroup) {
        return res.status(400).json({
          success: false,
          message: "Group with this name already exists in this service",
        });
      }
    }

    // Handle icon upload if provided
    let iconUrl = group.group_icon;
    if (req.file) {
      try {
        // Delete old icon if it exists and it's not the default
        if (group.group_icon && group.group_icon !== "default-group-icon-url") {
          const publicId = group.group_icon.split("/").pop().split(".")[0];
          await deleteImage(`groups/icons/${publicId}`);
        }

        const fileStr = `data:${
          req.file.mimetype
        };base64,${req.file.buffer.toString("base64")}`;
        const iconResult = await uploadImage(fileStr, "groups/icons");
        iconUrl = iconResult.url;
      } catch (error) {
        console.error("Icon upload error:", error);
        return res.status(400).json({
          success: false,
          message: "Icon upload failed",
        });
      }
    }

    group = await Group.findByIdAndUpdate(
      groupId,
      {
        ...(name && { name }),
        ...(description && { description }),
        ...(is_private !== undefined && { is_private: JSON.parse(is_private) }),
        ...(link !== undefined && { link }), // Add this line
        group_icon: iconUrl,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "Group updated successfully",
      group,
    });
  } catch (error) {
    console.error("Update group error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0],
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error during group update",
    });
  }
};

// @desc    Delete group (Group Admin or System Admin only)
// @route   DELETE /api/groups/:id
// @access  Private/GroupAdmin or Admin
export const deleteGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // Check if user is group admin or system admin
    const isGroupAdmin = group.group_admin.toString() === userId;
    const isSystemAdmin = req.user.role === "admin";

    if (!isGroupAdmin && !isSystemAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this group",
      });
    }

    // Delete icon from cloudinary if it exists
    if (group.group_icon && group.group_icon !== "default-group-icon-url") {
      try {
        const publicId = group.group_icon.split("/").pop().split(".")[0];
        await deleteImage(`groups/icons/${publicId}`);
      } catch (error) {
        console.error("Icon deletion error:", error);
      }
    }

    await Group.findByIdAndDelete(groupId);

    res.status(200).json({
      success: true,
      message: "Group deleted successfully",
    });
  } catch (error) {
    console.error("Delete group error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Approve group (System Admin only)
// @route   PUT /api/groups/:id/approve
// @access  Private/Admin
export const approveGroup = async (req, res) => {
  try {
    const group = await Group.findByIdAndUpdate(
      req.params.id,
      {
        approval_status: "approved",
        is_active: true,
      },
      { new: true }
    );

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Group approved successfully",
      group,
    });
  } catch (error) {
    console.error("Approve group error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Reject group (System Admin only)
// @route   PUT /api/groups/:id/reject
// @access  Private/Admin
export const rejectGroup = async (req, res) => {
  try {
    const group = await Group.findByIdAndUpdate(
      req.params.id,
      {
        approval_status: "rejected",
        is_active: false,
      },
      { new: true }
    );

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Group rejected successfully",
      group,
    });
  } catch (error) {
    console.error("Reject group error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Join group (User)
// @route   POST /api/groups/:id/join
// @access  Private/User
export const joinGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    if (!group.is_active || group.approval_status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Group is not active or not approved",
      });
    }

    // Check if user already joined
    const existingJoin = group.joined_users.find(
      (join) => join.user_id.toString() === userId
    );

    if (existingJoin) {
      return res.status(400).json({
        success: false,
        message: `You have already ${
          existingJoin.status === "pending"
            ? "requested to join"
            : existingJoin.status === "approved"
            ? "joined"
            : "been rejected from"
        } this group`,
      });
    }

    // Add user to joined_users array
    const joinStatus = group.is_private ? "pending" : "approved";

    group.joined_users.push({
      user_id: userId,
      status: joinStatus,
    });

    // Update members count if auto-approved
    if (joinStatus === "approved") {
      group.members_count = group.joined_users.filter(
        (join) => join.status === "approved"
      ).length;
    }

    await group.save();

    const message = group.is_private
      ? "Join request submitted successfully. Waiting for group admin approval."
      : "Successfully joined the group!";

    res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("Join group error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Approve user join request (Group Admin only)
// @route   PUT /api/groups/:id/approve/:userId
// @access  Private/GroupAdmin
export const approveUserJoin = async (req, res) => {
  try {
    const { id: groupId, userId } = req.params;
    const currentUserId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // Check if user is group admin
    if (group.group_admin.toString() !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized. Only group admin can approve join requests.",
      });
    }

    const joinRequest = group.joined_users.find(
      (join) => join.user_id.toString() === userId
    );

    if (!joinRequest) {
      return res.status(404).json({
        success: false,
        message: "Join request not found",
      });
    }

    if (joinRequest.status === "approved") {
      return res.status(400).json({
        success: false,
        message: "User is already approved",
      });
    }

    // Update status to approved
    joinRequest.status = "approved";

    // Update members count
    group.members_count = group.joined_users.filter(
      (join) => join.status === "approved"
    ).length;

    await group.save();

    res.status(200).json({
      success: true,
      message: "User approved successfully",
      group,
    });
  } catch (error) {
    console.error("Approve user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Reject user join request (Group Admin only)
// @route   PUT /api/groups/:id/reject/:userId
// @access  Private/GroupAdmin
export const rejectUserJoin = async (req, res) => {
  try {
    const { id: groupId, userId } = req.params;
    const currentUserId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // Check if user is group admin
    if (group.group_admin.toString() !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized. Only group admin can reject join requests.",
      });
    }

    const joinRequest = group.joined_users.find(
      (join) => join.user_id.toString() === userId
    );

    if (!joinRequest) {
      return res.status(404).json({
        success: false,
        message: "Join request not found",
      });
    }

    // Update status to rejected
    joinRequest.status = "rejected";

    await group.save();

    res.status(200).json({
      success: true,
      message: "User rejected successfully",
      group,
    });
  } catch (error) {
    console.error("Reject user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get group join requests (Group Admin only)
// @route   GET /api/groups/:id/requests
// @access  Private/GroupAdmin
export const getGroupJoinRequests = async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const groupId = req.params.id;
    const currentUserId = req.user.id;

    const group = await Group.findById(groupId).populate(
      "joined_users.user_id",
      "fullName username phone"
    );

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // Check if user is group admin
    if (group.group_admin.toString() !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized. Only group admin can view join requests.",
      });
    }

    const filteredRequests = group.joined_users.filter(
      (join) => join.status === status
    );

    res.status(200).json({
      success: true,
      count: filteredRequests.length,
      requests: filteredRequests,
    });
  } catch (error) {
    console.error("Get join requests error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get user's joined groups
// @route   GET /api/groups/my-groups
// @access  Private/User
export const getMyGroups = async (req, res) => {
  try {
    const userId = req.user.id;

    const groups = await Group.find({
      "joined_users.user_id": userId,
    })
      .populate("service_id", "title subtitle")
      .populate("group_admin", "fullName username")
      .select(
        "name description group_icon members_count is_private joined_users service_id group_admin"
      );

    const userGroups = groups.map((group) => ({
      ...group.toObject(),
      my_status: group.joined_users.find(
        (join) => join.user_id.toString() === userId
      )?.status,
    }));

    res.status(200).json({
      success: true,
      count: userGroups.length,
      groups: userGroups,
    });
  } catch (error) {
    console.error("Get my groups error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get pending groups for admin approval
// @route   GET /api/groups/pending
// @access  Private/Admin
export const getPendingGroups = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const groups = await Group.find({ approval_status: "pending" })
      .populate("service_id", "title subtitle")
      .populate("created_by", "fullName username")
      .populate("group_admin", "fullName username")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Group.countDocuments({ approval_status: "pending" });

    res.status(200).json({
      success: true,
      count: groups.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      groups,
    });
  } catch (error) {
    console.error("Get pending groups error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get groups by service
// @route   GET /api/groups/service/:serviceId
// @access  Public
export const getGroupsByService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const query = {
      service_id: serviceId,
      is_active: true,
      approval_status: "approved",
    };

    const groups = await Group.find(query)
      .populate("group_admin", "fullName username")
      .sort({ members_count: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Group.countDocuments(query);

    res.status(200).json({
      success: true,
      count: groups.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      groups,
    });
  } catch (error) {
    console.error("Get groups by service error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
