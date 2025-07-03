export const groupAdminAuth = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;
    
    const Group = mongoose.model('Group');
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
        message: "Access denied. Group admin or system admin required.",
      });
    }
    
    req.group = group;
    next();
  } catch (error) {
    console.error("Group admin auth error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};