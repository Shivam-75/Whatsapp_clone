import express from "express";
import { protectRoute } from "../middleware/auth.js";
import upload, { uploadProfile } from "../middleware/upload.js";
import { register, login, checkAuth, updateProfile, logout } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/check", protectRoute, checkAuth);
router.put("/update-profile", protectRoute, uploadProfile, upload.single("profilePic"), updateProfile);
router.post("/logout", logout);

export default router;
