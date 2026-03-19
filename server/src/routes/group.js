import express from "express";
import { protectRoute } from "../middleware/auth.js";
import Group from "../models/Group.js";
import GroupMessage from "../models/GroupMessage.js";
import { io } from "../../index.js";

const router = express.Router();

// Create a new group
router.post("/", protectRoute, async (req, res) => {
  try {
    const { name, description, memberIds } = req.body;
    const adminId = req.user._id;

    if (!name || !memberIds || memberIds.length === 0) {
      return res.status(400).json({ error: "Group name and members are required" });
    }

    // Ensure admin is included in members
    const allMembers = [...new Set([String(adminId), ...memberIds])];

    const group = new Group({
      name,
      description: description || "",
      admin: adminId,
      members: allMembers,
    });

    await group.save();
    const populated = await Group.findById(group._id)
      .populate("members", "username profilePic")
      .populate("admin", "username profilePic");

    // Notify all members
    allMembers.forEach(memberId => {
      io.to(memberId).emit("newGroup", populated);
    });

    res.status(201).json(populated);
  } catch (error) {
    console.error("Error creating group:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get my groups
router.get("/", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({ members: userId })
      .populate("members", "username profilePic")
      .populate("admin", "username profilePic")
      .sort({ updatedAt: -1 });

    // Get last message for each group
    const groupsWithLastMsg = await Promise.all(
      groups.map(async (group) => {
        const lastMessage = await GroupMessage.findOne({ groupId: group._id })
          .sort({ createdAt: -1 })
          .populate("senderId", "username")
          .lean();
        return { ...group.toObject(), lastMessage };
      })
    );

    res.status(200).json(groupsWithLastMsg);
  } catch (error) {
    console.error("Error fetching groups:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get group messages
router.get("/:id/messages", protectRoute, async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const limit = parseInt(req.query.limit) || 40;
    const before = req.query.before;

    const query = { groupId };
    if (before) query.createdAt = { $lt: new Date(before) };

    const messages = await GroupMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("senderId", "username profilePic")
      .lean();

    res.status(200).json(messages.reverse());
  } catch (error) {
    console.error("Error fetching group messages:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Send message to group
router.post("/:id/messages", protectRoute, async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { text, image } = req.body;
    const senderId = req.user._id;

    // Verify user is a member
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (!group.members.map(String).includes(String(senderId))) {
      return res.status(403).json({ error: "Not a member of this group" });
    }

    const msg = new GroupMessage({ groupId, senderId, text, image });
    await msg.save();

    const populated = await GroupMessage.findById(msg._id)
      .populate("senderId", "username profilePic")
      .lean();

    // Emit to all group members
    group.members.forEach(memberId => {
      io.to(String(memberId)).emit("newGroupMessage", {
        ...populated,
        groupId: String(groupId),
        groupName: group.name,
      });
    });

    res.status(201).json(populated);
  } catch (error) {
    console.error("Error sending group message:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get group info
router.get("/:id", protectRoute, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate("members", "username profilePic")
      .populate("admin", "username profilePic");
    if (!group) return res.status(404).json({ error: "Group not found" });
    res.status(200).json(group);
  } catch (error) {
    console.error("Error fetching group:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
