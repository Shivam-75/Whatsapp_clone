import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { getUsersForSidebar, blockUser, unblockUser } from "../controllers/user.controller.js";

const router = express.Router();

router.get("/", protectRoute, getUsersForSidebar);
router.post("/block/:id", protectRoute, blockUser);
router.post("/unblock/:id", protectRoute, unblockUser);

export default router;
