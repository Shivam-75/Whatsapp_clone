import express from "express";
import { protectRoute } from "../middleware/auth.js";
import Status from "../models/Status.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { io } from "../../index.js";
import upload, { uploadStatus, deleteUploadedFile } from "../middleware/upload.js";

const router = express.Router();

// Create a new status (supports file upload for images)
router.post("/", protectRoute, uploadStatus, upload.single("image"), async (req, res) => {
  try {
    const { type, content, backgroundColor, caption } = req.body;
    const userId = req.user._id;

    if (!type) {
      return res.status(400).json({ error: "Type is required" });
    }

    const statusData = {
      userId,
      type,
      backgroundColor: backgroundColor || "#00a884",
      caption: caption || "",
    };

    // For image type: use uploaded file path
    if (type === "image" && req.file) {
      statusData.content = `/uploads/statuses/${req.file.filename}`;
    } else if (content) {
      statusData.content = content;
    } else {
      return res.status(400).json({ error: "Content is required" });
    }

    const newStatus = new Status(statusData);
    await newStatus.save();
    
    // Populate user info before returning
    const populated = await Status.findById(newStatus._id).populate("userId", "username profilePic");
    
    // Broadcast to all connected clients so status appears in real-time
    io.emit("newStatus", { userId: String(userId) });
    
    res.status(201).json(populated);
  } catch (error) {
    console.error("Error creating status:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get my statuses
router.get("/my", protectRoute, async (req, res) => {
  try {
    const statuses = await Status.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate("userId", "username profilePic")
      .populate("viewers.userId", "username profilePic");

    res.status(200).json(statuses);
  } catch (error) {
    console.error("Error fetching my statuses:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get contact statuses (only from users you've chatted with)
router.get("/", protectRoute, async (req, res) => {
  try {
    const myId = req.user._id;
    
    // Step 1: Find all unique user IDs that the current user has exchanged messages with
    const sentTo = await Message.distinct("receiverId", { senderId: myId });
    const receivedFrom = await Message.distinct("senderId", { receiverId: myId });
    
    // Combine and deduplicate contact IDs
    const contactIdSet = new Set([
      ...sentTo.map(String),
      ...receivedFrom.map(String),
    ]);
    const contactIds = [...contactIdSet];

    if (contactIds.length === 0) {
      return res.status(200).json([]);
    }

    // Step 2: Only fetch statuses from these chat contacts
    const statuses = await Status.find({ userId: { $in: contactIds } })
      .sort({ createdAt: -1 })
      .populate("userId", "username profilePic")
      .populate("viewers.userId", "username profilePic");

    // Group by user
    const grouped = {};
    statuses.forEach((status) => {
      const uid = String(status.userId._id);
      if (!grouped[uid]) {
        grouped[uid] = {
          user: status.userId,
          statuses: [],
          hasUnviewed: false,
          latestAt: status.createdAt,
        };
      }
      grouped[uid].statuses.push(status);
      // Check if current user has NOT viewed this status
      const viewed = status.viewers.some(
        (v) => String(v.userId?._id || v.userId) === String(myId)
      );
      if (!viewed) grouped[uid].hasUnviewed = true;
    });

    // Convert to array and sort: unviewed first, then by latest
    const result = Object.values(grouped).sort((a, b) => {
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return new Date(b.latestAt) - new Date(a.latestAt);
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching statuses:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Mark a status as viewed (atomic, prevents duplicates)
router.post("/:id/view", protectRoute, async (req, res) => {
  try {
    const statusId = req.params.id;
    const viewerId = req.user._id;

    // Atomic: only add viewer if not already present and not the owner
    const result = await Status.findOneAndUpdate(
      {
        _id: statusId,
        userId: { $ne: viewerId },  // not own status
        "viewers.userId": { $ne: viewerId },  // not already viewed
      },
      {
        $push: { viewers: { userId: viewerId, viewedAt: new Date() } },
      },
      { new: true }
    );

    if (!result) {
      return res.status(200).json({ message: "Already viewed or own status" });
    }

    res.status(200).json({ message: "Status viewed" });
  } catch (error) {
    console.error("Error marking status as viewed:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete a status (also delete image from disk)
router.delete("/:id", protectRoute, async (req, res) => {
  try {
    const status = await Status.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!status) return res.status(404).json({ error: "Status not found" });

    // Delete image file from disk if it's an uploaded file
    if (status.type === "image" && status.content && status.content.startsWith("/uploads/")) {
      deleteUploadedFile(status.content);
    }

    res.status(200).json({ message: "Status deleted" });
  } catch (error) {
    console.error("Error deleting status:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
