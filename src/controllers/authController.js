import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { sendWelcomeEmail } from "../utils/emailService.js";

// Helper function to send token response
const sendTokenResponse = (user, statusCode, res, message) => {
  const token = user.generateToken();

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  res
    .status(statusCode)
    .cookie("token", token, options)
    .json({
      success: true,
      message,
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { fullName, username, email, phone, password } = req.body;

    // Validation
    if (!fullName || !username || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }, { phone }],
    });

    if (existingUser) {
      let field = "User";
      if (existingUser.username === username) field = "Username";
      else if (existingUser.email === email) field = "Email";
      else if (existingUser.phone === phone) field = "Phone number";

      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    // Create user
    const user = await User.create({
      fullName,
      username,
      email,
      phone,
      password,
    });

    // Send welcome email (don't block registration if email fails)
    try {
      await sendWelcomeEmail(user.fullName, user.email);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Continue with registration even if email fails
    }

    sendTokenResponse(user, 201, res, "User registered successfully");
  } catch (error) {
    console.error("Register error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0],
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Validation
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide username/email/phone and password",
      });
    }

    // Find user by username, email, or phone and include password
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier },
        { phone: identifier },
      ],
      isActive: true,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    sendTokenResponse(user, 200, res, "Login successful");
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  try {
    res.cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during logout",
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const { fullName, email, phone } = req.body;
    const userId = req.user.id;

    // Check if email or phone is being updated and if they're already taken
    if (email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: userId },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    if (phone) {
      const existingUser = await User.findOne({
        phone,
        _id: { $ne: userId },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Phone number already exists",
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        ...(fullName && { fullName }),
        ...(email && { email }),
        ...(phone && { phone }),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update profile error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0],
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// @desc    Get single user by ID (Admin only)
// @route   GET /api/auth/users/:id
// @access  Private/Admin
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user",
    });
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      active_only = "false",
      role = "",
      search = "",
    } = req.query;

    // Build query object
    let query = {};

    // Filter by active status
    if (active_only === "true") {
      query.isActive = true;
    }

    // Filter by role
    if (role && role !== "") {
      query.role = role;
    }

    // Search functionality
    if (search && search.trim() !== "") {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { fullName: searchRegex },
        { username: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    // Execute query with pagination
    const users = await User.find(query)
      .select("-password") // Exclude password field
      .sort({ createdAt: -1 }) // Sort by newest first
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Get total count for pagination
    const total = await User.countDocuments(query);

    // Get user statistics
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
          },
          inactiveUsers: {
            $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] },
          },
          adminUsers: {
            $sum: { $cond: [{ $eq: ["$role", "admin"] }, 1, 0] },
          },
          regularUsers: {
            $sum: { $cond: [{ $eq: ["$role", "user"] }, 1, 0] },
          },
        },
      },
    ]);

    const userStats =
      stats.length > 0
        ? stats[0]
        : {
            totalUsers: 0,
            activeUsers: 0,
            inactiveUsers: 0,
            adminUsers: 0,
            regularUsers: 0,
          };

    // Return clean array format for frontend
    res.status(200).json({
      success: true,
      data: users, // Array of users for easy frontend iteration
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalUsers: total,
        usersPerPage: parseInt(limit),
        hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrev: parseInt(page) > 1,
      },
      stats: userStats,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching users",
      data: [], // Return empty array on error
    });
  }
};
