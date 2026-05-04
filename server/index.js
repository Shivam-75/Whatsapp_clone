import express from "express";
import { config } from "dotenv";
import compression from "compression";
import cookieParser from "cookie-parser";
import Db from "./src/database/Db.js";
import cors from "cors";
import morgan from "morgan";
import http from "http";
import { Server } from "socket.io";
import authRoutes from "./src/routes/auth.js";
import userRoutes from "./src/routes/user.js";
import messageRoutes from "./src/routes/message.js";
import statusRoutes from "./src/routes/status.js";
import groupRoutes from "./src/routes/group.js";

config();

const PORT = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app);

// Setup Socket.IO
export const io = new Server(server, {
  cors: {
    origin: "*",
    credentials: true,
  },
});

app.use(cors({
  origin: [process.env.CLIENT_URL, "https://whatsapp-novopcyl2-ss-projects-38a3890a.vercel.app/"],
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

// Trust proxy for secure cookies in production
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Serve static uploads
app.use("/uploads", express.static("public/uploads"));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/groups", groupRoutes);

app.get("/", (req, res) => {
  res.send("Welcome to WhatsApp Clone API with Socket.io!");
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "production" ? {} : err.message
  });
});

// Socket.io connection logic
const userSocketMap = {}; // userId : socketId (tracks at least one active socket for online status)

io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;
  if (userId) {
    userSocketMap[userId] = socket.id;
    socket.join(userId);

    // JOIN ALL GROUP ROOMS
    try {
      const Group = (await import("./src/models/Group.js")).default;
      const groups = await Group.find({ members: userId });
      groups.forEach(group => {
        socket.join(String(group._id));
        console.log(`Socket ${socket.id} auto-joined group: ${group.name}`);
      });
    } catch (err) {
      console.error("Error joining groups on connect:", err);
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  }

  socket.on("joinGroup", (groupId) => {
    socket.join(String(groupId));
    console.log(`Socket ${socket.id} joined group room: ${groupId}`);
  });

  socket.on("register", (senderId) => {
    userSocketMap[senderId] = socket.id;
    socket.join(senderId);
    console.log("User manually registered:", senderId);
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });

  socket.on("messageDelivered", async ({ messageId, senderId }) => {
    try {
      const Message = (await import("./src/models/Message.js")).default;
      const msg = await Message.findByIdAndUpdate(messageId, { status: "delivered" }, { new: true });
      if (msg) {
        const senderSocketId = userSocketMap[senderId];
        if (senderSocketId) {
          io.to(senderSocketId).emit("messageDelivered", { messageId: msg._id, status: "delivered" });
        }
      }
    } catch (err) {
    }
  });

  socket.on("typingStart", ({ receiverId }) => {
    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userTyping", { senderId: userId, isTyping: true });
    }
  });

  socket.on("typingStop", ({ receiverId }) => {
    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userTyping", { senderId: userId, isTyping: false });
    }
  });

  socket.on("disconnect", () => {
    for (let user in userSocketMap) {
      if (userSocketMap[user] === socket.id) {
        delete userSocketMap[user];
      }
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export const getReceiverSocketId = (receiverId) => {
  if (!receiverId) return null;
  const idStr = String(receiverId);
  return userSocketMap[idStr] ? idStr : null;
};

// Initialize database and start server
Db()
  .then(() => {
    if (process.env.NODE_ENV !== "production") {
      server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    }
  })
  .catch((err) => {
    console.error("Failed to connect to database:", err);
  });

export default app;