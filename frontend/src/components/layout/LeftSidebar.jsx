import React, { useEffect } from 'react';
import { MoreVertical, MessageSquarePlus, Search, Archive, BellOff, X, User, Loader, Menu, ArrowLeft, Check, CheckCheck, Users, Plus } from 'lucide-react';
import clsx from 'clsx';
import { useChatStore } from '../../store/useChatStore';
import { useGroupStore } from '../../store/useGroupStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate, useParams } from 'react-router-dom';
import Avatar from '../common/Avatar';
import { formatDistanceToNow } from 'date-fns';

import { format, isSameDay } from 'date-fns';

const FilterChip = ({ label, active }) => (
  <button className={clsx(
    "text-sm px-3 py-1.5 rounded-full whitespace-nowrap transition-colors select-none",
    active ? "bg-wa-chip-active text-wa-chip-active-text" : "bg-wa-chip text-wa-text-muted hover:bg-wa-bg-hover"
  )}>
    {label}
  </button>
);

const ChatItem = ({ user, onClick, active, isOnline, lastMsg, authUser, unreadCount, isTyping }) => {
  const isUnread = unreadCount > 0;
  const isSentByMe = lastMsg && lastMsg.senderId === authUser?._id;

  const time = lastMsg ? (isSameDay(new Date(lastMsg.createdAt), new Date()) 
    ? format(new Date(lastMsg.createdAt), "h:mm a") 
    : format(new Date(lastMsg.createdAt), "MM/dd/yy")) : "";
    
  return (
    <div 
      onClick={onClick}
      className={clsx(
        "flex px-3 py-3 hover:bg-wa-bg-hover cursor-pointer w-full group transition-colors",
        active && "bg-wa-bg-hover"
      )}
    >
      <Avatar user={user} showOnline={true} isOnline={isOnline} className="mr-3" />
      <div className="flex-1 min-w-0 border-b border-wa-divider pb-3 group-last:border-none flex flex-col justify-center">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-wa-text text-[17px] font-normal truncate max-w-[150px] sm:max-w-[180px] md:max-w-none">
             {user.username}
          </span>
          <span className={clsx(
             "text-[12px] shrink-0 ml-2",
             isUnread ? "text-wa-unread-badge font-semibold" : "text-wa-text-muted"
          )}>{time}</span>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center text-sm text-wa-text-muted truncate mr-2 flex-1">
            {isSentByMe && (
               <div className="mr-1 shrink-0">
                  {lastMsg.status === "sent" ? (
                     <Check className="w-3.5 h-3.5" />
                  ) : (
                     <CheckCheck className={clsx(
                        "w-3.5 h-3.5",
                        lastMsg.status === "read" && "text-wa-blue-tick"
                     )} />
                  )}
               </div>
            )}
            <span className={clsx(
               "truncate",
               isTyping ? "text-wa-accent italic font-medium" : (isUnread && "text-wa-text font-medium")
            )}>
              {isTyping ? "typing..." : (lastMsg ? lastMsg.text : (user.about || "Hey there! I am using WhatsApp."))}
            </span>
          </div>
          {isUnread && (
             <div className="bg-wa-unread-badge text-wa-unread-badge-text text-[11px] font-bold min-w-[20px] h-[20px] rounded-full flex items-center justify-center px-1.5 ml-2 mt-0.5 animate-in zoom-in-50 duration-300">
               {unreadCount}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};


const LeftSidebar = () => {
  const { users = [], getUsers, isUsersLoading, setSelectedUser, selectedUser, lastMessages, unreadCounts, setDrawerOpen, sidebarView, setSidebarView, typingUsers, usersPage, usersTotalPages } = useChatStore();
  const { groups, isLoading: isGroupsLoading, fetchGroups, setSelectedGroup } = useGroupStore();
  const { onlineUsers, authUser } = useAuthStore();
  const navigate = useNavigate();
  const { chatId } = useParams();
  const [activeFilter, setActiveFilter] = React.useState('All');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [usersSearchTerm, setUsersSearchTerm] = React.useState('');
  const [groupSearchTerm, setGroupSearchTerm] = React.useState('');
  const [showNewMenu, setShowNewMenu] = React.useState(false);

  // Initial load — chats view
  useEffect(() => {
    getUsers(1, '');
  }, []);

  // Fetch groups when groups view is active
  useEffect(() => {
    if (sidebarView === 'groups') fetchGroups();
  }, [sidebarView]);

  // Debounced search for users view
  useEffect(() => {
    if (sidebarView !== 'users') return;
    const t = setTimeout(() => getUsers(1, usersSearchTerm), 300);
    return () => clearTimeout(t);
  }, [usersSearchTerm, sidebarView]);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase());
    const hasChatHistory = !!lastMessages[user._id];
    
    // If in "Users" view, show everyone that matches search
    if (sidebarView === 'users') {
       return matchesSearch;
    }

    // Default "Chats" view logic
    // If not searching, only show users with chat history
    if (!searchTerm && activeFilter === 'All') {
      return hasChatHistory;
    }
    
    // If searching or using filters, show matching users
    if (activeFilter === 'All') return matchesSearch;
    if (activeFilter === 'Groups') return false; 
    if (activeFilter === 'Unread') return matchesSearch && hasChatHistory; 
    return matchesSearch;
  });

  // Sort by most recent message (latest message at top — like WhatsApp)
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const timeA = lastMessages[a._id]?.createdAt ? new Date(lastMessages[a._id].createdAt).getTime() : 0;
    const timeB = lastMessages[b._id]?.createdAt ? new Date(lastMessages[b._id].createdAt).getTime() : 0;
    return timeB - timeA; // descending — most recent first
  });

  return (
    <div className="w-full md:w-[400px] h-full bg-wa-bg border-r border-wa-divider flex flex-col shrink-0">
      {/* Header */}
      <div className="h-[60px] w-full flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-2">
            {(sidebarView === "users" || sidebarView === "groups") ? (
               <button 
                 onClick={() => setSidebarView("chats")}
                 className="p-2 -ml-2 hover:bg-wa-bg-hover rounded-full transition-colors text-wa-text-muted"
               >
                 <ArrowLeft className="w-6 h-6" />
               </button>
            ) : (
               <button 
                 onClick={() => setDrawerOpen(true)}
                 className="md:hidden p-2 -ml-2 hover:bg-wa-bg-hover rounded-full transition-colors text-wa-text-muted"
               >
                 <Menu className="w-6 h-6" />
               </button>
            )}
            
            {selectedUser && sidebarView === "chats" && (
                <button 
                  onClick={() => useChatStore.getState().setSidebarVisible(false)}
                  className="md:hidden p-2 -ml-2 hover:bg-wa-bg-hover rounded-full transition-colors text-wa-text-muted"
                >
                  <X className="w-6 h-6" />
                </button>
            )}
            <h1 className="text-xl font-bold text-wa-text">
               {sidebarView === "chats" ? "Chats" : sidebarView === "groups" ? "Groups" : "Select Contact"}
            </h1>
        </div>
        <div className="flex gap-2 relative">
          <button 
            onClick={() => setShowNewMenu(!showNewMenu)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-wa-text-muted hover:bg-wa-bg-hover transition-colors"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
          {/* Dropdown */}
          {showNewMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNewMenu(false)} />
              <div className="absolute right-0 top-12 z-50 rounded-lg shadow-xl py-2 w-48" style={{ background: '#233138' }}>
                <button
                  onClick={() => { setShowNewMenu(false); setSidebarView('users'); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#d1d7db] hover:bg-white/5 transition-colors"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  New Chat
                </button>
                <button
                  onClick={() => { setShowNewMenu(false); useChatStore.getState().setSidebarVisible(false); navigate('/groups'); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#d1d7db] hover:bg-white/5 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  New Group
                </button>
              </div>
            </>
          )}
          <button className="w-10 h-10 rounded-full flex items-center justify-center text-wa-text-muted hover:bg-wa-bg-hover transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2 w-full shrink-0">
        <div className="flex items-center bg-wa-bg-search rounded-lg px-4 py-[6px] w-full h-9">
          <Search className="w-4 h-4 text-wa-text-muted mr-3" />
          <input 
            type="text" 
            placeholder="Search or start a new chat" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-wa-text w-full placeholder-wa-text-muted pt-0.5"
          />
        </div>
      </div>

      {/* Content Area */}
      {sidebarView === 'groups' ? (
        /* ═══ GROUPS VIEW ═══ */
        <div className="flex-1 overflow-y-auto w-full">
          {isGroupsLoading ? (
            <div className="flex justify-center p-8"><Loader className="animate-spin text-wa-accent w-6 h-6" /></div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-20 h-20 rounded-full bg-wa-bg-hover flex items-center justify-center">
                <Users className="w-10 h-10 text-wa-text-muted" />
              </div>
              <p className="text-wa-text-muted text-sm">No groups yet</p>
              <button
                onClick={() => navigate('/groups')}
                className="px-4 py-2 bg-[#00a884] hover:bg-[#00a884]/80 text-white text-sm rounded-lg transition-colors"
              >
                Create Group
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              {groups
                .filter(g => !groupSearchTerm || g.name.toLowerCase().includes(groupSearchTerm.toLowerCase()))
                .map(group => {
                  const lastMsg = group.lastMessage;
                  const time = lastMsg ? (
                    isSameDay(new Date(lastMsg.createdAt), new Date())
                      ? format(new Date(lastMsg.createdAt), 'h:mm a')
                      : format(new Date(lastMsg.createdAt), 'MM/dd/yy')
                  ) : '';
                  return (
                    <div
                      key={group._id}
                      onClick={() => {
                        setSelectedGroup(group);
                        useChatStore.getState().setSidebarVisible(false);
                        navigate('/groups');
                      }}
                      className="flex px-3 py-3 hover:bg-wa-bg-hover cursor-pointer w-full group transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#00a884]/20 flex items-center justify-center shrink-0 mr-3">
                        <Users className="w-6 h-6 text-[#00a884]" />
                      </div>
                      <div className="flex-1 min-w-0 border-b border-wa-divider pb-3 group-last:border-none flex flex-col justify-center">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-wa-text text-[17px] font-normal truncate">{group.name}</span>
                          <span className="text-[12px] text-wa-text-muted shrink-0 ml-2">{time}</span>
                        </div>
                        <div className="text-sm text-wa-text-muted truncate">
                          {lastMsg
                            ? `${lastMsg.senderId?.username || 'Someone'}: ${lastMsg.text || 'Media'}`
                            : `${group.members?.length || 0} members`}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      ) : (
        /* ═══ CHATS / USERS VIEW ═══ */
        <>
          {/* Filters */}
          <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-hide">
            <div onClick={() => setActiveFilter('All')}>
              <FilterChip label="All" active={activeFilter === 'All'} />
            </div>
            <div onClick={() => setActiveFilter('Unread')}>
              <FilterChip label="Unread" active={activeFilter === 'Unread'} />
            </div>
            <div onClick={() => { setActiveFilter('Groups'); setSidebarView('groups'); }}>
              <FilterChip label="Groups" active={activeFilter === 'Groups'} />
            </div>
            <FilterChip label="+" active={false} />
          </div>



          {/* Chat List */}
          <div className="flex-1 overflow-y-auto w-full">
             <div className="flex flex-col">
                {isUsersLoading ? (
                   <div className="flex justify-center p-8"><Loader className="animate-spin text-wa-accent w-6 h-6" /></div>
                ) : sortedUsers.length === 0 ? (
                   <div className="p-8 text-center text-wa-text-muted text-sm italic">
                      {searchTerm ? "No contacts found matching your search" : "No contacts available"}
                   </div>
                ) : (
                    sortedUsers.map(user => (
                      <ChatItem 
                        key={user._id} 
                        user={user} 
                        lastMsg={lastMessages[user._id]}
                        isTyping={!!typingUsers[user._id]}
                        onClick={() => {
                            setSelectedUser(user);
                            useChatStore.getState().setSidebarVisible(false);
                            navigate(`/chat/${user._id}`);
                        }}
                        active={chatId === user._id}
                        isOnline={onlineUsers.includes(user._id)}
                        authUser={authUser}
                        unreadCount={unreadCounts[user._id] || 0}
                      />
                    ))
                )}
             </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LeftSidebar;
