import express from "express";
import { protectRoute } from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();

router.get("/", protectRoute, async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const q = req.query.q?.trim() || "";
    const skip = (page - 1) * limit;

    const baseFilter = { _id: { $ne: loggedInUserId } };
    if (q) {
      baseFilter.username = { $regex: q, $options: "i" }; // case-insensitive search
    }

    const [users, total] = await Promise.all([
      User.find(baseFilter)
        .select("-password")
        .sort({ createdAt: -1 }) // Most recently registered first
        .skip(skip)
        .limit(limit),
      User.countDocuments(baseFilter)
    ]);

    res.status(200).json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error("Error in getUserForSidebar controller:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;

