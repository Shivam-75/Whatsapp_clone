import React from 'react';
import { Check, CheckCheck, Clock, Forward, Pin } from 'lucide-react';
import { format } from "date-fns";
import clsx from "clsx";
import { getMediaUrl } from "../../lib/utils";

const MessageItem = ({ 
  msg, 
  isMine, 
  isSelected, 
  isSelecting, 
  toggleSelect, 
  handleContextMenu, 
  handleTouchStart, 
  handleTouchEnd,
  authId,
  selectedUser
}) => {
  return (
    <div
      onClick={() => isSelecting ? toggleSelect(msg._id) : null}
      onContextMenu={(e) => handleContextMenu(e, msg)}
      onTouchStart={() => handleTouchStart(msg)}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      className={clsx(
        "flex w-full items-center gap-2 transition-colors",
        isMine ? "justify-end" : "justify-start",
        isSelecting && "cursor-pointer",
        isSelected && "opacity-80"
      )}
      style={{ background: isSelected ? "rgba(0,168,132,0.1)" : "transparent", borderRadius: "4px" }}
      id={`msg-${msg._id}`}
    >
      {isSelecting && (
        <div className={clsx(
          "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
          isSelected ? "bg-[#00a884] border-[#00a884]" : "border-[#8696a0]",
          isMine ? "order-last ml-1" : "order-first mr-1"
        )}>
          {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </div>
      )}
      <div
        className={clsx(
          "max-w-[75%] px-2 pt-1.5 pb-1 rounded-lg text-[14px] leading-relaxed shadow-md",
          isMine ? "rounded-tr-none" : "rounded-tl-none"
        )}
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
              {(msg.replyTo.senderId?._id || msg.replyTo.senderId) === authId ? "You" : (selectedUser?.username || "User")}
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
};

export default React.memo(MessageItem);
