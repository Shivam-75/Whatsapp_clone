import mongoose from "mongoose";

const statusSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "image"],
      required: true,
    },
    content: {
      type: String,
      required: true, // text content or base64/URL for image
    },
    backgroundColor: {
      type: String,
      default: "#00a884", // for text statuses
    },
    caption: {
      type: String,
      default: "",
    },
    viewers: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// TTL index — auto-delete after 24 hours (86400 seconds)
statusSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

const Status = mongoose.model("Status", statusSchema);
export default Status;
