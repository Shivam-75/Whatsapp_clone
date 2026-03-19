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
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true 
}));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

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

// Socket.io connection logic
const userSocketMap = {}; // userId : socketId (tracks at least one active socket for online status)

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  if (userId) {
     userSocketMap[userId] = socket.id;
     socket.join(userId); // Join a room named after the userId
     console.log(`User ${userId} connected (Socket: ${socket.id})`);
     io.emit("getOnlineUsers", Object.keys(userSocketMap));
  } else {
     console.log("User connected without userId", socket.id);
  }

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
       console.error("Error in messageDelivered socket handler:", err);
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
    console.log("User disconnected", socket.id);
    for (let user in userSocketMap) {
      if (userSocketMap[user] === socket.id) {
        delete userSocketMap[user];
      }
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export const getReceiverSocketId = (receiverId) => {
  // We use rooms now, so return the room name (userId) if user is online
  return userSocketMap[receiverId] ? receiverId : null;
};

Db().then(() => {
  server.listen(PORT, "0.0.0.0", () =>
    console.log("🚀 Server & Socket.io running at http://localhost:" + PORT)
  );
}).catch(err => {
  console.error("Database connection failed", err);
});