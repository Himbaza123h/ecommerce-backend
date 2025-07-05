import Service from "../models/Service.js";
import { uploadImage, deleteImage } from "../config/cloudinary.js";
import Group from "../models/Group.js";

// @desc    Create a new service (Admin only)
// @route   POST /api/services
// @access  Private/Admin
export const createService = async (req, res) => {
  try {
    const { title, subtitle, description, is_active } = req.body;

    // Validation
    if (!title || !subtitle || !description) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required fields: title, subtitle, description",
      });
    }

    // Check if service with same title already exists
    const existingService = await Service.findOne({ title });
    if (existingService) {
      return res.status(400).json({
        success: false,
        message: "Service with this title already exists",
      });
    }

    let iconUrl = null;

    // Handle icon upload if provided
    if (req.file) {
      try {
        const fileStr = `data:${
          req.file.mimetype
        };base64,${req.file.buffer.toString("base64")}`;
        const iconResult = await uploadImage(fileStr, "services/icons");
        iconUrl = iconResult.url;
      } catch (error) {
        console.error("Icon upload error:", error);
        return res.status(400).json({
          success: false,
          message: "Icon upload failed",
        });
      }
    }

    // Create service
    const service = await Service.create({
      title,
      subtitle,
      description,
      icon: iconUrl || "default-icon-url",
      total_groups: 0,
      total_members: 0,
      is_active: is_active ? JSON.parse(is_active) : true,
    });

    res.status(201).json({
      success: true,
      message: "Service created successfully",
      service,
    });
  } catch (error) {
    console.error("Create service error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0],
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error during service creation",
    });
  }
};

// @desc    Get all services
// @route   GET /api/services
// @access  Public
export const getAllServices = async (req, res) => {
  try {
    const { page = 1, limit = 10, active_only = "true" } = req.query;

    const query = active_only === "true" ? { is_active: true } : {};

    const services = await Service.find(query)
      .sort({ total_groups: -1, total_members: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Service.countDocuments(query);

    res.status(200).json({
      success: true,
      count: services.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      services,
    });
  } catch (error) {
    console.error("Get services error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get single service with its groups
// @route   GET /api/services/:id
// @access  Public
export const getService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id).populate({
      path: "groups",
      populate: {
        path: "group_admin",
        select: "fullName username",
      },
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    res.status(200).json({
      success: true,
      service,
    });
  } catch (error) {
    console.error("Get service error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update service (Admin only)
// @route   PUT /api/services/:id
// @access  Private/Admin
export const updateService = async (req, res) => {
  try {
    const { title, subtitle, description, is_active } = req.body;
    const serviceId = req.params.id;

    let service = await Service.findById(serviceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Check if title is being updated and if it's already taken
    if (title && title !== service.title) {
      const existingService = await Service.findOne({
        title,
        _id: { $ne: serviceId },
      });

      if (existingService) {
        return res.status(400).json({
          success: false,
          message: "Service with this title already exists",
        });
      }
    }

    // Handle icon upload if provided
    let iconUrl = service.icon;
    if (req.file) {
      try {
        // Delete old icon if it exists and it's not the default
        if (service.icon && service.icon !== "default-icon-url") {
          const publicId = service.icon.split("/").pop().split(".")[0];
          await deleteImage(`services/icons/${publicId}`);
        }

        const fileStr = `data:${
          req.file.mimetype
        };base64,${req.file.buffer.toString("base64")}`;
        const iconResult = await uploadImage(fileStr, "services/icons");
        iconUrl = iconResult.url;
      } catch (error) {
        console.error("Icon upload error:", error);
        return res.status(400).json({
          success: false,
          message: "Icon upload failed",
        });
      }
    }

    service = await Service.findByIdAndUpdate(
      serviceId,
      {
        ...(title && { title }),
        ...(subtitle && { subtitle }),
        ...(description && { description }),
        ...(is_active !== undefined && { is_active: JSON.parse(is_active) }),
        icon: iconUrl,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "Service updated successfully",
      service,
    });
  } catch (error) {
    console.error("Update service error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0],
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error during service update",
    });
  }
};

// @desc    Delete service (Admin only)
// @route   DELETE /api/services/:id
// @access  Private/Admin
export const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }
    const groupsCount = await Group.countDocuments({
      service_id: req.params.id,
      is_active: true,
      approval_status: "approved",
    });

    if (groupsCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete service with existing groups. Please delete all groups first.",
      });
    }

    // Delete icon from cloudinary if it exists
    if (service.icon && service.icon !== "default-icon-url") {
      try {
        const publicId = service.icon.split("/").pop().split(".")[0];
        await deleteImage(`services/icons/${publicId}`);
      } catch (error) {
        console.error("Icon deletion error:", error);
      }
    }

    await Service.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    console.error("Delete service error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Activate service (Admin only)
// @route   PUT /api/services/:id/activate
// @access  Private/Admin
export const activateService = async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { is_active: true },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Service activated successfully",
      service,
    });
  } catch (error) {
    console.error("Activate service error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Deactivate service (Admin only)
// @route   PUT /api/services/:id/deactivate
// @access  Private/Admin
export const deactivateService = async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Service deactivated successfully",
      service,
    });
  } catch (error) {
    console.error("Deactivate service error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update service statistics (Admin only)
// @route   PUT /api/services/:id/update-stats
// @access  Private/Admin
export const updateServiceStats = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    await service.updateCounts();

    res.status(200).json({
      success: true,
      message: "Service statistics updated successfully",
      service,
    });
  } catch (error) {
    console.error("Update service stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Get service statistics (Admin only)
// @route   GET /api/services/:id/stats
// @access  Private/Admin
export const getServiceStats = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Get detailed stats
    const stats = await Group.aggregate([
      { $match: { service_id: service._id } },
      {
        $group: {
          _id: null,
          total_groups: { $sum: 1 },
          active_groups: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$is_active", true] },
                    { $eq: ["$approval_status", "approved"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          pending_groups: {
            $sum: {
              $cond: [{ $eq: ["$approval_status", "pending"] }, 1, 0],
            },
          },
          total_members: { $sum: "$members_count" },
          private_groups: {
            $sum: {
              $cond: [{ $eq: ["$is_private", true] }, 1, 0],
            },
          },
          public_groups: {
            $sum: {
              $cond: [{ $eq: ["$is_private", false] }, 1, 0],
            },
          },
        },
      },
    ]);

    const serviceStats =
      stats.length > 0
        ? stats[0]
        : {
            total_groups: 0,
            active_groups: 0,
            pending_groups: 0,
            total_members: 0,
            private_groups: 0,
            public_groups: 0,
          };

    res.status(200).json({
      success: true,
      service: {
        id: service._id,
        title: service.title,
        ...serviceStats,
      },
    });
  } catch (error) {
    console.error("Get service stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
