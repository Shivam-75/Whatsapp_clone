import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { createGroup, getGroups, addMember, deleteGroup, getGroupMessages, sendGroupMessage, deleteGroupMessages } from "../controllers/group.controller.js";

const router = express.Router();

router.post("/", protectRoute, createGroup);
router.get("/", protectRoute, getGroups);
router.post("/add-member", protectRoute, addMember);
router.delete("/:id", protectRoute, deleteGroup);
router.get("/:id/messages", protectRoute, getGroupMessages);
router.post("/:id/messages", protectRoute, sendGroupMessage);
router.post("/:id/messages/delete", protectRoute, deleteGroupMessages);

export default router;
