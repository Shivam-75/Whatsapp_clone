import React, { useEffect, useState, useRef, useCallback } from 'react';
import clsx from 'clsx';
import { useChatStore } from '../store/useChatStore';
import { useGroupStore } from '../store/useGroupStore';
import { useAuthStore } from '../store/useAuthStore';
import { ArrowLeft, Plus, X, Send, Loader, Users, Check, Search, Trash2, Reply, Forward, Pin, Image, MoreVertical, CheckSquare } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Avatar from '../components/common/Avatar';
import { axiosInstance } from '../lib/axios';
import { getMediaUrl } from '../lib/utils';

// ═══════════════════════════════════════════
//  CREATE GROUP MODAL
// ═══════════════════════════════════════════
const CreateGroupModal = ({ onClose, onCreate }) => {
  const [step, setStep] = useState(1); // 1 = select members, 2 = set name
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [chatContacts, setChatContacts] = useState([]); // users you've chatted with
  const [searchResults, setSearchResults] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const { authUser } = useAuthStore();
  const searchTimeoutRef = useRef(null);

  // Fetch chat contacts on mount (users you've messaged)
  useEffect(() => {
    const fetchChatContacts = async () => {
      try {
        // Use the sidebar users endpoint which returns users with message history
        const res = await axiosInstance.get("/users?limit=5");
        const usersList = res.data.users || res.data;
        setChatContacts(Array.isArray(usersList) ? usersList.filter(u => String(u._id) !== String(authUser._id)) : []);
      } catch { }
      setIsLoadingUsers(false);
    };
    fetchChatContacts();
  }, []);

  // Search all users when typing
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await axiosInstance.get(`/users?q=${encodeURIComponent(search.trim())}&limit=20`);
        const usersList = res.data.users || res.data;
        setSearchResults(Array.isArray(usersList) ? usersList.filter(u => String(u._id) !== String(authUser._id)) : []);
      } catch { }
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [search]);

  // Show search results when searching, otherwise show chat contacts
  const displayUsers = search.trim() ? searchResults : chatContacts;

  const toggleUser = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleCreate = () => {
    if (!groupName.trim() || selectedIds.length === 0) return;
    onCreate({ name: groupName.trim(), memberIds: selectedIds });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-90 bg-black/80 flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-md shadow-2xl flex flex-col" style={{ background: '#1a2e35', maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <button onClick={step === 2 ? () => setStep(1) : onClose} className="text-white/60 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-white text-lg font-semibold">
            {step === 1 ? 'Add Members' : 'New Group'}
          </h2>
        </div>

        {step === 1 ? (
          <>
            {/* Selected chips */}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap gap-2 px-5 pt-3">
                {selectedIds.map(id => {
                  const u = [...chatContacts, ...searchResults].find(a => a._id === id);
                  return u ? (
                    <span key={id} className="flex items-center gap-1 bg-[#00a884]/20 text-[#00a884] text-xs px-2.5 py-1 rounded-full">
                      {u.username}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => toggleUser(id)} />
                    </span>
                  ) : null;
                })}
              </div>
            )}
            {/* Search */}
            <div className="px-5 py-3">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search contacts..."
                className="w-full bg-white/10 text-white rounded-lg px-3 py-2 text-sm border-none outline-none placeholder-white/40"
              />
            </div>
            {/* User list */}
            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {isLoadingUsers || isSearching ? (
                <div className="flex justify-center py-6"><Loader className="w-5 h-5 animate-spin text-[#00a884]" /></div>
              ) : displayUsers.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-6">{search.trim() ? 'No users found' : 'No chat contacts yet'}</p>
              ) : (
                displayUsers.map(u => {
                  const isSelected = selectedIds.includes(u._id);
                  return (
                    <div
                      key={u._id}
                      onClick={() => toggleUser(u._id)}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-wa-accent/60 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {u.profilePic ? (
                          <img src={getMediaUrl(u.profilePic)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{u.username?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{u.username}</p>
                        <p className="text-white/40 text-xs truncate">{u.about || 'Hey there!'}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-[#00a884] border-[#00a884]' : 'border-white/30'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {/* Next button */}
            {selectedIds.length > 0 && (
              <div className="flex justify-end px-5 pb-4">
                <button
                  onClick={() => setStep(2)}
                  className="w-12 h-12 rounded-full bg-[#00a884] hover:bg-[#00a884]/80 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-white rotate-180" />
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Group Name */}
            <div className="flex flex-col items-center gap-4 px-5 py-8">
              <div className="w-20 h-20 rounded-full bg-[#00a884]/20 flex items-center justify-center">
                <Users className="w-10 h-10 text-[#00a884]" />
              </div>
              <input
                autoFocus
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Group name"
                className="w-full bg-transparent border-b-2 border-[#00a884] text-white text-center text-xl py-2 outline-none placeholder-white/40"
                maxLength={50}
              />
              <p className="text-white/40 text-xs">{selectedIds.length} participants</p>
            </div>
            {/* Create */}
            <div className="flex justify-end px-5 pb-5">
              <button
                onClick={handleCreate}
                disabled={!groupName.trim()}
                className="w-12 h-12 rounded-full bg-[#00a884] hover:bg-[#00a884]/80 flex items-center justify-center transition-colors disabled:opacity-40"
              >
                <Check className="w-6 h-6 text-white" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
//  GROUP CHAT VIEW
// ═══════════════════════════════════════════
const GroupChatView = ({ group, onBack }) => {
  const { authUser } = useAuthStore();
  const { groupMessages, fetchGroupMessages, sendGroupMessage, isMessagesLoading, deleteGroup, deleteGroupMessages, replyingTo, setReplyingTo, pinMessage, forwardMessage } = useGroupStore();
  const { users } = useChatStore();
  const [text, setText] = useState("");
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());
  const [contextMenu, setContextMenu] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMsgId, setForwardMsgId] = useState(null);
  const [forwardSearch, setForwardSearch] = useState("");
  const [selectedTargets, setSelectedTargets] = useState({ userIds: [], groupIds: [] });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const messageEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const authId = String(authUser._id);
  const isAdmin = String(group.admin?._id || group.admin) === authId;
  const menuRef = useRef(null);

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this group?")) {
      deleteGroup(group._id);
      onBack();
    }
  };

  const toggleSelect = (id) => {
    setSelectedMsgIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setIsSelecting(false);
      return next;
    });
  };

  const handleDeleteMessages = async () => {
    const ids = Array.from(selectedMsgIds);
    if (window.confirm(`Delete ${ids.length} selected messages?`)) {
      await deleteGroupMessages(group._id, ids);
      setSelectedMsgIds(new Set());
      setIsSelecting(false);
    }
  };

  useEffect(() => {
    if (group?._id) fetchGroupMessages(group._id);
  }, [group?._id]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [groupMessages]);

  useEffect(() => {
    const handleOutside = (e) => {
      setContextMenu(null);
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    window.addEventListener('click', handleOutside);
    window.addEventListener('contextmenu', handleOutside);
    return () => {
      window.removeEventListener('click', handleOutside);
      window.removeEventListener('contextmenu', handleOutside);
    };
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() && !selectedImage) return;
    
    const payload = { text: text.trim() };
    if (selectedImage) payload.image = selectedImage;
    if (replyingTo) payload.replyTo = replyingTo._id;

    await sendGroupMessage(group._id, payload);
    
    setText('');
    setSelectedImage(null);
    setImagePreviewUrl(null);
    setReplyingTo(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
       toast.error("Please select an image file");
       return;
    }
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    e.target.value = null;
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#0b141a' }}>
      {/* Header */}
      {isSelecting ? (
        <div className="h-[60px] flex items-center justify-between px-4 shrink-0 transition-all border-l border-wa-divider" style={{ background: '#2a3942' }}>
          <div className="flex items-center gap-4">
            <button onClick={() => { setIsSelecting(false); setSelectedMsgIds(new Set()); }} className="text-[#aebac1] hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <span className="text-[#e9edef] font-medium text-lg">{selectedMsgIds.size} selected</span>
          </div>
          <button onClick={handleDeleteMessages} className="text-red-400 hover:text-red-300 p-2 transition-transform active:scale-90" title="Delete selected">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="h-[60px] flex items-center gap-3 px-4 shrink-0 border-l border-wa-divider" style={{ background: '#202c33' }}>
          <button onClick={onBack} className="text-white/60 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-[#00a884]/30 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-[#00a884]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#e9edef] text-[16px] font-medium truncate">{group.name}</p>
            <p className="text-[#8696a0] text-xs truncate">
              {group.members?.map(m => m.username || m).join(', ')}
            </p>
          </div>

          <div className="flex items-center gap-1 relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className={clsx(
                "p-2 rounded-full transition-colors",
                showMenu ? "bg-white/10 text-white" : "text-[#8696a0] hover:bg-white/10 hover:text-[#e9edef]"
              )}
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-[#2a3942] rounded-lg shadow-2xl border border-wa-divider py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <button
                  onClick={() => { setIsSelecting(true); setShowMenu(false); }}
                  className="w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 flex items-center gap-3 transition-colors"
                >
                  <CheckSquare className="w-4 h-4 text-[#8696a0]" /> 
                  Select Messages
                </button>
                {isAdmin && (
                  <button
                    onClick={() => { handleDelete(); setShowMenu(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/10 flex items-center gap-3 transition-colors border-t border-wa-divider"
                  >
                    <Trash2 className="w-4 h-4" /> 
                    Delete Group
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {isMessagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader className="animate-spin text-[#00a884] w-8 h-8" />
          </div>
        ) : groupMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#8696a0] text-sm">No messages yet. Say hi! 👋</p>
          </div>
        ) : (
          groupMessages.map((msg) => {
            const isMine = String(msg.senderId?._id || msg.senderId) === authId;
            const senderName = msg.senderId?.username || 'User';
            const isSelected = selectedMsgIds.has(msg._id);

            return (
              <div 
                key={msg._id} 
                id={`msg-${msg._id}`}
                className={clsx(
                  "flex w-full group relative transition-all duration-200",
                  isMine ? 'justify-end' : 'justify-start',
                  isSelected && "bg-wa-accent/5"
                )}
                onClick={() => isSelecting && toggleSelect(msg._id)}
                onContextMenu={(e) => {
                   e.preventDefault();
                   setContextMenu({
                     x: Math.min(e.pageX, window.innerWidth - 220),
                     y: Math.min(e.pageY, window.innerHeight - 250),
                     msgId: msg._id,
                     text: msg.text,
                     isMine
                   });
                }}
              >
                <div
                  className={clsx(
                    "max-w-[75%] px-3 pt-1.5 pb-1 rounded-lg text-[14px] leading-relaxed shadow-md cursor-pointer transition-transform relative",
                    isMine ? 'rounded-tr-none' : 'rounded-tl-none',
                    isSelected && "ring-2 ring-wa-accent ring-inset"
                  )}
                  style={{ background: isMine ? '#005c4b' : '#202c33', color: '#e9edef' }}
                >
                  {!isMine && (
                    <p className="text-[#00a884] text-xs font-semibold mb-0.5">{senderName}</p>
                  )}

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
                        {msg.replyTo.senderId?._id === authId ? "You" : (msg.replyTo.senderId?.username || "User")}
                      </p>
                      <p className="text-[12px] text-[#8696a0] truncate line-clamp-1 italic">
                        {msg.replyTo.text || "Message"}
                      </p>
                    </div>
                  )}

                  {msg.image && (
                    <div className="mb-2 rounded overflow-hidden cursor-pointer hover:opacity-95 transition-all">
                      <img 
                        src={getMediaUrl(msg.image)} 
                        alt="Message" 
                        className="max-w-full h-auto object-cover"
                        onClick={() => window.open(getMediaUrl(msg.image), '_blank')}
                      />
                    </div>
                  )}

                  <div className="flex flex-col">
                    <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.text}</p>
                    <div className="flex justify-end items-center gap-1 mt-0.5">
                      <span style={{ fontSize: '10px', color: '#8696a0' }}>
                        {msg.createdAt ? format(new Date(msg.createdAt), 'h:mm a') : ''}
                      </span>
                      {msg.isPinned && <Pin className="w-3 h-3 text-[#00a884]" />}
                    </div>
                  </div>
                  
                  {/* Select indicator */}
                  {isSelecting && (
                    <div className={clsx(
                      "absolute top-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      isSelected ? "bg-wa-accent border-wa-accent" : "border-[#8696a0]",
                      isMine ? "-left-8" : "-right-8"
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messageEndRef} />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 w-[180px] bg-[#233138] rounded-xl shadow-2xl border border-wa-divider overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => { setIsSelecting(true); toggleSelect(contextMenu.msgId); setContextMenu(null); }}
            className="w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-3"
          >
             Select
          </button>
          <button
            onClick={() => { setReplyingTo({ _id: contextMenu.msgId, text: contextMenu.text, senderId: contextMenu.isMine ? authId : 'other' }); setContextMenu(null); }}
            className="w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-3"
          >
            <Reply className="w-4 h-4 text-[#8696a0]" /> Reply
          </button>
          <button
            onClick={() => { setForwardMsgId(contextMenu.msgId); setShowForwardModal(true); setContextMenu(null); }}
            className="w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-3"
          >
            <Forward className="w-4 h-4 text-[#8696a0]" /> Forward
          </button>
          <button
            onClick={() => { pinMessage(contextMenu.msgId); setContextMenu(null); }}
            className="w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 transition-colors flex items-center gap-3"
          >
            <Pin className="w-4 h-4 text-[#8696a0]" /> Pin
          </button>
        </div>
      )}

      {/* Forward Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[500px]" style={{ background: "#202c33" }}>
            <div className="p-4 flex items-center justify-between border-b border-wa-divider" style={{ background: "#2a3942" }}>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowForwardModal(false)} className="text-[#aebac1] hover:text-white">
                  <X className="w-6 h-6" />
                </button>
                <h3 className="text-[#e9edef] font-medium text-lg">Forward message</h3>
              </div>
            </div>
            
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
                <input 
                  type="text"
                  placeholder="Search contacts"
                  value={forwardSearch}
                  onChange={(e) => setForwardSearch(e.target.value)}
                  className="w-full bg-[#2a3942] border-none rounded-lg py-2 pl-10 pr-4 text-sm text-[#d1d7db] outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-20">
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
                    className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <Avatar user={u} size="md" />
                    <span className="text-[#e9edef] text-[15px] flex-1 text-left">{u.username}</span>
                    {isSelected && <div className="w-5 h-5 bg-[#00a884] rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" strokeWidth={4} /></div>}
                  </button>
                );
              })}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-wa-divider bg-[#2a3942] flex items-center justify-between">
              <span className="text-sm text-[#8696a0]">{selectedTargets.userIds.length} selected</span>
              <button 
                disabled={selectedTargets.userIds.length === 0}
                onClick={async () => {
                  await forwardMessage(forwardMsgId, selectedTargets.userIds, []);
                  setShowForwardModal(false);
                  setSelectedTargets({ userIds: [], groupIds: [] });
                }}
                className="bg-[#00a884] text-wa-unread-badge-text rounded-full p-3 disabled:opacity-50"
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
              Replying to {String(replyingTo.senderId?._id || replyingTo.senderId) === authId ? "yourself" : "User"}
            </p>
            <p className="text-sm text-[#8696a0] truncate italic">
              {replyingTo.text || "Message"}
            </p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="text-[#8696a0] hover:text-[#e9edef] p-1">
            <X className="w-5 h-5" />
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
                    onClick={handleSend}
                    className="w-14 h-14 rounded-full bg-[#00a884] flex items-center justify-center text-wa-unread-badge-text shadow-xl hover:bg-[#06cf9c] transition-all hover:scale-105 active:scale-95"
                 >
                    <Send className="w-7 h-7" />
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Input */}
      <div className="h-[62px] flex items-center px-4 gap-3 shrink-0" style={{ background: '#202c33' }}>
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
        <form onSubmit={handleSend} className="flex-1 flex gap-3">
          <input
            type="text"
            placeholder="Type a message"
            className="flex-1 p-2.5 rounded-lg border-none outline-none text-[#d1d7db] text-sm placeholder-[#8696a0]"
            style={{ background: '#2a3942' }}
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <button type="submit" className="text-[#8696a0] hover:text-[#00a884] transition-colors">
            <Send className="w-6 h-6" />
          </button>
        </form>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
//  MAIN GROUPS PAGE
// ═══════════════════════════════════════════
const GroupsPage = () => {
  const { authUser } = useAuthStore();
  const { setSidebarVisible } = useChatStore();
  const { groups, isLoading, fetchGroups, createGroup, selectedGroup, setSelectedGroup, deleteGroup } = useGroupStore();
  const [showCreate, setShowCreate] = useState(false);
  const [listContextMenu, setListContextMenu] = useState(null); // { x, y, groupId, isAdmin }
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const sidebarMenuRef = useRef(null);

  useEffect(() => {
    fetchGroups();
    
    const handleClick = (e) => {
      setListContextMenu(null);
      if (sidebarMenuRef.current && !sidebarMenuRef.current.contains(e.target)) {
        setShowSidebarMenu(false);
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleCreate = async (data) => {
    await createGroup(data);
    setShowCreate(false);
  };

  // If a group is selected, show group chat
  if (selectedGroup) {
    return (
      <GroupChatView
        group={selectedGroup}
        onBack={() => setSelectedGroup(null)}
      />
    );
  }

  return (
    <div className="h-full w-full bg-wa-bg flex flex-col">
      {/* Header */}
      {isSelectMode ? (
        <div className="h-[60px] flex items-center justify-between px-4 shrink-0 border-b border-wa-divider" style={{ background: '#2a3942' }}>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setIsSelectMode(false); setSelectedGroupIds(new Set()); }} 
              className="text-[#aebac1] hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <span className="text-[#e9edef] font-medium text-lg">{selectedGroupIds.size} selected</span>
          </div>
          <button 
            disabled={selectedGroupIds.size === 0}
            onClick={async () => {
               if (window.confirm(`Delete ${selectedGroupIds.size} selected groups?`)) {
                 for (const id of selectedGroupIds) {
                   await deleteGroup(id);
                 }
                 setSelectedGroupIds(new Set());
                 setIsSelectMode(false);
               }
            }}
            className="text-red-400 hover:text-red-300 disabled:opacity-50 p-2 transition-transform active:scale-90"
          >
            <Trash2 className="w-6 h-6" />
          </button>
        </div>
      ) : (
        <div className="h-[60px] flex items-center justify-between px-4 shrink-0 border-b border-wa-divider" style={{ background: '#202c33' }}>
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarVisible(true)} className="text-wa-text-muted hover:text-wa-text transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-wa-text">Groups</h1>
          </div>
          
          <div className="flex items-center gap-2 relative" ref={sidebarMenuRef}>
            <button
              onClick={() => setShowCreate(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#aebac1] hover:bg-white/10 hover:text-[#00a884] transition-colors"
              title="New Group"
            >
              <Plus className="w-5 h-5" />
            </button>
            
            <button 
              onClick={() => setShowSidebarMenu(!showSidebarMenu)}
              className={clsx(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                showSidebarMenu ? "bg-white/10 text-white" : "text-[#aebac1] hover:bg-white/10 hover:text-white"
              )}
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showSidebarMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-[#2a3942] rounded-lg shadow-2xl border border-wa-divider py-2 z-[110] animate-in fade-in slide-in-from-top-2 duration-200">
                <button
                  onClick={() => { setIsSelectMode(true); setShowSidebarMenu(false); }}
                  className="w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 flex items-center gap-3 transition-colors"
                >
                  <CheckSquare className="w-4 h-4 text-[#8696a0]" /> 
                  Select Groups
                </button>
                <button
                  onClick={() => { setShowCreate(true); setShowSidebarMenu(false); }}
                  className="w-full text-left px-4 py-3 text-sm text-[#e9edef] hover:bg-white/10 flex items-center gap-3 transition-colors"
                >
                  <Plus className="w-4 h-4 text-[#8696a0]" /> 
                  New Group
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Groups list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader className="w-6 h-6 animate-spin text-[#00a884]" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-20 h-20 rounded-full bg-wa-bg-hover flex items-center justify-center">
              <Users className="w-10 h-10 text-wa-text-muted" />
            </div>
            <p className="text-wa-text-muted text-sm">No groups yet. Create one!</p>
          </div>
        ) : (
          groups.map((group) => {
            const lastMsg = group.lastMessage;
            const isSelected = selectedGroupIds.has(group._id);

            return (
              <div
                key={group._id}
                onClick={() => {
                  if (isSelectMode) {
                    setSelectedGroupIds(prev => {
                      const next = new Set(prev);
                      if (next.has(group._id)) next.delete(group._id);
                      else next.add(group._id);
                      return next;
                    });
                  } else {
                    setSelectedGroup(group);
                  }
                }}
                onContextMenu={(e) => {
                  if (isSelectMode) return;
                  e.preventDefault();
                  const isGroupAdmin = String(group.admin?._id || group.admin) === String(authUser?._id);
                  setListContextMenu({
                    x: e.pageX,
                    y: e.pageY,
                    groupId: group._id,
                    isAdmin: isGroupAdmin
                  });
                }}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-wa-divider relative",
                  isSelected ? "bg-[#2a3942]" : "hover:bg-wa-bg-hover"
                )}
              >
                {isSelectMode && (
                  <div className="shrink-0 mr-2">
                    <div className={clsx(
                      "w-5 h-5 rounded border flex items-center justify-center transition-all",
                      isSelected ? "bg-[#00a884] border-[#00a884]" : "border-[#8696a0]"
                    )}>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white font-bold" />}
                    </div>
                  </div>
                )}
                <div className="w-12 h-12 rounded-full bg-[#00a884]/20 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-[#00a884]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-wa-text text-[16px] font-medium truncate">{group.name}</p>
                    {lastMsg && (
                      <span className="text-wa-text-muted text-xs shrink-0 ml-2">
                        {formatDistanceToNow(new Date(lastMsg.createdAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <p className="text-wa-text-muted text-sm truncate">
                    {lastMsg
                      ? `${lastMsg.senderId?.username || 'Someone'}: ${lastMsg.text || 'Media'}`
                      : `${group.members?.length || 0} members`}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* List Context Menu */}
      {listContextMenu && (
        <div 
          className="fixed z-110 w-[180px] bg-[#233138] rounded-xl shadow-2xl border border-wa-divider overflow-hidden animate-in fade-in zoom-in duration-100"
          style={{ left: listContextMenu.x, top: listContextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {listContextMenu.isAdmin ? (
            <button
              onClick={() => {
                if (window.confirm("Delete this group for everyone?")) {
                  deleteGroup(listContextMenu.groupId);
                }
                setListContextMenu(null);
              }}
              className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-wa-bg-hover transition-colors flex items-center gap-3"
            >
              <Trash2 className="w-4 h-4" /> Delete Group
            </button>
          ) : (
            <div className="px-4 py-3 text-sm text-[#8696a0] italic">
              Only admins can delete groups
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
};

export default GroupsPage;
