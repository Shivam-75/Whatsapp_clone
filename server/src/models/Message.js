import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional for group messages
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: false,
    },
    text: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      default: "",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    disappearingDelay: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      index: { expires: 0 }, // TTL index
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: false,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isForwarded: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes for fast paginated queries
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });
messageSchema.index({ groupId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
