import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import clsx from 'clsx';
import Avatar from '../common/Avatar';
import { format, isSameDay } from 'date-fns';

const ChatItem = ({ user, onClick, active, isOnline, lastMsg, authUser, unreadCount, isTyping }) => {
  const isUnread = unreadCount > 0;
  const isSentByMe = lastMsg && (lastMsg.senderId?._id || lastMsg.senderId) === authUser?._id;

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

export default React.memo(ChatItem);
