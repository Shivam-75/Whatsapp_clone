import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";

export const useGroupStore = create((set, get) => ({
  groups: [],
  selectedGroup: null,
  groupMessages: [],
  isLoading: false,
  isMessagesLoading: false,

  fetchGroups: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get("/groups");
      set({ groups: res.data });
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  createGroup: async (data) => {
    try {
      const res = await axiosInstance.post("/groups", data);
      toast.success("Group created!");
      get().fetchGroups();
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create group");
      console.error("Error creating group:", error);
      return null;
    }
  },

  setSelectedGroup: (group) => {
    set({ selectedGroup: group, groupMessages: [] });
  },

  fetchGroupMessages: async (groupId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/groups/${groupId}/messages?limit=40`);
      set({ groupMessages: res.data });
    } catch (error) {
      console.error("Error fetching group messages:", error);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendGroupMessage: async (groupId, messageData) => {
    try {
      const res = await axiosInstance.post(`/groups/${groupId}/messages`, messageData);
      set(state => ({ groupMessages: [...state.groupMessages, res.data] }));
    } catch (error) {
      console.error("Error sending group message:", error);
    }
  },

  // Socket listeners
  subscribeToGroupUpdates: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newGroupMessage");
    socket.off("newGroup");

    socket.on("newGroupMessage", (message) => {
      const { selectedGroup, groupMessages } = get();
      const myId = String(useAuthStore.getState().authUser?._id);
      const senderId = String(message.senderId?._id || message.senderId);

      // Skip if I sent this message (already added via API response)
      if (senderId === myId) {
        get().fetchGroups(); // still refresh group list for last message
        return;
      }

      // If this group chat is open, add message to view
      if (selectedGroup && String(message.groupId) === String(selectedGroup._id)) {
        const exists = groupMessages.some(m => String(m._id) === String(message._id));
        if (!exists) {
          set({ groupMessages: [...groupMessages, message] });
        }
      }
      // Refresh groups list to update last message
      get().fetchGroups();
    });

    socket.on("newGroup", () => {
      get().fetchGroups();
    });
  },

  unsubscribeFromGroupUpdates: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newGroupMessage");
      socket.off("newGroup");
    }
  },
}));
