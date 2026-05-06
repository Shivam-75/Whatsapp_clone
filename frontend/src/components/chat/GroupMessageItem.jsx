import React from 'react';
import { Check, Forward, Pin, Reply } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { getMediaUrl } from '../../lib/utils';

const GroupMessageItem = ({ 
  msg, 
  isMine, 
  isSelected, 
  isSelecting, 
  toggleSelect, 
  handleContextMenu, 
  authId, 
  onReplyClick 
}) => {
  const senderName = msg.senderId?.username || 'User';

  return (
    <div 
      id={`msg-${msg._id}`}
      className={clsx(
        "flex w-full group relative transition-all duration-200",
        isMine ? 'justify-end' : 'justify-start',
        isSelected && "bg-wa-accent/5"
      )}
      onClick={() => isSelecting && toggleSelect(msg._id)}
      onContextMenu={(e) => handleContextMenu(e, msg)}
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
              onReplyClick(msg.replyTo._id || msg.replyTo);
            }}
          >
            <p className="text-[11px] font-bold text-[#00a884] truncate">
              {(msg.replyTo.senderId?._id || msg.replyTo.senderId) === authId ? "You" : (msg.replyTo.senderId?.username || "User")}
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
              onClick={(e) => { e.stopPropagation(); window.open(getMediaUrl(msg.image), '_blank'); }}
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
};

export default React.memo(GroupMessageItem);
