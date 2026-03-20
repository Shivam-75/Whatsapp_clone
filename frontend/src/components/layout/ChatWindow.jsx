import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useChatStore } from "../../store/useChatStore";
import { useAuthStore } from "../../store/useAuthStore";
import { axiosInstance } from "../../lib/axios";
import { MoreVertical, Search, Check, CheckCheck, Loader, Copy, Trash2, Reply, Forward, Pin, CheckSquare, Smile, Image, Clock, Send, ArrowLeft, X, Phone, Video } from 'lucide-react';
import { format } from "date-fns";
import { getMediaUrl } from "../../lib/utils";
import clsx from "clsx";
import Avatar from "../common/Avatar";
import toast from "react-hot-toast";

const ChatWindow = () => {
  const { 
    getMessages, messages, setSelectedUser, selectedUser, users, isMessagesLoading,
    setChatActive, typingUsers, setTypingStatus, sendMessage, deleteMessages,
    loadMoreMessages, hasMoreMessages, isLoadingMore,
    blockUser, unblockUser, setDisappearingMode, setSidebarVisible,
    replyingTo, setReplyingTo, pinMessage, forwardMessage
   } = useChatStore();
  const { authUser, onlineUsers } = useAuthStore();
  const { chatId } = useParams();

  const [text, setText] = useState("");
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());
  const [showMenu, setShowMenu] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDisappearingMenu, setShowDisappearingMenu] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMsgId, setForwardMsgId] = useState(null);
  const [forwardSearch, setForwardSearch] = useState("");
  const [selectedTargets, setSelectedTargets] = useState({ userIds: [], groupIds: [] });

  const fileInputRef = useRef(null);

  const messageEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const menuRef = useRef(null);
  const [contextMenu, setContextMenu] = useState(null); // { msgId, x, y, isMine, text }
  const longPressTimerRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  const authId = String(authUser?._id);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e) => {
      // Close side menu if click is outside
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
      
      // Close context menu if click is NOT on a menu button
      if (contextMenu && !e.target.closest('.context-menu-btn')) {
        setContextMenu(null);
      }

      if (showEmojiPicker && !e.target.closest('.emoji-picker-container')) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [contextMenu, showEmojiPicker, imagePreviewUrl]);

  // Enter/exit selection mode
  const enterSelectMode = useCallback(() => { setIsSelecting(true); setShowMenu(false); }, []);
  const exitSelectMode = useCallback(() => { setIsSelecting(false); setSelectedMsgIds(new Set()); }, []);

  // Select All
  const handleSelectAll = useCallback(() => {
    setSelectedMsgIds(new Set(messages.map(m => m._id)));
    setIsSelecting(true);
    setShowMenu(false);
  }, [messages]);

  // Toggle individual message
  const toggleMsgSelect = useCallback((msgId) => {
    setSelectedMsgIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      return next;
    });
  }, []);

  // Delete selected messages
  const handleDeleteConfirmed = useCallback(async () => {
    const ids = [...selectedMsgIds];
    try {
      await deleteMessages(ids);
      // Remove deleted messages from store state locally for instant feedback
      useChatStore.setState(state => ({
        messages: state.messages.filter(m => !ids.includes(m._id))
      }));
    } catch (err) {
      console.error("Delete confirmed error:", err);
    } finally {
      setShowDeleteConfirm(false);
      exitSelectMode();
    }
  }, [selectedMsgIds, deleteMessages, exitSelectMode]);

  // Context menu handlers
  const handleContextMenu = useCallback((e, msg) => {
    e.preventDefault();
    if (isSelecting) return;
    const isMine = String(msg.senderId) === authId;
    setContextMenu({
      msgId: msg._id,
      x: e.clientX,
      y: e.clientY,
      isMine,
      text: msg.text || '',
    });
  }, [isSelecting, authId]);

  const handleTouchStart = useCallback((msg) => {
    longPressTimerRef.current = setTimeout(() => {
      if (isSelecting) return;
      const isMine = String(msg.senderId) === authId;
      setContextMenu({
        msgId: msg._id,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        isMine,
        text: msg.text || '',
      });
    }, 500);
  }, [isSelecting, authId]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }, []);

  const handleCopyMessage = useCallback(() => {
    if (contextMenu?.text) {
      navigator.clipboard.writeText(contextMenu.text);
      toast.success("Message copied");
    }
    setContextMenu(null);
  }, [contextMenu]);

  const handleDeleteFromContext = useCallback(() => {
    if (contextMenu?.msgId) {
      setSelectedMsgIds(new Set([contextMenu.msgId]));
      setShowDeleteConfirm(true);
    }
    setContextMenu(null);
  }, [contextMenu]);

  const handleSelectFromContext = useCallback(() => {
    if (contextMenu?.msgId) {
      setIsSelecting(true);
      setSelectedMsgIds(new Set([contextMenu.msgId]));
    }
    setContextMenu(null);
  }, [contextMenu]);

  // Track which chat is active
  useEffect(() => {
    const updateStatus = () => {
      if (document.visibilityState === "visible" && selectedUser?._id) setChatActive(selectedUser._id);
      else setChatActive(null);
    };
    window.addEventListener("focus", updateStatus);
    window.addEventListener("blur", updateStatus);
    document.addEventListener("visibilitychange", updateStatus);
    updateStatus();
    return () => {
      window.removeEventListener("focus", updateStatus);
      window.removeEventListener("blur", updateStatus);
      document.removeEventListener("visibilitychange", updateStatus);
      setChatActive(null);
    };
  }, [setChatActive, selectedUser?._id]);

  // Load messages when chatId changes
  useEffect(() => {
    if (chatId && !selectedUser && users.length > 0) {
      const user = users.find(u => String(u._id) === String(chatId));
      if (user) setSelectedUser(user);
    }
    const targetId = chatId || selectedUser?._id;
    if (targetId) getMessages(String(targetId));
    exitSelectMode();
  }, [chatId, users, selectedUser, getMessages, setSelectedUser, exitSelectMode]);

  // Scroll handling
  useEffect(() => {
    if (isMessagesLoading || messages.length === 0) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    const newScrollHeight = container.scrollHeight;
    if (isLoadingMore) {
      container.scrollTop += newScrollHeight - prevScrollHeightRef.current;
    } else {
      messageEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }
    prevScrollHeightRef.current = newScrollHeight;
  }, [messages]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (container.scrollTop < 80 && hasMoreMessages && !isLoadingMore) {
      prevScrollHeightRef.current = container.scrollHeight;
      const targetId = chatId || selectedUser?._id;
      if (targetId) loadMoreMessages(String(targetId));
    }
  }, [hasMoreMessages, isLoadingMore, chatId, selectedUser?._id, loadMoreMessages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const handleInputChange = useCallback((e) => {
    setText(e.target.value);
    setTypingStatus(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTypingStatus(false), 2000);
  }, [setTypingStatus]);

  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault();
    if (!text.trim() && !fileInputRef.current?.files?.[0]) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTypingStatus(false);
    setShowEmojiPicker(false);
    
    const messagePayload = { text: text.trim() };
    if (fileInputRef.current?.files?.[0]) {
      messagePayload.image = fileInputRef.current.files[0];
    }
    
    await sendMessage(messagePayload);
    
    setText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 60);
  }, [text, sendMessage, setTypingStatus]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    
    // Revoke old URL if exists
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    
    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));

    // Reset input so same file can be selected again
    e.target.value = null;
  };

  const addEmoji = (emoji) => {
    setText(prev => prev + emoji);
  };

  if (!selectedUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-wa-bg-panel h-full">
        <Loader className="w-8 h-8 animate-spin text-wa-accent mb-4" />
        <p className="text-wa-text-muted">Loading chat...</p>
      </div>
    );
  }

  const isTyping = typingUsers[selectedUser._id];
  const isOnline = onlineUsers.includes(String(selectedUser._id));
  const selectedCount = selectedMsgIds.size;
  const isBlocked = authUser?.blockedUsers?.includes(selectedUser._id);
  const isMeBlocked = selectedUser?.isBlockedByMe; // This would come from backend if we added it to user search/info
  // For this implementation, we check the authUser.blockedUsers list for "who I blocked"
  // And the backend will return 403 if "they blocked me" when sending.

  return (
    <div className="flex-1 flex flex-col h-full relative" style={{ background: "#0b141a" }}>
      
      {/* Header — selection mode vs normal */}
      {isSelecting ? (
        <div className="h-[60px] flex items-center justify-between px-4 shrink-0" style={{ background: "#2a3942" }}>
          <div className="flex items-center gap-3">
            <button onClick={exitSelectMode} className="text-[#aebac1] hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <span className="text-[#e9edef] font-medium">{selectedCount} selected</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSelectAll} title="Select All" className="text-[#aebac1] hover:text-white p-1">
              <CheckSquare className="w-5 h-5" />
            </button>
            {selectedCount > 0 && (
              <button onClick={() => setShowDeleteConfirm(true)} title="Delete" className="text-red-400 hover:text-red-300 p-1">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="h-[60px] flex items-center justify-between px-3 md:px-4 border-l border-wa-divider shrink-0" style={{ background: "#202c33" }}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button onClick={() => { setSidebarVisible(true); setChatActive(null); }} className="md:hidden p-1.5 -ml-1 hover:bg-white/10 rounded-full transition-colors shrink-0">
              <ArrowLeft className="w-6 h-6 text-gray-300" />
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <Avatar user={selectedUser} size="w-10 h-10 md:w-11 md:h-11" textClassName="text-base" isOnline={isOnline} showOnline={true} />
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-[#e9edef] text-[15px] md:text-[17px] font-medium truncate">{selectedUser.username}</span>
                <span className={clsx("text-[12px] truncate", isTyping ? "text-[#00a884] italic" : (isOnline ? "text-[#00a884]" : "text-[#8696a0]"))}>
                  {isBlocked ? "Blocked" : (isTyping ? "typing..." : (isOnline ? "online" : "offline"))}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[#8696a0] shrink-0 ml-2 relative">
            <Video className="w-5 h-5 cursor-pointer hover:text-[#e9edef] hidden sm:block" />
            <Phone className="w-5 h-5 cursor-pointer hover:text-[#e9edef] hidden sm:block" />
            <Search className="w-5 h-5 cursor-pointer hover:text-[#e9edef]" />
            {/* 3-dot menu */}
            <div ref={menuRef} className="relative">
              <button onClick={() => setShowMenu(v => !v)} className="hover:text-[#e9edef]">
                <MoreVertical className="w-5 h-5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 z-50 rounded-lg shadow-xl overflow-hidden" style={{ background: "#233138", minWidth: "160px" }}>
                  <button
                    onClick={handleSelectAll}
                    className="w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-2"
                  >
                    <CheckSquare className="w-4 h-4" />
                    Select All
                  </button>
                  <button
                    onClick={enterSelectMode}
                    className="w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-2"
                  >
                    <CheckSquare className="w-4 h-4 opacity-50" />
                    Select Messages
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); setShowDisappearingMenu(true); }}
                    className="w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-2"
                  >
                    <Pin className="w-4 h-4" />
                    Disappearing Messages
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); isBlocked ? unblockUser(selectedUser._id) : blockUser(selectedUser._id); }}
                    className={clsx(
                      "w-full text-left px-4 py-3 text-sm hover:bg-white/10 transition-colors flex items-center gap-2",
                      isBlocked ? "text-green-400" : "text-red-400"
                    )}
                  >
                    <X className="w-4 h-4" />
                    {isBlocked ? "Unblock User" : "Block User"}
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); if(window.confirm("Clear all messages in this chat?")) clearChat(selectedUser._id); }}
                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/10 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear Chat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Disappearing Messages Modal */}
      {showDisappearingMenu && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-xl p-6 shadow-2xl w-full max-w-[320px]" style={{ background: "#233138" }}>
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-[#e9edef] text-lg font-semibold">Disappearing messages</h3>
                <button onClick={() => setShowDisappearingMenu(false)} className="text-[#8696a0] hover:text-white"><X className="w-5 h-5" /></button>
             </div>
             <p className="text-[#8696a0] text-sm mb-6">Messages will disappear from this chat after the selected duration.</p>
             <div className="space-y-4">
                {[
                  { label: "Off", value: 0 },
                  { label: "24 Hours", value: 86400 },
                  { label: "7 Days", value: 604800 },
                  { label: "90 Days", value: 7776000 }
                ].map((opt) => (
                   <button 
                     key={opt.label}
                     onClick={() => { setDisappearingMode(opt.value); setShowDisappearingMenu(false); }}
                     className={clsx(
                        "w-full flex items-center justify-between px-1 py-2 text-[#e9edef] group",
                        selectedUser.disappearingDelay === opt.value && "font-semibold"
                     )}
                   >
                      <span>{opt.label}</span>
                      <div className={clsx(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        selectedUser.disappearingDelay === opt.value ? "border-[#00a884] bg-[#00a884]" : "border-[#8696a0]"
                      )}>
                        {selectedUser.disappearingDelay === opt.value && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                      </div>
                   </button>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1" style={{ background: "#0b141a" }}>
        {isLoadingMore && (
          <div className="flex justify-center py-2"><Loader className="w-5 h-5 animate-spin text-[#00a884]" /></div>
        )}
        {hasMoreMessages && !isLoadingMore && (
          <div className="flex justify-center py-1">
            <span className="text-[11px] text-[#8696a0] select-none">↑ Scroll up for older messages</span>
          </div>
        )}
        {isMessagesLoading ? (
          <div className="flex items-center justify-center h-full"><Loader className="animate-spin text-[#00a884] w-8 h-8" /></div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full"><p className="text-[#8696a0] text-sm">No messages yet. Say hi! 👋</p></div>
        ) : (
          messages.map((msg) => {
            const isMine = String(msg.senderId?._id || msg.senderId) === authId;
            const isSelected = selectedMsgIds.has(msg._id);
            return (
              <div
                key={msg._id}
                onClick={() => isSelecting ? toggleMsgSelect(msg._id) : null}
                onContextMenu={(e) => handleContextMenu(e, msg)}
                onTouchStart={() => handleTouchStart(msg)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
                className={`flex w-full items-center gap-2 transition-colors ${isMine ? "justify-end" : "justify-start"} ${isSelecting ? "cursor-pointer" : ""} ${isSelected ? "opacity-80" : ""}`}
                style={{ background: isSelected ? "rgba(0,168,132,0.1)" : "transparent", borderRadius: "4px" }}
                id={`msg-${msg._id}`}
              >
                {isSelecting && (
                  <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-[#00a884] border-[#00a884]" : "border-[#8696a0]"} ${isMine ? "order-last ml-1" : "order-first mr-1"}`}>
                    {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-2 pt-1.5 pb-1 rounded-lg text-[14px] leading-relaxed shadow-md ${isMine ? "rounded-tr-none" : "rounded-tl-none"}`}
                  style={{ background: isMine ? "#005c4b" : "#202c33", color: "#e9edef" }}
                >
                  {msg.isForwarded && (
                    <div className="flex items-center gap-1 mb-1 text-[#8696a0] italic text-[11px]">
                      <Forward className="w-3 h-3" />
                      Forwarded
                    </div>
                  )}

                  {msg.replyTo && (
                    <div 
                      className="mb-1.5 p-2 rounded bg-black/20 border-l-4 border-[#00a884] cursor-pointer hover:bg-black/30 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        const el = document.getElementById(`msg-${msg.replyTo._id || msg.replyTo}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      <p className="text-[11px] font-bold text-[#00a884] truncate">
                        {msg.replyTo.senderId === authId ? "You" : (selectedUser.username || "User")}
                      </p>
                      <p className="text-[12px] text-[#8696a0] truncate line-clamp-1 italic">
                        {msg.replyTo.text || (msg.replyTo.image ? "Photo" : "Message")}
                      </p>
                    </div>
                  )}

                  {msg.image && (
                    <div className="mb-1 rounded overflow-hidden cursor-pointer" onClick={() => window.open(msg.isOptimistic ? msg.image : `${import.meta.env.VITE_URL}${msg.image}`, '_blank')}>
                      <img 
                        src={getMediaUrl(msg.image)} 
                        alt="Attachment" 
                        className="max-h-[300px] w-full object-cover transition-transform hover:scale-[1.03]" 
                        onLoad={() => {
                           // Force scroll to bottom when images load
                           messageEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
                        }}
                      />
                    </div>
                  )}
                  {msg.text && (
                    <p className="px-1" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.text}</p>
                  )}
                  <div className="flex justify-end items-center gap-1 mt-0.5">
                    <span style={{ fontSize: "10px", color: "#8696a0" }}>{format(new Date(msg.createdAt), "h:mm a")}</span>
                    {isMine && (
                      msg.status === "pending" ? (
                        <Clock className="w-3 h-3 text-[#8696a0] animate-pulse" />
                      ) : msg.status === "sent" ? (
                        <Check className="w-3.5 h-3.5 text-[#8696a0]" />
                      ) : (
                        <CheckCheck className={clsx("w-3.5 h-3.5", msg.status === "read" ? "text-wa-blue-tick" : "text-[#8696a0]")} />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messageEndRef} />
      </div>

      {/* Message Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-60 rounded-xl shadow-2xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-150"
          style={{
            background: '#233138',
            minWidth: '180px',
            left: Math.min(contextMenu.x, window.innerWidth - 200),
            top: Math.min(contextMenu.y, window.innerHeight - 320),
          }}
        >
          <button
            onClick={handleCopyMessage}
            className="context-menu-btn w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-3"
          >
            <Copy className="w-4 h-4 text-[#8696a0]" /> Copy
          </button>
          <button
            onClick={handleSelectFromContext}
            className="context-menu-btn w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-3"
          >
            <CheckSquare className="w-4 h-4 text-[#8696a0]" /> Select
          </button>
          <button
            onClick={() => { setReplyingTo({ _id: contextMenu.msgId, text: contextMenu.text, senderId: contextMenu.isMine ? authId : selectedUser._id }); setContextMenu(null); }}
            className="context-menu-btn w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-3"
          >
            <Reply className="w-4 h-4 text-[#8696a0]" /> Reply
          </button>
          <button
            onClick={() => { setForwardMsgId(contextMenu.msgId); setShowForwardModal(true); setContextMenu(null); }}
            className="context-menu-btn w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-3"
          >
            <Forward className="w-4 h-4 text-[#8696a0]" /> Forward
          </button>
          <button
            onClick={() => pinMessage(contextMenu.msgId)}
            className="context-menu-btn w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-3"
          >
            <Pin className="w-4 h-4 text-[#8696a0]" /> Pin
          </button>
          {contextMenu.isMine && (
            <button
              onClick={handleDeleteFromContext}
              className="context-menu-btn w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/10 transition-colors flex items-center gap-3"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
        </div>
      )}

      {/* Forwarding Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[500px]" style={{ background: "#202c33" }}>
            <div className="p-4 flex items-center justify-between border-b border-wa-divider" style={{ background: "#2a3942" }}>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowForwardModal(false)} className="text-[#aebac1] hover:text-white">
                  <X className="w-6 h-6" />
                </button>
                <h3 className="text-[#e9edef] font-medium text-lg">Forward message to</h3>
              </div>
            </div>
            
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
                <input 
                  type="text"
                  placeholder="Search contacts and groups"
                  value={forwardSearch}
                  onChange={(e) => setForwardSearch(e.target.value)}
                  className="w-full bg-[#2a3942] border-none rounded-lg py-2 pl-10 pr-4 text-sm text-[#d1d7db] outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-20">
              <p className="px-3 py-2 text-[13px] text-[#00a884] font-semibold uppercase tracking-wider">Recent Chats</p>
              {users.filter(u => u.username?.toLowerCase().includes(forwardSearch.toLowerCase())).map(u => {
                const isSelected = selectedTargets.userIds.includes(u._id);
                return (
                  <button 
                    key={u._id}
                    onClick={() => {
                      setSelectedTargets(prev => ({
                        ...prev,
                        userIds: isSelected ? prev.userIds.filter(id => id !== u._id) : [...prev.userIds, u._id]
                      }));
                    }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors group"
                  >
                    <div className="relative shrink-0">
                      <Avatar user={u} size="md" />
                      {isSelected && (
                        <div className="absolute -bottom-1 -right-1 bg-[#00a884] rounded-full p-1 ring-2 ring-[#202c33]">
                          <Check className="w-3 h-3 text-white" strokeWidth={4} />
                        </div>
                      )}
                    </div>
                    <span className="text-[#e9edef] text-[15px] flex-1 text-left">{u.username}</span>
                  </button>
                );
              })}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-wa-divider bg-[#2a3942] flex items-center justify-between">
              <div className="text-[13px] text-[#8696a0]">
                {selectedTargets.userIds.length + selectedTargets.groupIds.length} selected
              </div>
              <button 
                disabled={selectedTargets.userIds.length === 0 && selectedTargets.groupIds.length === 0}
                onClick={async () => {
                  await forwardMessage(forwardMsgId, selectedTargets.userIds, selectedTargets.groupIds);
                  setShowForwardModal(false);
                  setSelectedTargets({ userIds: [], groupIds: [] });
                }}
                className="bg-[#00a884] hover:bg-[#06cf9c] disabled:opacity-50 disabled:hover:bg-[#00a884] text-wa-unread-badge-text rounded-full p-3 transition-all hover:scale-105 active:scale-95 shadow-lg"
              >
                <Send className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reply Preview */}
      {replyingTo && (
        <div className="px-4 py-2 border-l-4 border-[#00a884] flex items-center justify-between" style={{ background: "#111b21" }}>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-[#00a884]">
              Replying to {String(replyingTo.senderId?._id || replyingTo.senderId) === authId ? "yourself" : (selectedUser.username || "User")}
            </p>
            <p className="text-sm text-[#8696a0] truncate italic line-clamp-1">
              {replyingTo.text || (replyingTo.image ? "Photo" : "Message")}
            </p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="text-[#8696a0] hover:text-[#e9edef] p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Input area */}
      {!isSelecting && !isBlocked && (
        <div className="h-[62px] flex items-center px-4 gap-3 shrink-0 relative" style={{ background: "#202c33" }}>
          <div className="emoji-picker-container relative">
            <Smile 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={clsx("cursor-pointer transition-colors", showEmojiPicker ? "text-[#00a884]" : "text-[#8696a0] hover:text-[#e9edef]")} 
            />
            {showEmojiPicker && (
              <div 
                className="absolute bottom-14 left-0 z-50 p-3 rounded-xl shadow-2xl border border-wa-divider grid grid-cols-6 gap-2 h-[250px] overflow-y-auto"
                style={{ background: "#233138", width: "260px" }}
              >
                {["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸","😻","😼","😽","🙀","😿","😾"].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => addEmoji(emoji)}
                    className="text-2xl hover:bg-white/10 rounded-lg p-1 transition-all hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleImageUpload}
          />
          <Image 
            onClick={() => fileInputRef.current?.click()}
            className="text-[#8696a0] cursor-pointer hover:text-[#e9edef] transition-colors" 
          />
          <form onSubmit={handleSendMessage} className="flex-1 flex gap-3">
            <input
              type="text"
              placeholder="Type a message"
              className="flex-1 p-2.5 rounded-lg border-none outline-none text-[#d1d7db] text-sm placeholder-[#8696a0]"
              style={{ background: "#2a3942" }}
              value={text}
              onChange={handleInputChange}
            />
            <button type="submit" className="text-[#8696a0] hover:text-[#00a884] transition-colors">
              <Send className="w-6 h-6" />
            </button>
          </form>
        </div>
      )}

      {isBlocked && (
         <div className="h-[62px] flex items-center justify-center bg-wa-unread-badge-text shrink-0 border-t border-wa-divider">
            <p className="text-[#8696a0] text-sm">You blocked this contact. Tap to unblock.</p>
            <button 
              onClick={() => unblockUser(selectedUser._id)}
              className="ml-2 text-[#00a884] font-medium text-sm hover:underline"
            >
               Unblock
            </button>
         </div>
      )}

      {/* Image Upload Preview Overlay */}
      {imagePreviewUrl && (
        <div className="absolute inset-0 z-100 flex flex-col bg-[#0b141a] animate-in fade-in zoom-in duration-200">
           {/* Preview Header */}
           <div className="h-[60px] flex items-center px-4 shrink-0 transition-all border-b border-wa-divider" style={{ background: '#202c33' }}>
             <button 
               onClick={() => { setImagePreviewUrl(null); setSelectedImage(null); }} 
               className="text-[#aebac1] hover:text-white p-2"
               title="Back"
             >
               <X className="w-6 h-6" />
             </button>
             <span className="text-[#e9edef] ml-4 font-medium">Preview</span>
           </div>

           {/* Preview Image */}
           <div className="flex-1 overflow-hidden flex items-center justify-center p-4 bg-black/40">
              <img 
                src={imagePreviewUrl} 
                alt="Upload preview" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
           </div>

           {/* Preview Footer */}
           <div className="p-4 flex items-center justify-center border-t border-wa-divider" style={{ background: '#202c33' }}>
              <div className="w-full max-w-md flex items-center gap-4">
                 <div className="flex-1 p-3 rounded-lg bg-[#2a3942] text-[#d1d7db] text-sm truncate">
                    {selectedImage?.name} ({(selectedImage?.size / 1024).toFixed(1)} KB)
                 </div>
                 <button 
                    onClick={async () => {
                       await sendMessage({ image: selectedImage });
                       setImagePreviewUrl(null);
                       setSelectedImage(null);
                    }}
                    className="w-14 h-14 rounded-full bg-[#00a884] flex items-center justify-center text-wa-unread-badge-text shadow-xl hover:bg-[#06cf9c] transition-all hover:scale-105 active:scale-95"
                 >
                    <Send className="w-7 h-7" />
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-xl p-6 shadow-2xl w-[300px]" style={{ background: "#233138" }}>
            <h3 className="text-[#e9edef] text-[16px] font-semibold mb-2">Delete Messages?</h3>
            <p className="text-[#8696a0] text-sm mb-5">
              {selectedCount} message{selectedCount > 1 ? "s" : ""} will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#aebac1] hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmed}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
