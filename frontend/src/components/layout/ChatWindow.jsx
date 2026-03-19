import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useChatStore } from "../../store/useChatStore";
import { useAuthStore } from "../../store/useAuthStore";
import { axiosInstance } from "../../lib/axios";
import { Send, Image, Loader, Phone, Video, Search, MoreVertical, Smile, ArrowLeft, Check, CheckCheck, Trash2, X, CheckSquare, Copy, Reply, Forward, Pin } from "lucide-react";
import { format } from "date-fns";
import clsx from "clsx";
import Avatar from "../common/Avatar";
import toast from "react-hot-toast";

const ChatWindow = () => {
  const { 
    messages, getMessages, isMessagesLoading, selectedUser, setSelectedUser, 
    users, sendMessage, setSidebarVisible, setChatActive,  
    markMessagesAsRead, typingUsers, setTypingStatus,
    loadMoreMessages, hasMoreMessages, isLoadingMore
  } = useChatStore();
  const { authUser, onlineUsers } = useAuthStore();
  const { chatId } = useParams();

  const [text, setText] = useState("");
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const messageEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const menuRef = useRef(null);
  const [contextMenu, setContextMenu] = useState(null); // { msgId, x, y, isMine, text }
  const longPressTimerRef = useRef(null);

  const authId = String(authUser?._id);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
      // Close context menu on any click outside
      if (contextMenu) setContextMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

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
      await axiosInstance.delete("/messages/delete", { data: { messageIds: ids } });
      // Remove deleted messages from store
      useChatStore.setState(state => ({
        messages: state.messages.filter(m => !ids.includes(m._id))
      }));
      toast.success(`${ids.length} message${ids.length > 1 ? "s" : ""} deleted`);
    } catch {
      toast.error("Delete failed. Please try again.");
    } finally {
      setShowDeleteConfirm(false);
      exitSelectMode();
    }
  }, [selectedMsgIds, exitSelectMode]);

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
  }, [chatId]);

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
    if (!text.trim()) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTypingStatus(false);
    await sendMessage({ text: text.trim() });
    setText("");
    setTimeout(() => messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 60);
  }, [text, sendMessage, setTypingStatus]);

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
                  {isTyping ? "typing..." : (isOnline ? "online" : "offline")}
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
                </div>
              )}
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
            const isMine = String(msg.senderId) === authId;
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
              >
                {isSelecting && (
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-[#00a884] border-[#00a884]" : "border-[#8696a0]"} ${isMine ? "order-last ml-1" : "order-first mr-1"}`}>
                    {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-3 pt-1.5 pb-1 rounded-lg text-[14px] leading-relaxed shadow-md ${isMine ? "rounded-tr-none" : "rounded-tl-none"}`}
                  style={{ background: isMine ? "#005c4b" : "#202c33", color: "#e9edef" }}
                >
                  <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.text}</p>
                  <div className="flex justify-end items-center gap-1 mt-0.5">
                    <span style={{ fontSize: "10px", color: "#8696a0" }}>{format(new Date(msg.createdAt), "h:mm a")}</span>
                    {isMine && (
                      msg.status === "sent"
                        ? <Check className="w-3.5 h-3.5 text-[#8696a0]" />
                        : <CheckCheck className={clsx("w-3.5 h-3.5", msg.status === "read" ? "text-[#53bdeb]" : "text-[#8696a0]")} />
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
            className="w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-3"
          >
            <Copy className="w-4 h-4 text-[#8696a0]" /> Copy
          </button>
          <button
            onClick={handleSelectFromContext}
            className="w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-3"
          >
            <CheckSquare className="w-4 h-4 text-[#8696a0]" /> Select
          </button>
          <button
            className="w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-3 opacity-60"
          >
            <Reply className="w-4 h-4 text-[#8696a0]" /> Reply
          </button>
          <button
            className="w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-3 opacity-60"
          >
            <Forward className="w-4 h-4 text-[#8696a0]" /> Forward
          </button>
          <button
            className="w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-3 opacity-60"
          >
            <Pin className="w-4 h-4 text-[#8696a0]" /> Pin
          </button>
          {contextMenu.isMine && (
            <button
              onClick={handleDeleteFromContext}
              className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/10 transition-colors flex items-center gap-3"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
        </div>
      )}

      {/* Input area */}
      {!isSelecting && (
        <div className="h-[62px] flex items-center px-4 gap-3 shrink-0" style={{ background: "#202c33" }}>
          <Smile className="text-[#8696a0] cursor-pointer hover:text-[#e9edef]" />
          <Image className="text-[#8696a0] cursor-pointer hover:text-[#e9edef]" />
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
