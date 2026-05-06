import React from 'react';
import { Users } from 'lucide-react';
import { format, isSameDay } from 'date-fns';

const GroupListItem = ({ group, onClick }) => {
  const lastMsg = group.lastMessage;
  const time = lastMsg ? (
    isSameDay(new Date(lastMsg.createdAt), new Date())
      ? format(new Date(lastMsg.createdAt), 'h:mm a')
      : format(new Date(lastMsg.createdAt), 'MM/dd/yy')
  ) : '';

  return (
    <div
      onClick={onClick}
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
};

export default React.memo(GroupListItem);
