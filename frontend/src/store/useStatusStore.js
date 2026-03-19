import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";

export const useStatusStore = create((set, get) => ({
  statuses: [],          // grouped contact statuses
  myStatuses: [],        // my own statuses
  isLoading: false,
  isCreating: false,

  fetchStatuses: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get("/status");
      set({ statuses: res.data });
    } catch (error) {
      console.error("Error fetching statuses:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMyStatuses: async () => {
    try {
      const res = await axiosInstance.get("/status/my");
      set({ myStatuses: res.data });
    } catch (error) {
      console.error("Error fetching my statuses:", error);
    }
  },

  createStatus: async (statusData) => {
    set({ isCreating: true });
    try {
      await axiosInstance.post("/status", statusData);
      toast.success("Status posted!");
      // Refresh both lists
      get().fetchMyStatuses();
      get().fetchStatuses();
    } catch (error) {
      toast.error("Failed to post status");
      console.error("Error creating status:", error);
    } finally {
      set({ isCreating: false });
    }
  },

  viewStatus: async (statusId) => {
    try {
      await axiosInstance.post(`/status/${statusId}/view`);
    } catch (error) {
      console.error("Error viewing status:", error);
    }
  },

  deleteStatus: async (statusId) => {
    try {
      await axiosInstance.delete(`/status/${statusId}`);
      toast.success("Status deleted");
      get().fetchMyStatuses();
    } catch (error) {
      toast.error("Failed to delete status");
      console.error("Error deleting status:", error);
    }
  },

  // Real-time socket listeners
  subscribeToStatusUpdates: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newStatus"); // prevent duplicates
    socket.on("newStatus", () => {
      console.log("🔔 Socket: newStatus received, refreshing...");
      get().fetchStatuses();
      get().fetchMyStatuses();
    });
  },

  unsubscribeFromStatusUpdates: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) socket.off("newStatus");
  },
}));
