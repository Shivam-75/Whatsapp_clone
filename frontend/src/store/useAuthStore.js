import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import { io } from "socket.io-client";
import toast from "react-hot-toast";
import { useChatStore } from "./useChatStore";

const BASE_URL = "http://localhost:5001";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/register", data);
      set({ authUser: res.data });
      toast.success("Account created successfully!");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.error || "Signup failed");
      console.log("Signup error:", error);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully!");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.error || "Login failed");
      console.log("Login error:", error);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out!");
      get().disconnectSocket();
    } catch (error) {
      toast.error("Logout failed");
      console.log("Logout error:", error);
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const isFormData = data instanceof FormData;
      const res = await axiosInstance.put("/auth/update-profile", data, isFormData ? {
        headers: { "Content-Type": "multipart/form-data" },
      } : {});
      set({ authUser: res.data });
      toast.success("Profile updated!");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || "Update failed");
      console.log("Error in update profile:", error);
      return false;
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    const socket = io(BASE_URL, {
      query: { userId: authUser._id },
    });
    socket.connect();

    set({ socket: socket });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    // Register message listeners immediately when socket is ready
    // This closes the race condition window between socket connect and App.jsx useEffect
    socket.on("connect", () => {
      console.log("✅ Socket connected — setting up message subscriptions");
      useChatStore.getState().subscribeToMessages();
      // Re-fetch unread counts from DB so badge is always accurate after refresh
      useChatStore.getState().getLastMessages();
    });
  },

  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
  },
}));
