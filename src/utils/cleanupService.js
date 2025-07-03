export const cleanupServiceData = async (serviceId) => {
  try {
    const Group = mongoose.model('Group');
    
    // Delete all groups associated with this service
    const groups = await Group.find({ service_id: serviceId });
    
    for (const group of groups) {
      // Delete group icon from cloudinary if it exists
      if (group.group_icon && group.group_icon !== "default-group-icon-url") {
        try {
          const publicId = group.group_icon.split("/").pop().split(".")[0];
          await deleteImage(`groups/icons/${publicId}`);
        } catch (error) {
          console.error("Group icon deletion error:", error);
        }
      }
    }
    
    // Delete all groups
    await Group.deleteMany({ service_id: serviceId });
    
    console.log(`Cleanup completed for service ${serviceId}`);
  } catch (error) {
    console.error("Service cleanup error:", error);
    throw error;
  }
};