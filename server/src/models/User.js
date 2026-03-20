import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    profilePic: {
      type: String,
      default: "",
    },
    about: {
      type: String,
      default: "Hey there! I am using WhatsApp.",
    },
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    disappearingDelay: {
      type: Number,
      default: 0, // 0 = off, otherwise seconds (e.g., 86400 for 24h)
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
