import express from "express";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { protectRoute } from "../middleware/auth.js";
import upload, { uploadProfile, deleteUploadedFile } from "../middleware/upload.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("Register data received:", { username, password: !!password });

    if (!username || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const userExists = await User.findOne({ username });
    if (userExists) {
      console.log("Registration failed: User exists", username);
      return res.status(400).json({ error: "Username already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      password: hashedPassword,
    });

    if (newUser) {
      await newUser.save();
      const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
        expiresIn: "1d",
      });

      res.cookie("jwt", token, {
        maxAge: 1 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "none",
        secure: process.env.NODE_ENV !== "development",
      });

      res.status(201).json({
        _id: newUser._id,
        username: newUser.username,
        profilePic: newUser.profilePic,
      });
    } else {
      res.status(400).json({ error: "Invalid user data" });
    }
  } catch (error) {
    console.error("Error in register controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.cookie("jwt", token, {
      maxAge: 15 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "none",
      secure: process.env.NODE_ENV !== "development",
    });

    res.status(200).json({
      _id: user._id,
      username: user.username,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.error("Error in login controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/check", protectRoute, (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.error("Error in checkAuth controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/update-profile", protectRoute, uploadProfile, upload.single("profilePic"), async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = {};

    // Handle about field
    if (req.body.about !== undefined) {
      updateData.about = req.body.about;
    }

    // Handle profile pic file upload
    if (req.file) {
      // Delete old profile pic from disk
      const currentUser = await User.findById(userId);
      if (currentUser?.profilePic && currentUser.profilePic.startsWith("/uploads/")) {
        deleteUploadedFile(currentUser.profilePic);
      }
      updateData.profilePic = `/uploads/profiles/${req.file.filename}`;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select("-password");

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error in update profile", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/logout", (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logout controller", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
