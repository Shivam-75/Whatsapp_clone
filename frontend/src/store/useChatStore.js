import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";
import React from "react";

// --- localStorage helpers for persistence across refresh ---
const UNREAD_KEY = "wa_unread_counts";
const USERS_KEY = "wa_users";
const LAST_MESSAGES_KEY = "wa_last_messages";
const MSG_CACHE_PREFIX = "wa_msgs_";

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

export const useChatStore = create((set, get) => ({
  messages: [],
  users: loadFromStorage(USERS_KEY, []),
  selectedUser: null,
  isUsersLoading: false,
  usersPage: 1,
  usersTotalPages: 1,
  usersSearch: "",
  isMessagesLoading: false,
  hasMoreMessages: false,
  isLoadingMore: false,
  lastMessages: loadFromStorage(LAST_MESSAGES_KEY, {}), // userId: messageObject
  unreadCounts: loadFromStorage(UNREAD_KEY, {}), // Persisted across refresh via localStorage
  activeToastIds: {}, // userId: [toastId1, toastId2...]
  isSidebarVisible: true,
  activeChatUserId: null,
  isDrawerOpen: false,
  sidebarView: "chats", // "chats" or "users"
  typingUsers: {}, // userId: boolean
  notificationPermission: Notification.permission,
  replyingTo: null,

  setReplyingTo: (msg) => set({ replyingTo: msg }),

  pinMessage: async (msgId) => {
    try {
      const res = await axiosInstance.post(`/messages/pin/${msgId}`);
      set((state) => ({
        messages: state.messages.map(m => m._id === msgId ? res.data : m)
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
  requestNotificationPermission: async () => {
    const permission = await Notification.requestPermission();
    set({ notificationPermission: permission });
    return permission;
  },

  setChatActive: (userId) => set({ activeChatUserId: userId }),
  setSidebarView: (view) => set({ sidebarView: view }),
  setDrawerOpen: (isOpen) => set({ isDrawerOpen: isOpen }),
  
  setTypingStatus: (isTyping) => {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;
    if (!selectedUser || !socket) return;
    
    if (isTyping) {
      socket.emit("typingStart", { receiverId: selectedUser._id });
    } else {
      socket.emit("typingStop", { receiverId: selectedUser._id });
    }
  },

  dismissUserToasts: (userId) => {
    const { activeToastIds } = get();
    // Dismiss fixed-id notification
    toast.dismiss(`notification-${userId}`);
    // Dismiss any other stored IDs for this user
    if (activeToastIds[userId] && activeToastIds[userId].length > 0) {
      activeToastIds[userId].forEach(id => toast.dismiss(id));
      set(state => ({
        activeToastIds: { ...state.activeToastIds, [userId]: [] }
      }));
    }
  },

  getUsers: async (page = 1, q = "") => {
    set({ isUsersLoading: true });
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (q) params.append("q", q);
      const res = await axiosInstance.get(`/users?${params}`);
      set({
        users: res.data.users,
        usersPage: res.data.currentPage,
        usersTotalPages: res.data.totalPages,
        usersSearch: q
      });
      saveToStorage(USERS_KEY, res.data.users); 
      if (page === 1 && !q) get().getLastMessages();
    } catch {
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getLastMessages: async () => {
    try {
      const res = await axiosInstance.get("/messages/last-messages");
      const mappedLastMessages = {};
      const mappedUnreadCounts = {};
      res.data.forEach(item => {
        mappedLastMessages[item._id] = item.lastMessage;
        mappedUnreadCounts[item._id] = item.unreadCount || 0;
      });
      saveToStorage(UNREAD_KEY, mappedUnreadCounts); 
      saveToStorage(LAST_MESSAGES_KEY, mappedLastMessages);
      set({ lastMessages: mappedLastMessages, unreadCounts: mappedUnreadCounts });
    } catch {
    }
  },

  getMessages: async (userId) => {
    const { messages } = get();
    const optimisticMsgs = messages.filter(m => m.isOptimistic && (String(m.receiverId) === String(userId) || String(m.groupId) === String(userId)));
    
    const cached = loadFromStorage(`${MSG_CACHE_PREFIX}${userId}`, []);
    set({ messages: [...cached, ...optimisticMsgs], isMessagesLoading: cached.length === 0 }); 
    
    try {
      console.log(`[DEBUG] Fetching messages for: ${userId}`);
      const res = await axiosInstance.get(`/messages/${userId}?limit=40`);
      console.log(`[DEBUG] Fetched ${res.data.length} messages for ${userId}`);
      const serverMsgs = res.data;
      set((state) => {
        // Only keep optimistic messages that are NOT already in the server response
        // (identified by text and recipient if _id is temp)
        const currentOptimistic = state.messages.filter(m => 
            m.isOptimistic && 
            (String(m.receiverId) === String(userId) || String(m.groupId) === String(userId)) &&
            !serverMsgs.some(sm => sm.text === m.text && String(sm.senderId?._id || sm.senderId) === String(m.senderId))
        );
        
        const merged = [...serverMsgs, ...currentOptimistic];
        saveToStorage(`${MSG_CACHE_PREFIX}${userId}`, merged);
        return { messages: merged, hasMoreMessages: serverMsgs.length >= 40 };
      });
      get().markMessagesAsRead(userId);
      get().dismissUserToasts(userId);
      set(state => {
        const updated = { ...state.unreadCounts, [userId]: 0 };
        saveToStorage(UNREAD_KEY, updated); 
        return { unreadCounts: updated };
      });
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  loadMoreMessages: async (userId) => {
    const { messages, hasMoreMessages, isLoadingMore } = get();
    if (!hasMoreMessages || isLoadingMore || messages.length === 0) return;

    set({ isLoadingMore: true });
    try {
      const oldestMsg = messages[0];
      const before = oldestMsg.createdAt;
      const res = await axiosInstance.get(`/messages/${userId}?limit=40&before=${before}`);
      if (res.data.length === 0) {
        set({ hasMoreMessages: false });
        return;
      }
      set(state => ({
        messages: [...res.data, ...state.messages],
        hasMoreMessages: res.data.length >= 40
      }));
    } catch {
    } finally {
      set({ isLoadingMore: false });
    }
  },

  markMessagesAsRead: async (userId) => {
    try {
      await axiosInstance.post(`/messages/read/${userId}`);
    } catch {}
  },

  deleteMessages: async (ids) => {
    const loadingToast = toast.loading(`Deleting ${ids.length} message${ids.length > 1 ? "s" : ""}...`);
    try {
      await axiosInstance.post("/messages/delete-multiple", { messageIds: ids });
      toast.success("Messages deleted", { id: loadingToast });
    } catch {
      toast.error("Delete failed", { id: loadingToast });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    const authUser = useAuthStore.getState().authUser;
    
    if (!selectedUser) {
        toast.error("No user selected");
        return;
    }
    if (!authUser) {
        toast.error("Not authenticated");
        return;
    }

    const tempId = `temp-${Date.now()}`;
    const targetUserId = typeof selectedUser === "string" ? selectedUser : selectedUser?._id;
    if (!targetUserId) {
        toast.error("No receiver selected");
        return;
    }
    const targetIdStr = String(targetUserId);
    const delay = selectedUser?.disappearingDelay || 0;
    
    // Create optimistic message
    const optimisticMsg = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: targetUserId,
      text: messageData.text || "",
      image: messageData.image instanceof File ? URL.createObjectURL(messageData.image) : null,
      status: "pending",
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    // Add immediately to UI using functional set for safety
    set((state) => ({ messages: [...state.messages, optimisticMsg] }));

    const loadingToast = toast.loading("Sending message...");

    try {
      const formData = new FormData();
      formData.append("text", messageData.text || "");
      if (messageData.image instanceof File) {
        formData.append("image", messageData.image);
      }
      const { replyingTo } = get();
      if (replyingTo) {
        formData.append("replyTo", replyingTo._id);
        set({ replyingTo: null });
      }
      formData.append("disappearingDelay", delay);

      console.log(`[FRONTEND DEBUG] Sending message to: /messages/send/${targetIdStr}`);
      const res = await axiosInstance.post(`/messages/send/${targetIdStr}`, formData);
      console.log(`[FRONTEND DEBUG] Server response:`, res.data);

      // Replace temp message with real one
      set((state) => {
        // Find if the optimistic message is still there
        const exists = state.messages.some(m => m._id === tempId);
        let updatedMessages;
        if (exists) {
            updatedMessages = state.messages.map(m => m._id === tempId ? res.data : m);
        } else {
            // It was lost (maybe by a getMessages call), add it back
            updatedMessages = [...state.messages, res.data];
        }

        saveToStorage(`${MSG_CACHE_PREFIX}${targetIdStr}`, updatedMessages);
        
        const newLast = { ...state.lastMessages, [targetIdStr]: res.data };
        saveToStorage(LAST_MESSAGES_KEY, newLast);
        
        return { 
          messages: updatedMessages,
          lastMessages: newLast
        };
      });
      
      toast.dismiss(loadingToast);
      
      // Revoke the blob URL to save memory if it was an image
      if (optimisticMsg.image) URL.revokeObjectURL(optimisticMsg.image);

    } catch (error) {
      toast.dismiss(loadingToast);
      // Remove the optimistic message on failure
      set((state) => ({
        messages: state.messages.filter(m => m._id !== tempId)
      }));
      toast.error(error.response?.data?.error || "Failed to send message");
    }
  },

  clearChat: async (targetUserId) => {
    const loadingToast = toast.loading("Clearing chat...");
    try {
      await axiosInstance.post(`/messages/clear/${targetUserId}`);
      set({ messages: [] });
      toast.success("Chat cleared", { id: loadingToast });
    } catch {
      toast.error("Failed to clear chat", { id: loadingToast });
    }
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // Remove old listeners first
    socket.off("newMessage");
    socket.off("messagesRead");
    socket.off("messageDelivered");
    socket.off("userTyping");

    socket.on("newMessage", (newMessage) => {
      const { selectedUser, messages, unreadCounts, activeChatUserId } = get();
      const authUser = useAuthStore.getState().authUser;

      const authId = String(authUser?._id);
      const isForMe = String(newMessage.receiverId) === authId;
      const isFromMe = String(newMessage.senderId) === authId;
      const otherId = isFromMe ? String(newMessage.receiverId) : String(newMessage.senderId);

      const senderIdStr = String(newMessage.senderId);
      const selectedUserIdStr = String(selectedUser?._id || "");

      // Update Messages if currently in chat
      const isThisChatOpen = 
        (senderIdStr === selectedUserIdStr && isForMe) || 
        (isFromMe && String(newMessage.receiverId) === selectedUserIdStr);

      if (isThisChatOpen) {
        const newMsgs = [...messages, newMessage];
        set({ messages: newMsgs });
        saveToStorage(`${MSG_CACHE_PREFIX}${selectedUserIdStr}`, newMsgs);
        
        const isCurrentlyLooking = senderIdStr === String(activeChatUserId || "");
        
        if (isForMe && isCurrentlyLooking) {
           get().markMessagesAsRead(senderIdStr);
           get().dismissUserToasts(senderIdStr);
        } else if (isForMe) {
           socket.emit("messageDelivered", { messageId: newMessage._id, senderId: senderIdStr });
        }
      }

      // Calculate NEXT unread count
      let nextUnread = unreadCounts[senderIdStr] || 0;
      if (isForMe && senderIdStr !== selectedUserIdStr) {
         nextUnread += 1;
      } else if (isForMe && senderIdStr === selectedUserIdStr) {
         nextUnread = 0;
      }

      const updatedCounts = { ...get().unreadCounts, [senderIdStr]: nextUnread };
      const newLast = { ...get().lastMessages, [otherId]: newMessage };
      saveToStorage(UNREAD_KEY, updatedCounts);
      saveToStorage(LAST_MESSAGES_KEY, newLast);
      set({
         lastMessages: newLast,
         unreadCounts: updatedCounts
      });
      
      const activeChatIdStr = String(activeChatUserId || "");
      if (isForMe && senderIdStr !== activeChatIdStr) {
         try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.4);
         } catch (e) {}

         const senderName = newMessage.senderName || 'Contact';
         const initials = senderName.charAt(0).toUpperCase();
         const msgPreview = newMessage.text.substring(0, 45) + (newMessage.text.length > 45 ? '...' : '');

         toast.custom(
            (t) => React.createElement(
               'div',
               {
                  onClick: () => toast.dismiss(t.id),
                  style: {
                     display: 'flex', alignItems: 'center', gap: '12px',
                     background: '#202c33', color: '#e9edef',
                     borderRadius: '12px', padding: '10px 14px',
                     boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
                     minWidth: '280px', maxWidth: '360px',
                     cursor: 'pointer', border: '1px solid #2a3942',
                     opacity: t.visible ? 1 : 0,
                     transform: t.visible ? 'translateY(0)' : 'translateY(-8px)',
                     transition: 'all 0.25s ease'
                  }
               },
               React.createElement(
                  'div',
                  {
                     style: {
                        width: '44px', height: '44px', borderRadius: '50%',
                        background: '#00a884', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, fontWeight: '700', fontSize: '18px',
                        color: '#fff'
                     }
                  },
                  initials
               ),
               React.createElement(
                  'div',
                  { style: { flex: 1, minWidth: 0 } },
                  React.createElement(
                     'div',
                     { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' } },
                     React.createElement('span', { style: { fontWeight: '600', fontSize: '15px', color: '#e9edef' } }, senderName),
                     nextUnread > 1 && React.createElement(
                        'span',
                        {
                           style: {
                              background: '#00a884', color: '#fff',
                              borderRadius: '50px', fontSize: '11px',
                              fontWeight: '700', padding: '1px 7px', minWidth: '20px',
                              textAlign: 'center'
                           }
                        },
                        nextUnread
                     )
                  ),
                  React.createElement('span', { style: { fontSize: '13px', color: '#8696a0', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, msgPreview)
               )
            ),
            {
               id: `notification-${newMessage.senderId}`,
               duration: 6000,
               position: 'top-right'
            }
         );

          if (Notification.permission === "granted" && document.hidden) {
              try {
                  new Notification(`New message from ${senderName}`, {
                      body: newMessage.text,
                      tag: `msg-${senderIdStr}`,
                      renotify: true
                  });
              } catch (e) {}
          }
       }
    });

    socket.on("messagesRead", ({ readerId, isMe }) => {
       const { messages, lastMessages, unreadCounts } = get();
       const authId = useAuthStore.getState().authUser?._id;
       
       const newMessages = messages.map(msg => 
          String(msg.senderId) === String(authId) ? { ...msg, status: "read", isRead: true } : msg
       );

       const newLastMessages = { ...lastMessages };
       if (newLastMessages[readerId]) {
          newLastMessages[readerId] = { ...newLastMessages[readerId], status: "read", isRead: true };
       }

       let updatedCounts = { ...unreadCounts };
       if (isMe) {
          updatedCounts[readerId] = 0;
          saveUnreadToStorage(updatedCounts);
       }

       set({ 
          messages: newMessages, 
          lastMessages: newLastMessages,
          unreadCounts: updatedCounts 
       });
       if (isMe) {
         saveToStorage(`${MSG_CACHE_PREFIX}${readerId}`, newMessages);
         saveToStorage(LAST_MESSAGES_KEY, newLastMessages);
         saveToStorage(UNREAD_KEY, updatedCounts);
       }
    });

    socket.on("messageDelivered", ({ messageId, status }) => {
       const { messages, lastMessages } = get();
       
       const newMessages = messages.map(msg => 
          String(msg._id) === String(messageId) && msg.status !== "read" ? { ...msg, status: "delivered" } : msg
       );

       const newLastMessages = { ...lastMessages };
       for (let userId in newLastMessages) {
          if (String(newLastMessages[userId]?._id) === String(messageId) && newLastMessages[userId].status !== "read") {
             newLastMessages[userId] = { ...newLastMessages[userId], status: "delivered" };
          }
       }

       set({ messages: newMessages, lastMessages: newLastMessages });
    });

    socket.on("userTyping", ({ senderId, isTyping }) => {
       set(state => ({
          typingUsers: { ...state.typingUsers, [senderId]: isTyping }
       }));
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
       socket.off("newMessage");
       socket.off("messagesRead");
       socket.off("messageDelivered");
       socket.off("userTyping");
    }
  },

  setSelectedUser: (user) => {
    if (!user) {
      set({ selectedUser: null });
      return;
    }

    // If string ID passed, try to find the full user object
    let resolvedUser = user;
    if (typeof user === "string") {
      const { users } = get();
      resolvedUser = users.find(u => u._id === user) || { _id: user };
    }

    set({ selectedUser: resolvedUser });
    
    const userId = String(resolvedUser._id);
    if (userId && userId !== "undefined") {
      get().dismissUserToasts(userId);
      set(state => {
        const updated = { ...state.unreadCounts, [userId]: 0 };
        saveToStorage(UNREAD_KEY, updated);
        return { unreadCounts: updated };
      });
    }
  },

  blockUser: async (userId) => {
    try {
      await axiosInstance.post(`/users/block/${userId}`);
      toast.success("User blocked");
      const { selectedUser } = get();
      if (selectedUser && selectedUser._id === userId) {
        set({ selectedUser: { ...selectedUser, isBlocked: true } });
      }
      const authUser = useAuthStore.getState().authUser;
      useAuthStore.setState({
        authUser: { ...authUser, blockedUsers: [...(authUser.blockedUsers || []), userId] }
      });
    } catch (error) {
      toast.error("Failed to block user");
    }
  },

  unblockUser: async (userId) => {
    try {
      await axiosInstance.post(`/users/unblock/${userId}`);
      toast.success("User unblocked");
      const { selectedUser } = get();
      if (selectedUser && selectedUser._id === userId) {
        set({ selectedUser: { ...selectedUser, isBlocked: false } });
      }
      const authUser = useAuthStore.getState().authUser;
      useAuthStore.setState({
        authUser: { ...authUser, blockedUsers: (authUser.blockedUsers || []).filter(id => id !== userId) }
      });
    } catch (error) {
      toast.error("Failed to unblock user");
    }
  },

  setDisappearingMode: async (duration) => {
    const { selectedUser } = get();
    if (!selectedUser) return;
    try {
      set({ selectedUser: { ...selectedUser, disappearingDelay: duration } });
      toast.success(`Disappearing messages set to ${duration === 0 ? "Off" : duration / 3600 + " hours"}`);
    } catch (error) {
      toast.error("Failed to set disappearing messages");
    }
  },

  setSidebarVisible: (isVisible) => set({ isSidebarVisible: isVisible }),
}));
