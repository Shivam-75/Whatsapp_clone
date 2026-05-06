import Group from "../models/Group.js";
import Message from "../models/Message.js";
import { io } from "../../index.js";

export const createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;
    const creatorId = req.user._id;

    if (!name || !members || !Array.isArray(members)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newGroup = new Group({
      name,
      admin: creatorId,
      members: [...new Set([...members, creatorId])],
    });

    await newGroup.save();
    const populated = await Group.findById(newGroup._id).populate("members", "username profilePic");
    
    // Notify all members about the new group
    populated.members.forEach(member => {
        io.emit("newGroup", { userId: String(member._id), groupId: populated._id });
    });

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({ members: userId })
        .populate("members", "username profilePic")
        .populate({
            path: "lastMessage",
            populate: { path: "senderId", select: "username" }
        });
    res.status(200).json(groups);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addMember = async (req, res) => {
  try {
    const { groupId, userId } = req.body;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (String(group.admin) !== String(req.user._id)) {
      return res.status(403).json({ error: "Only admin can add members" });
    }

    group.members.addToSet(userId);
    await group.save();

    res.status(200).json({ message: "Member added successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (String(group.admin) !== String(req.user._id)) {
      return res.status(403).json({ error: "Only admin can delete the group" });
    }

    await Group.findByIdAndDelete(groupId);

    // Notify all members that group is deleted
    group.members.forEach(memberId => {
       io.emit("groupDeleted", { userId: String(memberId), groupId });
    });

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteGroupMessages = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { messageIds } = req.body;
    const userId = req.user._id;

    const group = await Group.findOne({ _id: groupId, members: userId });
    if (!group) return res.status(404).json({ error: "Group not found or not a member" });

    // Validate that user is either the sender OR group admin
    const messages = await Message.find({ _id: { $in: messageIds }, groupId: groupId });
    const isAdmin = String(group.admin) === String(userId);

    const deletableIds = messages.filter(m => isAdmin || String(m.senderId) === String(userId)).map(m => m._id);

    if (deletableIds.length === 0) return res.status(403).json({ error: "No permission to delete selected messages" });

    // Cleanup files
    messages.forEach(msg => {
      if (deletableIds.includes(msg._id) && msg.image) deleteUploadedFile(msg.image);
    });

    await Message.deleteMany({ _id: { $in: deletableIds } });
    res.status(200).json({ message: "Messages deleted successfully", deletedCount: deletableIds.length });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { limit = 20, before } = req.query;
    const userId = req.user._id;

    const group = await Group.findOne({ _id: groupId, members: userId });
    if (!group) return res.status(404).json({ error: "Group not found or not a member" });

    const query = { groupId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("senderId", "username profilePic")
      .populate("replyTo");

    const chronologicalMessages = messages.reverse();

    res.status(200).json(chronologicalMessages);
  } catch (error) {
    console.error("Error in getGroupMessages:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { text, replyTo, isForwarded } = req.body;
    const senderId = req.user._id;

    const group = await Group.findOne({ _id: groupId, members: senderId });
    if (!group) return res.status(404).json({ error: "Group not found or not a member" });

    const newMessage = new Message({
      senderId,
      groupId,
      text,
      receiverId: null, // Explicitly null for group messages
      replyTo,
      isForwarded: isForwarded === true || isForwarded === "true",
    });

    await newMessage.save();
    
    // Update group's last message
    await Group.findByIdAndUpdate(groupId, { lastMessage: newMessage._id });

    const populated = await Message.findById(newMessage._id)
      .populate("senderId", "username profilePic")
      .populate("replyTo");

    io.emit("newGroupMessage", { ...populated.toObject(), groupId: String(groupId) }); 

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};
