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
  replyingTo: null,

  setReplyingTo: (msg) => set({ replyingTo: msg }),

  pinMessage: async (msgId) => {
    try {
      const res = await axiosInstance.post(`/messages/pin/${msgId}`);
      set((state) => ({
        groupMessages: state.groupMessages.map(m => m._id === msgId ? res.data : m)
      }));
    } catch (err) {
      toast.error("Failed to pin message");
    }
  },

  forwardMessage: async (msgId, targetUserIds, targetGroupIds) => {
    const loadingToast = toast.loading("Forwarding...");
    try {
      await axiosInstance.post(`/messages/forward/${msgId}`, { targetUserIds, targetGroupIds });
      toast.success("Message forwarded", { id: loadingToast });
    } catch (err) {
      toast.error("Failed to forward message", { id: loadingToast });
    }
  },

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
    if (group) get().fetchGroupMessages(group._id);
  },

  fetchGroupMessages: async (groupId) => {
    const { groupMessages } = get();
    const optimisticMsgs = groupMessages.filter(m => m.isOptimistic && String(m.groupId) === String(groupId));
    
    // Join group room
    const socket = useAuthStore.getState().socket;
    if (socket) {
        socket.emit("joinGroup", groupId);
    }

    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/groups/${groupId}/messages?limit=40`);
      set({ groupMessages: [...res.data, ...optimisticMsgs] });
    } catch (error) {
      console.error("Error fetching group messages:", error);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendGroupMessage: async (groupId, messageData) => {
    const { groupMessages } = get();
    const authUser = useAuthStore.getState().authUser;
    if (!authUser) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      senderId: {
        _id: authUser._id,
        username: authUser.username,
        profilePic: authUser.profilePic
      },
      groupId,
      text: messageData.text || "",
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    set(state => ({ groupMessages: [...state.groupMessages, optimisticMsg] }));

    try {
      const { replyingTo } = get();
      const payload = { ...messageData };
      if (replyingTo) {
        payload.replyTo = replyingTo._id;
        set({ replyingTo: null });
      }
      console.log(`API Post to groups/${groupId}/messages`);
      const res = await axiosInstance.post(`/groups/${groupId}/messages`, payload);
      console.log(`API Success for group message:`, res.data);
      set(state => {
        const exists = state.groupMessages.some(m => m._id === tempId);
        if (exists) {
          return { groupMessages: state.groupMessages.map(m => m._id === tempId ? res.data : m) };
        } else {
          return { groupMessages: [...state.groupMessages, res.data] };
        }
      });
    } catch (error) {
       console.error("Error sending group message:", error);
       set(state => ({
         groupMessages: state.groupMessages.filter(m => m._id !== tempId)
       }));
       toast.error("Failed to send group message");
    }
  },

  deleteGroup: async (groupId) => {
    try {
      await axiosInstance.delete(`/groups/${groupId}`);
      toast.success("Group deleted");
      const { selectedGroup } = get();
      if (selectedGroup && String(selectedGroup._id) === String(groupId)) {
        set({ selectedGroup: null, groupMessages: [] });
      }
      get().fetchGroups();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete group");
    }
  },

  deleteGroupMessages: async (groupId, messageIds) => {
    const loadingToast = toast.loading(`Deleting ${messageIds.length} message${messageIds.length > 1 ? "s" : ""}...`);
    try {
      await axiosInstance.post(`/groups/${groupId}/messages/delete`, { messageIds });
      set(state => ({
        groupMessages: state.groupMessages.filter(m => !messageIds.includes(m._id))
      }));
      toast.success("Messages deleted", { id: loadingToast });
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete messages", { id: loadingToast });
    }
  },

  // Socket listeners
  subscribeToGroupUpdates: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newGroupMessage");
    socket.off("newGroup");
    socket.off("groupDeleted");

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
        console.log(`Received real-time group message for currently active group:`, message);
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

    socket.on("groupDeleted", ({ groupId }) => {
      const { selectedGroup } = get();
      if (selectedGroup && String(selectedGroup._id) === String(groupId)) {
        set({ selectedGroup: null, groupMessages: [] });
        toast.info("This group has been deleted by the admin");
      }
      get().fetchGroups();
    });
  },

  unsubscribeFromGroupUpdates: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newGroupMessage");
      socket.off("newGroup");
      socket.off("groupDeleted");
    }
  },
}));
