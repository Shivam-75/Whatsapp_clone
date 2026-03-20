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
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMyStatuses: async () => {
    try {
      const res = await axiosInstance.get("/status/my");
      set({ myStatuses: res.data });
    } catch (error) {
    }
  },

  createStatus: async (statusData) => {
    set({ isCreating: true });
    try {
      let payload = statusData;
      let headers = {};

      if (statusData.type === "image" && statusData.image) {
        const formData = new FormData();
        formData.append("type", "image");
        formData.append("image", statusData.image);
        if (statusData.caption) formData.append("caption", statusData.caption);
        payload = formData;
        headers = { "Content-Type": "multipart/form-data" };
      }

      await axiosInstance.post("/status", payload, { headers });
      toast.success("Status posted!");
      // Refresh both lists
      get().fetchMyStatuses();
      get().fetchStatuses();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to post status");
    } finally {
      set({ isCreating: false });
    }
  },

  viewStatus: async (statusId) => {
    try {
      await axiosInstance.post(`/status/${statusId}/view`);
    } catch (error) {
    }
  },

  deleteStatus: async (statusId) => {
    try {
      await axiosInstance.delete(`/status/${statusId}`);
      toast.success("Status deleted");
      get().fetchMyStatuses();
    } catch (error) {
      toast.error("Failed to delete status");
    }
  },

  // Real-time socket listeners
  subscribeToStatusUpdates: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newStatus"); // prevent duplicates
    socket.on("newStatus", () => {
      get().fetchStatuses();
      get().fetchMyStatuses();
    });
  },

  unsubscribeFromStatusUpdates: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) socket.off("newStatus");
  },
}));
