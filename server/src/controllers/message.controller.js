import Message from "../models/Message.js";
import User from "../models/User.js";
import { io, getReceiverSocketId } from "../../index.js";
import { deleteUploadedFile } from "../middleware/upload.js";

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const { limit = 20, before } = req.query;
    const myId = req.user._id;

    const query = {
      $or: [
        { senderId: String(myId), receiverId: String(userToChatId) },
        { senderId: String(userToChatId), receiverId: String(myId) },
      ],
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("replyTo");

    // Reverse to return in chronological order for the frontend
    const chronologicalMessages = messages.reverse();

    res.status(200).json(chronologicalMessages);
  } catch (error) {
    console.error("ERROR in getMessages:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, disappearingDelay, replyTo, isForwarded } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;
    const delay = parseInt(disappearingDelay) || 0;

    let imageUrl;
    if (req.file) {
      imageUrl = `/uploads/messages/${req.file.filename}`;
    }

    console.log(`[BACKEND DEBUG] sendMessage: sender=${senderId}, receiver=${receiverId}, text="${text}"`);

    const messageData = {
      senderId,
      receiverId,
      text: text || "",
      image: imageUrl,
      disappearingDelay: delay,
      replyTo,
      isForwarded: isForwarded === "true" || isForwarded === true,
    };

    if (delay > 0) {
      messageData.expiresAt = new Date(Date.now() + delay * 1000);
    }

    const newMessage = new Message(messageData);
    await newMessage.save();
    console.log(`[BACKEND DEBUG] Message saved: ${newMessage._id}`);

    const populated = await Message.findById(newMessage._id).populate("replyTo");

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", populated);
    }

    res.status(201).json(populated);
  } catch (error) {
    console.error(`[BACKEND ERROR] sendMessage:`, error);
    res.status(500).json({ error: "Internal Server Error: " + error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id: senderId } = req.params;
    const readerId = req.user._id;

    await Message.updateMany(
      { senderId, receiverId: readerId, status: { $ne: "read" } },
      { $set: { status: "read" } }
    );

    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesRead", { readerId, isMe: false });
    }

    res.status(200).json({ message: "Messages marked as read" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteMessages = async (req, res) => {
  try {
    const { messageIds } = req.body;
    const userId = req.user._id;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: "No message IDs provided" });
    }

    // Allow deletion if user is either sender or receiver
    const messages = await Message.find({ 
      _id: { $in: messageIds }, 
      $or: [{ senderId: userId }, { receiverId: userId }] 
    });
    
    // Cleanup files for messages this user HAS permission to delete
    const authorizedIds = messages.map(m => m._id);
    messages.forEach(msg => {
      if (msg.image) deleteUploadedFile(msg.image);
    });

    await Message.deleteMany({ _id: { $in: authorizedIds } });

    res.status(200).json({ message: "Messages deleted successfully", deletedCount: authorizedIds.length });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const clearChat = async (req, res) => {
  try {
    const { id: otherUserId } = req.params;
    const myId = req.user._id;

    // Find all messages in the conversation for cleanup
    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: myId },
      ]
    });

    messages.forEach(msg => {
      if (msg.image) deleteUploadedFile(msg.image);
    });

    await Message.deleteMany({
      $or: [
        { senderId: myId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: myId },
      ]
    });

    res.status(200).json({ message: "Chat cleared successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const togglePinMessage = async (req, res) => {
  try {
    const { id: msgId } = req.params;
    const message = await Message.findById(msgId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    message.isPinned = !message.isPinned;
    await message.save();

    res.status(200).json(message);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const forwardMessage = async (req, res) => {
  try {
    const { id: msgId } = req.params;
    const { targetUserIds, targetGroupIds } = req.body; // Arrays of IDs
    const senderId = req.user._id;

    const originalMessage = await Message.findById(msgId);
    if (!originalMessage) return res.status(404).json({ error: "Message not found" });

    const newMessages = [];

    // Forward to Users
    if (targetUserIds && Array.isArray(targetUserIds)) {
      for (const targetUserId of targetUserIds) {
        const forwardedMsg = new Message({
          senderId,
          receiverId: targetUserId,
          text: originalMessage.text,
          image: originalMessage.image,
          isForwarded: true,
        });
        await forwardedMsg.save();
        newMessages.push(forwardedMsg);
        
        const receiverSocketId = getReceiverSocketId(targetUserId);
        if (receiverSocketId) io.to(receiverSocketId).emit("newMessage", forwardedMsg);
      }
    }

    // Forward to Groups
    if (targetGroupIds && Array.isArray(targetGroupIds)) {
      for (const targetGroupId of targetGroupIds) {
        const forwardedMsg = new Message({
          senderId,
          groupId: targetGroupId,
          text: originalMessage.text,
          image: originalMessage.image,
          isForwarded: true,
        });
        await forwardedMsg.save();
        newMessages.push(forwardedMsg);
        
        io.emit("newGroupMessage", { groupId: targetGroupId, message: forwardedMsg });
      }
    }

    res.status(201).json(newMessages);
  } catch (error) {
    console.error("Forward error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getLastMessages = async (req, res) => {
  try {
    const myId = req.user._id;

    const lastMessages = await Message.aggregate([
      { $match: { $or: [{ senderId: myId }, { receiverId: myId }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $gt: [{ $toString: "$senderId" }, { $toString: "$receiverId" }] },
              { s: "$senderId", r: "$receiverId" },
              { s: "$receiverId", r: "$senderId" },
            ],
          },
          lastMessage: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$lastMessage" } },
    ]);

    const users = await User.find({ _id: { $ne: myId } }).select("-password").lean();
    const result = users.map((user) => {
      const lastMsg = lastMessages.find(
        (m) => String(m.senderId) === String(user._id) || String(m.receiverId) === String(user._id)
      );
      return { ...user, lastMessage: lastMsg };
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};
