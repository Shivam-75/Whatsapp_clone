import React from 'react';
import { MessageSquare } from 'lucide-react';

const WelcomeScreen = () => {
  return (
    <div className="h-full w-full flex flex-col justify-center items-center bg-wa-bg-panel text-center px-4 relative">
      <div className="max-w-[500px] w-full flex flex-col items-center">
        
        {/* Simple elegant icon */}
        <div className="mb-8 w-24 h-24 bg-wa-bg-hover rounded-full flex items-center justify-center shadow-lg border border-wa-divider">
          <MessageSquare className="w-12 h-12 text-wa-accent opacity-60" />
        </div>
        
        <h1 className="text-3xl font-light text-wa-text mb-4">WhatsApp Web Clone</h1>
        <p className="text-wa-text-muted text-[15px] max-w-sm leading-relaxed mb-10">
          Send and receive messages without keeping your phone online. Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
        </p>

        <div className="flex items-center gap-2 text-wa-text-muted text-sm opacity-50">
           <div className="w-3 h-3 border border-current rounded-full flex items-center justify-center text-[8px] font-bold">!</div>
           <span>End-to-end encrypted</span>
        </div>
      </div>
      
      {/* Bottom accent border */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-wa-accent opacity-30"></div>
    </div>
  );
};

export default WelcomeScreen;
