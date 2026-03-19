import React from 'react';
import { Laptop, PhoneCall, UserPlus, Fingerprint } from 'lucide-react'; // Approximating the bottom icons

const WelcomeScreen = () => {
  return (
    <div className="h-full w-full flex flex-col justify-center items-center bg-wa-bg-panel text-center px-4 relative">
      <div className="max-w-[500px] w-full flex flex-col items-center">
        
        {/* Main Graphic - We simulate it with a simple SVG/DOM element set for the demo */}
        <div className="mb-10 w-fit h-fit bg-[#222E35] rounded-3xl p-8 border border-wa-divider relative shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col items-center">
           <div className="relative w-40 h-32 mb-2 flex items-center justify-center">
              <div className="w-32 h-20 bg-[#f0f2f5] rounded top-0 absolute flex items-center justify-center overflow-hidden">
                 <div className="w-6 h-full bg-wa-accent opacity-20 absolute left-0"></div>
                 <div className="w-14 h-14 bg-white rounded-full shadow flex items-center justify-center border-4 border-white translate-x-3 text-wa-accent">
                   <PhoneCall className="w-6 h-6 fill-current" />
                 </div>
              </div>
              <div className="h-2 w-38 bg-wa-text-muted rounded-full absolute bottom-8"></div>
           </div>
           
           <h2 className="text-2xl font-normal text-wa-text mt-4 mb-3">Download WhatsApp for Windows</h2>
           <p className="text-wa-text-muted text-[15px] mb-8 max-w-xs leading-relaxed">
             Get extra features like voice and video calling, screen sharing and more.
           </p>
           
           <button className="bg-wa-accent text-wa-bg hover:bg-wa-accent-dark transition-colors px-6 py-[10px] rounded-full font-medium text-[15px]">
             Download
           </button>
        </div>

        {/* Bottom Feature Buttons */}
        <div className="flex gap-8 justify-center mt-4">
          <div className="flex flex-col items-center gap-3">
            <button className="w-16 h-16 rounded-2xl bg-wa-bg-hover hover:bg-wa-bg-panel transition-colors border border-wa-divider flex justify-center items-center shadow-sm">
               <Laptop className="w-6 h-6 text-wa-text-muted" />
            </button>
            <span className="text-wa-text-muted text-sm font-medium">Send document</span>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button className="w-16 h-16 rounded-2xl bg-wa-bg-hover hover:bg-wa-bg-panel transition-colors border border-wa-divider flex justify-center items-center shadow-sm">
               <UserPlus className="w-6 h-6 text-wa-text-muted" />
            </button>
            <span className="text-wa-text-muted text-sm font-medium">Add contact</span>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button className="w-16 h-16 rounded-2xl bg-wa-bg-hover hover:bg-wa-bg-panel transition-colors border border-wa-divider flex justify-center items-center relative overflow-hidden group shadow-sm">
               <div className="absolute inset-0 bg-linear-to-tr from-blue-600 via-purple-600 to-pink-500 opacity-20"></div>
               <div className="w-6 h-6 rounded-full border-2 border-transparent bg-clip-text text-transparent bg-linear-to-tr from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center ring-2 ring-[url(#meta-ai-gradient)]">
                 <div className="w-4 h-4 rounded-full border-[3px] border-blue-400 border-t-purple-500 border-r-pink-500 animate-spin-slow"></div>
               </div>
            </button>
            <span className="text-wa-text-muted text-sm font-medium">Ask Meta AI</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
