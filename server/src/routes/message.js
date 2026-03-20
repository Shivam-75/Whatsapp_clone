import express from "express";
import { protectRoute } from "../middleware/auth.js";
import upload, { uploadMessage } from "../middleware/upload.js";
import { getMessages, sendMessage, markAsRead, deleteMessages, getLastMessages, clearChat, togglePinMessage, forwardMessage } from "../controllers/message.controller.js";

const router = express.Router();

router.get("/last-messages", protectRoute, getLastMessages);
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, uploadMessage, upload.single("image"), sendMessage);
router.post("/read/:id", protectRoute, markAsRead);
router.post("/delete-multiple", protectRoute, deleteMessages);
router.post("/clear/:id", protectRoute, clearChat);
router.post("/pin/:id", protectRoute, togglePinMessage);
router.post("/forward/:id", protectRoute, forwardMessage);

export default router;
