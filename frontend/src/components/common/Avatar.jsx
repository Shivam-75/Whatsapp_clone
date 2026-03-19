import React, { useState } from 'react';
import clsx from 'clsx';

const Avatar = ({ user, size = "w-12 h-12", textClassName = "text-lg", showOnline = true, isOnline = false, className }) => {
  const [imgError, setImgError] = useState(false);
  const initials = user?.username?.charAt(0).toUpperCase() || '?';

  const isBrokenService = user?.profilePic?.includes("avatar.iran.liara.run");
  const showImage = user?.profilePic && !imgError && !isBrokenService;

  return (
    <div className={clsx("relative shrink-0", size, className)}>
      {/* Main Avatar Circle */}
      <div className={clsx(
        "w-full h-full rounded-full overflow-hidden flex items-center justify-center font-bold text-white transition-opacity",
        showImage ? "bg-transparent" : "bg-wa-accent/90"
      )}>
        {showImage ? (
          <img 
            src={user.profilePic} 
            alt={user.username} 
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className={clsx("text-white", textClassName)}>{initials}</span>
        )}
      </div>

      {/* Online Status Indicator - Pure Green for "Online" */}
      {showOnline && isOnline && (
         <div className="absolute bottom-[2px] right-[2px] w-3 h-3 bg-[#25d366] border-2 border-[#111b21] rounded-full shadow-sm z-10"></div>
      )}
    </div>
  );
};

export default Avatar;
