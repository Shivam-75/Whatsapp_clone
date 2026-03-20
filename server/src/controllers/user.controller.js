import User from "../models/User.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const q = req.query.q || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { _id: { $ne: loggedInUserId } };
    if (q) {
      query.username = { $regex: q, $options: "i" };
    }

    const totalUsers = await User.countDocuments(query);
    const users = await User.find(query)
      .select("-password")
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      users,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const blockUser = async (req, res) => {
  try {
    const { id: userToBlockId } = req.params;
    const myId = req.user._id;

    await User.findByIdAndUpdate(myId, { $addToSet: { blockedUsers: userToBlockId } });
    res.status(200).json({ message: "User blocked successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { id: userToUnblockId } = req.params;
    const myId = req.user._id;

    await User.findByIdAndUpdate(myId, { $pull: { blockedUsers: userToUnblockId } });
    res.status(200).json({ message: "User unblocked successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};
