import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useChatStore } from '../store/useChatStore';
import { useGroupStore } from '../store/useGroupStore';
import { useAuthStore } from '../store/useAuthStore';
import { ArrowLeft, Plus, X, Send, Loader, Users, Check, Search } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Avatar from '../components/common/Avatar';
import { axiosInstance } from '../lib/axios';

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
                          <img src={u.profilePic} alt="" className="w-full h-full object-cover" />
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
  const [text, setText] = useState('');
  const { authUser } = useAuthStore();
  const { groupMessages, fetchGroupMessages, sendGroupMessage, isMessagesLoading } = useGroupStore();
  const messageEndRef = useRef(null);
  const authId = String(authUser._id);

  useEffect(() => {
    if (group?._id) fetchGroupMessages(group._id);
  }, [group?._id]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [groupMessages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await sendGroupMessage(group._id, { text: text.trim() });
    setText('');
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#0b141a' }}>
      {/* Header */}
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
      </div>

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
            return (
              <div key={msg._id} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] px-3 pt-1.5 pb-1 rounded-lg text-[14px] leading-relaxed shadow-md ${isMine ? 'rounded-tr-none' : 'rounded-tl-none'}`}
                  style={{ background: isMine ? '#005c4b' : '#202c33', color: '#e9edef' }}
                >
                  {!isMine && (
                    <p className="text-[#00a884] text-xs font-semibold mb-0.5">{senderName}</p>
                  )}
                  <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.text}</p>
                  <div className="flex justify-end items-center gap-1 mt-0.5">
                    <span style={{ fontSize: '10px', color: '#8696a0' }}>
                      {msg.createdAt ? format(new Date(msg.createdAt), 'h:mm a') : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messageEndRef} />
      </div>

      {/* Input */}
      <div className="h-[62px] flex items-center px-4 gap-3 shrink-0" style={{ background: '#202c33' }}>
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
  const { setSidebarVisible } = useChatStore();
  const { groups, isLoading, fetchGroups, createGroup, selectedGroup, setSelectedGroup } = useGroupStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchGroups();
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
      <div className="h-[60px] flex items-center justify-between px-4 shrink-0 border-b border-wa-divider" style={{ background: '#202c33' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarVisible(true)} className="text-wa-text-muted hover:text-wa-text transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-wa-text">Groups</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-[#00a884] hover:bg-[#00a884]/80 transition-colors"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

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
            return (
              <div
                key={group._id}
                onClick={() => setSelectedGroup(group)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-wa-bg-hover cursor-pointer transition-colors border-b border-wa-divider"
              >
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
