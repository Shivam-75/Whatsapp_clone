import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";
import React from "react";

// --- localStorage helpers for unread count persistence across refresh ---
const UNREAD_KEY = "wa_unread_counts";
const loadUnreadFromStorage = () => {
  try { return JSON.parse(localStorage.getItem(UNREAD_KEY) || "{}"); }
  catch { return {}; }
};
const saveUnreadToStorage = (counts) => {
  try { localStorage.setItem(UNREAD_KEY, JSON.stringify(counts)); } catch {}
};

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  usersPage: 1,
  usersTotalPages: 1,
  usersSearch: "",
  isMessagesLoading: false,
  hasMoreMessages: false,
  isLoadingMore: false,
  lastMessages: {}, // userId: messageObject
  unreadCounts: loadUnreadFromStorage(), // Persisted across refresh via localStorage
  activeToastIds: {}, // userId: [toastId1, toastId2...]
  isSidebarVisible: true,
  activeChatUserId: null,
  isDrawerOpen: false,
  sidebarView: "chats", // "chats" or "users"
  typingUsers: {}, // userId: boolean
  notificationPermission: Notification.permission,
  
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
      if (page === 1 && !q) get().getLastMessages();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to load users");
      console.log("Error getting users:", error);
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
      saveUnreadToStorage(mappedUnreadCounts); // Persist fresh counts from DB
      set({ lastMessages: mappedLastMessages, unreadCounts: mappedUnreadCounts });
    } catch (error) {
      console.log("Error getting last messages:", error);
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true, messages: [] }); // Clear stale messages before fetch
    try {
      const res = await axiosInstance.get(`/messages/${userId}?limit=40`);
      set({ messages: res.data, hasMoreMessages: res.data.length >= 40 });
      get().markMessagesAsRead(userId);
      get().dismissUserToasts(userId);
      set(state => {
        const updated = { ...state.unreadCounts, [userId]: 0 };
        saveUnreadToStorage(updated); // Keep localStorage in sync
        return { unreadCounts: updated };
      });
      if (res.data.length > 0) {
        const lastMsg = res.data[res.data.length - 1];
        set((state) => ({
          lastMessages: { ...state.lastMessages, [userId]: lastMsg }
        }));
      }
    } catch (error) {
      console.log("Error getting messages:", error);
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
      // Prepend older messages while keeping scroll anchored
      set(state => ({
        messages: [...res.data, ...state.messages],
        hasMoreMessages: res.data.length >= 40
      }));
    } catch (error) {
      console.log("Error loading more messages:", error);
    } finally {
      set({ isLoadingMore: false });
    }
  },

  markMessagesAsRead: async (userId) => {
    try {
      await axiosInstance.post(`/messages/read/${userId}`);
    } catch (error) {
       console.log("Error marking messages as read:", error);
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: [...messages, res.data] });
      set((state) => ({
        lastMessages: { ...state.lastMessages, [selectedUser._id]: res.data }
      }));
    } catch (error) {
      console.log("Error sending message:", error);
    }
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // Remove old listeners first to prevent duplicates (idempotent)
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

      console.log("🔔 Socket: newMessage received", {
         isForMe,
         isFromMe,
         authId,
         receiverId: String(newMessage.receiverId),
         senderId: String(newMessage.senderId),
         selectedUserId: String(selectedUser?._id || "none"),
         senderName: newMessage.senderName
      });

      const senderIdStr = String(newMessage.senderId);
      const selectedUserIdStr = String(selectedUser?._id || "");

      // Update Messages if currently in chat
      const isThisChatOpen = 
        (senderIdStr === selectedUserIdStr && isForMe) || 
        (isFromMe && String(newMessage.receiverId) === selectedUserIdStr);

      if (isThisChatOpen) {
        set({ messages: [...messages, newMessage] });
        
        // Use activeChatUserId (which tracks focus + selection) for read status
        const isCurrentlyLooking = senderIdStr === String(activeChatUserId || "");
        
        if (isForMe && isCurrentlyLooking) {
           console.log("✅ ReadStatus: Marking as read automatically");
           get().markMessagesAsRead(senderIdStr);
           get().dismissUserToasts(senderIdStr);
        } else if (isForMe) {
           console.log("📦 ReadStatus: Emitting delivered status");
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

      // Logic for LAST MESSAGE and UNREAD COUNT
      const updatedCounts = { ...get().unreadCounts, [senderIdStr]: nextUnread };
      saveUnreadToStorage(updatedCounts); // Persist so badge survives refresh
      set((state) => ({
         lastMessages: { ...state.lastMessages, [otherId]: newMessage },
         unreadCounts: updatedCounts
      }));
      
      // SHOW TOAST if the sender's chat is NOT currently active/open
      // Use activeChatUserId (not selectedUser._id) because selectedUser is never cleared on back navigation
      const activeChatIdStr = String(activeChatUserId || "");
      if (isForMe && senderIdStr !== activeChatIdStr) {
         console.log("🔔 Toast: Showing notification for", newMessage.senderName, { senderIdStr, activeChatIdStr });
         
         // Play a soft notification beep using Web Audio API (no external URL needed)
         try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
            gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.4);
         } catch (e) { /* autoplay blocked or not supported — silent fail */ }

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
               // Avatar circle
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
               // Text content
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

          // [NEW] System Notification (Browser level)
          if (Notification.permission === "granted" && document.hidden) {
             try {
                new Notification(`New message from ${senderName}`, {
                   body: newMessage.text,
                   tag: `msg-${senderIdStr}`, // Group notifications per user
                   renotify: true
                });
             } catch (e) { console.log("System notification error:", e); }
          }
       }
    });

    socket.on("messagesRead", ({ readerId, isMe }) => {
       console.log("Socket: Received messagesRead from", readerId, { isMe });
       const { messages, lastMessages, unreadCounts } = get();
       const authId = useAuthStore.getState().authUser?._id;
       
       // Update message statuses in current view
       const newMessages = messages.map(msg => 
          String(msg.senderId) === String(authId) ? { ...msg, status: "read", isRead: true } : msg
       );

       // Update last message preview status
       const newLastMessages = { ...lastMessages };
       if (newLastMessages[readerId]) {
          newLastMessages[readerId] = { ...newLastMessages[readerId], status: "read", isRead: true };
       }

       // --- NEW: Sync unread badge across tabs ---
       // IF I am the reader (isMe is true), it means I read messages from readerId in ANOTHER tab.
       // So I should clear my unread count for readerId in THIS tab too.
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
    });

    socket.on("messageDelivered", ({ messageId, status }) => {
       console.log("Socket: Received messageDelivered for", messageId);
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

  setSelectedUser: (selectedUser) => {
     set({ selectedUser }); // DO NOT clear messages here — let getMessages handle that
     if (selectedUser) {
        get().dismissUserToasts(String(selectedUser._id));
        // Instantly zero the badge so it disappears the moment user clicks the chat
        set(state => ({
           unreadCounts: { ...state.unreadCounts, [String(selectedUser._id)]: 0 }
        }));
     }
  },
  setSidebarVisible: (isVisible) => set({ isSidebarVisible: isVisible }),
}));
