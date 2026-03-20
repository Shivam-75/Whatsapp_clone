import express from "express";
import { protectRoute } from "../middleware/auth.js";
import upload, { uploadStatus } from "../middleware/upload.js";
import { createStatus, getMyStatuses, getContactStatuses, viewStatus, deleteStatus } from "../controllers/status.controller.js";

const router = express.Router();

router.post("/", protectRoute, uploadStatus, upload.single("image"), createStatus);
router.get("/my", protectRoute, getMyStatuses);
router.get("/", protectRoute, getContactStatuses);
router.post("/:id/view", protectRoute, viewStatus);
router.delete("/:id", protectRoute, deleteStatus);

export default router;
