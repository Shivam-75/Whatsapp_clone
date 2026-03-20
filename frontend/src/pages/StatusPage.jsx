import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useChatStore } from '../store/useChatStore';
import { useStatusStore } from '../store/useStatusStore';
import { useAuthStore } from '../store/useAuthStore';
import { ArrowLeft, Plus, X, Send, Image, Loader, Eye, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../components/common/Avatar';
import { getMediaUrl } from '../lib/utils';

const STATUS_COLORS = [
  '#00a884', '#128C7E', '#075E54',
  '#e11d48', '#be123c', '#9f1239',
  '#7c3aed', '#6d28d9', '#5b21b6',
  '#2563eb', '#1d4ed8', '#1e40af',
  '#ea580c', '#c2410c', '#9a3412',
  '#0d9488', '#0f766e', '#115e59',
];

// ═══════════════════════════════════════════
//  STATUS VIEWER (Fullscreen Overlay)
// ═══════════════════════════════════════════
const StatusViewer = ({ statusGroup, onClose, onView, isOwnStatus }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const viewedIdsRef = useRef(new Set()); // Track already-viewed IDs to prevent duplicate API calls
  const DURATION = 5000; // 5 seconds per status
  const TICK = 50;

  const statuses = statusGroup.statuses;
  const current = statuses[currentIdx];

  // Mark as viewed (only once per session)
  useEffect(() => {
    if (current && !isOwnStatus && !viewedIdsRef.current.has(current._id)) {
      viewedIdsRef.current.add(current._id);
      onView(current._id);
    }
  }, [current?._id]);

  // Auto-advance timer
  useEffect(() => {
    setProgress(0);
    timerRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + (TICK / DURATION) * 100;
        if (next >= 100) {
          clearInterval(timerRef.current);
          // Go next or close
          if (currentIdx < statuses.length - 1) {
            setCurrentIdx(i => i + 1);
          } else {
            onClose();
          }
          return 100;
        }
        return next;
      });
    }, TICK);
    return () => clearInterval(timerRef.current);
  }, [currentIdx]);

  const goNext = () => {
    clearInterval(timerRef.current);
    if (currentIdx < statuses.length - 1) setCurrentIdx(i => i + 1);
    else onClose();
  };
  const goPrev = () => {
    clearInterval(timerRef.current);
    if (currentIdx > 0) setCurrentIdx(i => i - 1);
    else setProgress(0);
  };

  if (!current) return null;

  const user = statusGroup.user || current.userId;

  return (
    <div className="fixed inset-0 z-100 bg-black flex flex-col">
      {/* Progress bars */}
      <div className="flex gap-1 px-3 pt-3 pb-1 shrink-0">
        {statuses.map((_, i) => (
          <div key={i} className="flex-1 h-[3px] bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{
                width: i < currentIdx ? '100%' : i === currentIdx ? `${progress}%` : '0%',
                transition: i === currentIdx ? 'none' : 'width 0.2s'
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 shrink-0">
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="w-9 h-9 rounded-full overflow-hidden bg-wa-accent/60 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {user.profilePic ? (
            <img src={user.profilePic} alt="" className="w-full h-full object-cover" />
          ) : (
            <span>{user.username?.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{user.username}</p>
          <p className="text-white/50 text-xs">{formatDistanceToNow(new Date(current.createdAt), { addSuffix: true })}</p>
        </div>
        {isOwnStatus && (
          <div className="flex items-center gap-2 text-white/60 text-xs">
            <Eye className="w-4 h-4" />
            <span>{current.viewers?.length || 0}</span>
          </div>
        )}
        <button onClick={onClose} className="text-white/60 hover:text-white ml-2">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Status Content */}
      <div className="flex-1 flex items-center justify-center relative select-none">
        {/* Left / Right tap areas */}
        <div className="absolute left-0 top-0 w-1/3 h-full z-10 cursor-pointer" onClick={goPrev} />
        <div className="absolute right-0 top-0 w-1/3 h-full z-10 cursor-pointer" onClick={goNext} />

        {current.type === 'text' ? (
          <div
            className="w-full h-full flex items-center justify-center px-8"
            style={{ backgroundColor: current.backgroundColor || '#00a884' }}
          >
            <p className="text-white text-2xl md:text-3xl font-semibold text-center leading-relaxed max-w-lg wrap-break-word">
              {current.content}
            </p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black">
            <img
              src={getMediaUrl(current.content)}
              alt=""
              className="max-w-full max-h-[80vh] object-contain"
            />
            {current.caption && (
              <p className="text-white text-sm mt-3 px-6 text-center max-w-md">{current.caption}</p>
            )}
          </div>
        )}
      </div>

      {/* Viewer list panel for own statuses */}
      {isOwnStatus && (
        <div className="shrink-0 border-t border-white/10 px-4 py-3" style={{ background: '#111b21', maxHeight: '35vh', overflowY: 'auto' }}>
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-white/60" />
            <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
              {current.viewers?.length || 0} {current.viewers?.length === 1 ? 'view' : 'views'}
            </span>
          </div>
          {current.viewers && current.viewers.length > 0 ? (
            <div className="flex flex-col gap-2">
              {current.viewers.map((v, idx) => {
                const viewer = v.userId;
                const viewerName = typeof viewer === 'object' ? viewer.username : 'User';
                const viewerPic = typeof viewer === 'object' ? viewer.profilePic : null;
                return (
                  <div key={idx} className="flex items-center gap-3 py-1">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-wa-accent/60 flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {viewerPic ? (
                        <img src={viewerPic} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{viewerName?.charAt(0).toUpperCase() || '?'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{viewerName}</p>
                    </div>
                    <span className="text-white/40 text-xs shrink-0">
                      {v.viewedAt ? formatDistanceToNow(new Date(v.viewedAt), { addSuffix: true }) : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-white/30 text-xs italic">No views yet</p>
          )}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════
//  STATUS CREATOR MODAL
// ═══════════════════════════════════════════
const StatusCreator = ({ onClose, onCreate, isCreating }) => {
  const [mode, setMode] = useState(null); // null, 'text', 'image'
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(STATUS_COLORS[0]);
  const [imageData, setImageData] = useState(null); // Preview URL
  const [imageFile, setImageFile] = useState(null); // Raw File object
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImageData(reader.result);
      setMode('image');
    };
    reader.readAsDataURL(file);
  };

  const handlePost = () => {
    if (mode === 'text' && text.trim()) {
      onCreate({ type: 'text', content: text.trim(), backgroundColor: bgColor });
    } else if (mode === 'image' && imageFile) {
      onCreate({ type: 'image', image: imageFile, caption: caption.trim() });
    }
  };

  // Picker screen
  if (!mode) {
    return (
      <div className="fixed inset-0 z-90 bg-black/80 flex items-center justify-center p-4">
        <div className="rounded-2xl w-full max-w-sm p-6 shadow-2xl" style={{ background: '#1a2e35' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white text-lg font-semibold">Add Status</h2>
            <button onClick={onClose} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setMode('text')}
              className="flex-1 flex flex-col items-center gap-3 p-6 rounded-xl hover:bg-white/5 transition-colors border border-white/10"
            >
              <div className="w-14 h-14 rounded-full bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <span className="text-white text-2xl font-bold">T</span>
              </div>
              <span className="text-white/80 text-sm font-medium">Text</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex flex-col items-center gap-3 p-6 rounded-xl hover:bg-white/5 transition-colors border border-white/10"
            >
              <div className="w-14 h-14 rounded-full bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Image className="w-7 h-7 text-white" />
              </div>
              <span className="text-white/80 text-sm font-medium">Photo</span>
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
        </div>
      </div>
    );
  }

  // Text composer
  if (mode === 'text') {
    return (
      <div className="fixed inset-0 z-90 flex flex-col" style={{ backgroundColor: bgColor }}>
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-6 h-6" /></button>
          <div className="flex gap-2">
            {STATUS_COLORS.slice(0, 8).map(c => (
              <button
                key={c}
                onClick={() => setBgColor(c)}
                className="w-6 h-6 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c,
                  borderColor: bgColor === c ? '#fff' : 'transparent',
                  transform: bgColor === c ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-8">
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type a status..."
            className="bg-transparent border-none outline-none text-white text-2xl md:text-3xl font-semibold text-center resize-none w-full max-w-lg placeholder-white/40"
            rows={5}
            maxLength={500}
          />
        </div>
        <div className="flex justify-end px-6 pb-6">
          <button
            onClick={handlePost}
            disabled={!text.trim() || isCreating}
            className="w-14 h-14 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center disabled:opacity-40 transition-colors"
          >
            {isCreating ? <Loader className="w-6 h-6 text-white animate-spin" /> : <Send className="w-6 h-6 text-white" />}
          </button>
        </div>
      </div>
    );
  }

  // Image preview
  if (mode === 'image' && imageData) {
    return (
      <div className="fixed inset-0 z-90 bg-black flex flex-col">
        <div className="flex items-center px-4 py-3 shrink-0">
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <img src={imageData} alt="" className="max-w-full max-h-[65vh] object-contain rounded-lg" />
        </div>
        <div className="flex items-center gap-3 px-4 pb-6 pt-3">
          <input
            type="text"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Add a caption..."
            className="flex-1 bg-white/10 text-white rounded-full px-4 py-2.5 text-sm border-none outline-none placeholder-white/40"
          />
          <button
            onClick={handlePost}
            disabled={isCreating}
            className="w-12 h-12 rounded-full bg-[#00a884] hover:bg-[#00a884]/80 flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
          >
            {isCreating ? <Loader className="w-5 h-5 text-white animate-spin" /> : <Send className="w-5 h-5 text-white" />}
          </button>
        </div>
      </div>
    );
  }

  return null;
};

// ═══════════════════════════════════════════
//  STATUS RING AVATAR
// ═══════════════════════════════════════════
const StatusRingAvatar = ({ user, hasUnviewed, statusCount = 1, onClick, size = 'w-12 h-12' }) => {
  const segments = Math.min(statusCount, 12);
  const gap = segments > 1 ? 4 : 0;
  const circumference = 2 * Math.PI * 23;
  const segLen = (circumference - gap * segments) / segments;

  return (
    <div className={`relative cursor-pointer ${size}`} onClick={onClick}>
      {/* Ring */}
      <svg className="absolute -inset-[3px] w-[calc(100%+6px)] h-[calc(100%+6px)]" viewBox="0 0 50 50">
        {Array.from({ length: segments }).map((_, i) => (
          <circle
            key={i}
            cx="25" cy="25" r="23"
            fill="none"
            strokeWidth="2.5"
            stroke={hasUnviewed ? '#00a884' : '#667781'}
            strokeDasharray={`${segLen} ${circumference - segLen}`}
            strokeDashoffset={-(i * (segLen + gap))}
            strokeLinecap="round"
            className="transition-colors"
          />
        ))}
      </svg>
      {/* Avatar */}
      <div className="w-full h-full rounded-full overflow-hidden bg-wa-accent/60 flex items-center justify-center text-white font-bold text-lg">
        {user.profilePic ? (
          <img src={getMediaUrl(user.profilePic)} alt="" className="w-full h-full object-cover" />
        ) : (
          <span>{user.username?.charAt(0).toUpperCase() || '?'}</span>
        )}
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════
//  MAIN STATUS PAGE
// ═══════════════════════════════════════════
const StatusPage = () => {
  const { setSidebarVisible } = useChatStore();
  const { authUser } = useAuthStore();
  const { statuses, myStatuses, isLoading, isCreating, fetchStatuses, fetchMyStatuses, createStatus, viewStatus, deleteStatus } = useStatusStore();

  const [showCreator, setShowCreator] = useState(false);
  const [viewingGroup, setViewingGroup] = useState(null);
  const [viewingOwnStatus, setViewingOwnStatus] = useState(false);

  useEffect(() => {
    fetchStatuses();
    fetchMyStatuses();
  }, []);

  const handleCreate = async (data) => {
    await createStatus(data);
    setShowCreator(false);
  };

  const openMyStatus = () => {
    if (myStatuses.length > 0) {
      setViewingGroup({
        user: authUser,
        statuses: myStatuses,
      });
      setViewingOwnStatus(true);
    } else {
      setShowCreator(true);
    }
  };

  const openContactStatus = (group) => {
    setViewingGroup(group);
    setViewingOwnStatus(false);
  };

  const closeViewer = () => {
    setViewingGroup(null);
    setViewingOwnStatus(false);
    // Refresh to update viewed status
    fetchStatuses();
  };

  return (
    <div className="h-full w-full bg-wa-bg flex flex-col">
      {/* Header */}
      <div className="h-[60px] flex items-center px-4 gap-4 shrink-0 border-b border-wa-divider" style={{ background: '#202c33' }}>
        <button
          onClick={() => setSidebarVisible(true)}
          className="text-wa-text-muted hover:text-wa-text transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-wa-text">Status</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-wa-bg">
        {/* My Status */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={openMyStatus}>
            <div className="relative">
              {myStatuses.length > 0 ? (
                <StatusRingAvatar
                  user={authUser}
                  hasUnviewed={true}
                  statusCount={myStatuses.length}
                  onClick={openMyStatus}
                />
              ) : (
                <div className="w-12 h-12 rounded-full overflow-hidden bg-wa-accent/60 flex items-center justify-center text-white font-bold text-lg relative">
                  {authUser?.profilePic ? (
                    <img src={authUser.profilePic} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{authUser?.username?.charAt(0).toUpperCase() || '?'}</span>
                  )}
                  <div className="absolute -bottom-1 -right-1 bg-[#00a884] rounded-full border-2 border-wa-bg p-0.5">
                    <Plus className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-[17px] text-wa-text font-medium">My Status</h2>
              <p className="text-sm text-wa-text-muted">
                {myStatuses.length > 0
                  ? `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''} • Tap to view`
                  : 'Tap to add status update'}
              </p>
            </div>
            {/* Add button (always shown) */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowCreator(true); }}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#00a884] hover:bg-[#00a884]/80 transition-colors shrink-0"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="w-full h-px bg-wa-divider" />

        {/* Recent Updates */}
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-[#00a884] text-xs font-semibold uppercase tracking-wider mb-3">Recent Updates</h3>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader className="w-6 h-6 animate-spin text-[#00a884]" />
          </div>
        ) : statuses.length === 0 ? (
          <div className="px-4 py-6">
            <p className="text-sm text-wa-text-muted italic text-center">No status updates from contacts</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {statuses.map((group) => {
              const user = group.user;
              const latestStatus = group.statuses[0];
              return (
                <div
                  key={user._id}
                  onClick={() => openContactStatus(group)}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-wa-bg-hover cursor-pointer transition-colors"
                >
                  <StatusRingAvatar
                    user={user}
                    hasUnviewed={group.hasUnviewed}
                    statusCount={group.statuses.length}
                    onClick={() => openContactStatus(group)}
                  />
                  <div className="flex-1 min-w-0 border-b border-wa-divider pb-3">
                    <p className="text-wa-text text-[16px] font-medium truncate">{user.username}</p>
                    <p className="text-wa-text-muted text-xs">
                      {formatDistanceToNow(new Date(latestStatus.createdAt), { addSuffix: true })}
                      {group.statuses.length > 1 && ` • ${group.statuses.length} updates`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Creator Modal */}
      {showCreator && (
        <StatusCreator
          onClose={() => setShowCreator(false)}
          onCreate={handleCreate}
          isCreating={isCreating}
        />
      )}

      {/* Viewer Overlay */}
      {viewingGroup && (
        <StatusViewer
          statusGroup={viewingGroup}
          onClose={closeViewer}
          onView={viewStatus}
          isOwnStatus={viewingOwnStatus}
        />
      )}
    </div>
  );
};

export default StatusPage;
