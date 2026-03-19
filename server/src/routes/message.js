import express from "express";
import { protectRoute } from "../middleware/auth.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { getReceiverSocketId, io } from "../../index.js";
import upload, { uploadMessage, deleteUploadedFile } from "../middleware/upload.js";

const router = express.Router();

router.get("/last-messages", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id;
    const lastMessages = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { receiverId: userId }],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { $cond: [{ $eq: ["$senderId", userId] }, "$receiverId", "$senderId"] },
          lastMessage: { $first: "$$ROOT" },
          unreadCount: { 
            $sum: { 
              $cond: [
                { 
                  $and: [
                    { $eq: ["$receiverId", userId] },
                    { $ne: ["$status", "read"] }
                  ] 
                }, 1, 0
              ] 
            } 
          }
        },
      },
    ]);
    res.status(200).json(lastMessages);
  } catch (error) {
    console.error("Error in last-messages controller:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", protectRoute, async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const senderId = req.user._id;
    const limit = parseInt(req.query.limit) || 40;
    const before = req.query.before; // ISO timestamp cursor

    const baseQuery = {
      $or: [
        { senderId: senderId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: senderId },
      ],
    };

    // If a cursor is provided, only fetch messages BEFORE that timestamp
    if (before) {
      baseQuery.createdAt = { $lt: new Date(before) };
    }

    // Fetch newest-first then reverse to return chronological order
    const messages = await Message.find(baseQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json(messages.reverse());
  } catch (error) {
    console.error("Error in getMessages controller:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/send/:id", protectRoute, uploadMessage, upload.single("image"), async (req, res) => {
  try {
    const { text } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    const receiverSocketId = getReceiverSocketId(receiverId);
    const initialStatus = receiverSocketId ? "delivered" : "sent";

    const messageData = {
      senderId,
      receiverId,
      text: text || "",
      status: initialStatus,
    };

    // If file uploaded via multer, use file path
    if (req.file) {
      messageData.image = `/uploads/messages/${req.file.filename}`;
    }

    const newMessage = new Message(messageData);
    await newMessage.save();

    // Prepare message with sender info for notification
    const messagePayload = {
      ...newMessage.toObject(),
      senderName: req.user.username
    };

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", messagePayload);
    }

    res.status(201).json(messagePayload);
  } catch (error) {
    console.error("Error in sendMessage controller:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/read/:id", protectRoute, async (req, res) => {
  try {
    const { id: senderId } = req.params;
    const receiverId = req.user._id;

    await Message.updateMany(
      { senderId, receiverId, status: { $ne: "read" } },
      { $set: { status: "read", isRead: true } }
    );

    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesRead", { readerId: receiverId });
      // Sync read status to receiver's other tabs
      io.to(receiverId).emit("messagesRead", { readerId: senderId, isMe: true });
    }

    res.status(200).json({ message: "Messages marked as read" });
  } catch (error) {
    console.error("Error in markAsRead controller:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/delete", protectRoute, async (req, res) => {
  try {
    const { messageIds } = req.body;
    const userId = req.user._id;
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: "No message IDs provided" });
    }

    // Find messages first to delete their image files
    const messages = await Message.find({
      _id: { $in: messageIds },
      $or: [{ senderId: userId }, { receiverId: userId }]
    });

    // Delete image files from disk
    messages.forEach(msg => {
      if (msg.image && msg.image.startsWith("/uploads/")) {
        deleteUploadedFile(msg.image);
      }
    });

    // Allow deleting any message where user is sender OR receiver
    const result = await Message.deleteMany({
      _id: { $in: messageIds },
      $or: [{ senderId: userId }, { receiverId: userId }]
    });
    res.status(200).json({ deleted: result.deletedCount });
  } catch (error) {
    console.error("Error deleting messages:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
