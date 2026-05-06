import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import { io } from "socket.io-client";
import toast from "react-hot-toast";
import { useChatStore } from "./useChatStore";
import { useStatusStore } from "./useStatusStore";
import { useGroupStore } from "./useGroupStore";

const BASE_URL = import.meta.env.VITE_URL;

// --- localStorage helpers ---
const AUTH_KEY = "wa_auth_user";

const loadFromStorage = (key, defaultValue) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
};

const removeFromStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {}
};

export const useAuthStore = create((set, get) => ({
  authUser: loadFromStorage(AUTH_KEY, null),
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
      saveToStorage(AUTH_KEY, res.data);
      get().connectSocket();
    } catch (error) {
      set({ authUser: null });
      removeFromStorage(AUTH_KEY);
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/register", data);
      set({ authUser: res.data });
      saveToStorage(AUTH_KEY, res.data);
      toast.success("Account created successfully!");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.error || "Signup failed");
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      saveToStorage(AUTH_KEY, res.data);
      toast.success("Logged in successfully!");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.error || "Login failed");
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      removeFromStorage(AUTH_KEY);
      // Optional: Clear all other caches on logout
      localStorage.clear(); 
      toast.success("Logged out!");
      get().disconnectSocket();
    } catch (error) {
      toast.error("Logout failed");
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
      console.log("Socket connected:", socket.id);
      socket.emit("register", authUser._id);

      // Resubscribe all stores
      useChatStore.getState().subscribeToMessages();
      useStatusStore.getState().subscribeToStatusUpdates();
      useGroupStore.getState().subscribeToGroupUpdates();

      // Re-fetch essential data
      useChatStore.getState().getLastMessages();
    });
  },

  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
  },
}));
