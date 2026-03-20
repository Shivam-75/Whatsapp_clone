import Status from "../models/Status.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { io } from "../../index.js";
import { deleteUploadedFile } from "../middleware/upload.js";

export const createStatus = async (req, res) => {
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

    if (type === "image" && req.file) {
      statusData.content = `/uploads/status/${req.file.filename}`;
    } else if (content) {
      statusData.content = content;
    } else {
      return res.status(400).json({ error: "Content is required" });
    }

    const newStatus = new Status(statusData);
    await newStatus.save();
    
    const populated = await Status.findById(newStatus._id).populate("userId", "username profilePic");
    io.emit("newStatus", { userId: String(userId) });
    
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getMyStatuses = async (req, res) => {
  try {
    const statuses = await Status.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate("userId", "username profilePic")
      .populate("viewers.userId", "username profilePic");

    res.status(200).json(statuses);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getContactStatuses = async (req, res) => {
  try {
    const myId = req.user._id;
    const sentTo = await Message.distinct("receiverId", { senderId: myId });
    const receivedFrom = await Message.distinct("senderId", { receiverId: myId });
    
    const contactIdSet = new Set([...sentTo.map(String), ...receivedFrom.map(String)]);
    const contactIds = [...contactIdSet];

    if (contactIds.length === 0) return res.status(200).json([]);

    const statuses = await Status.find({ userId: { $in: contactIds } })
      .sort({ createdAt: -1 })
      .populate("userId", "username profilePic")
      .populate("viewers.userId", "username profilePic");

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
      const viewed = status.viewers.some(v => String(v.userId?._id || v.userId) === String(myId));
      if (!viewed) grouped[uid].hasUnviewed = true;
    });

    const result = Object.values(grouped).sort((a, b) => {
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return new Date(b.latestAt) - new Date(a.latestAt);
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const viewStatus = async (req, res) => {
  try {
    const statusId = req.params.id;
    const viewerId = req.user._id;

    const result = await Status.findOneAndUpdate(
      { _id: statusId, userId: { $ne: viewerId }, "viewers.userId": { $ne: viewerId } },
      { $push: { viewers: { userId: viewerId, viewedAt: new Date() } } },
      { new: true }
    );

    if (!result) return res.status(200).json({ message: "Already viewed or own status" });
    res.status(200).json({ message: "Status viewed" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteStatus = async (req, res) => {
  try {
    const status = await Status.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!status) return res.status(404).json({ error: "Status not found" });

    if (status.type === "image" && status.content && status.content.startsWith("/uploads/")) {
      deleteUploadedFile(status.content);
    }

    res.status(200).json({ message: "Status deleted" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};
