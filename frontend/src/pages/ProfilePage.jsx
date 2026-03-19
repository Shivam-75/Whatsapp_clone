import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { ArrowLeft, Camera, User, Info, Check, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ProfilePage = () => {
  const { authUser, isUpdatingProfile, updateProfile } = useAuthStore();
  const { setSidebarVisible } = useChatStore();
  const [about, setAbout] = useState(authUser?.about || "Hey there! I am using WhatsApp.");
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const fileInputRef = React.useRef(null);
  const navigate = useNavigate();

  const handleBack = () => {
    setSidebarVisible(true);
    navigate(-1);
  };

  const handleUpdateAbout = async () => {
     const success = await updateProfile({ about });
     if (success) setIsEditingAbout(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
       alert("Image size must be less than 5MB");
       return;
    }

    const formData = new FormData();
    formData.append("profilePic", file);
    await updateProfile(formData);
  };

  return (
    <div className="flex-1 bg-[#0b141a] flex flex-col h-full overflow-hidden text-wa-text">
       {/* Header */}
       <div className="h-[108px] bg-wa-bg-panel flex items-end px-6 pb-4 shrink-0">
          <button 
            onClick={handleBack} 
            className="mr-6 mb-1 hover:bg-wa-bg-hover p-2 rounded-full transition-colors"
          >
             <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-medium mb-1.5">Profile</h1>
       </div>

       {/* Content */}
       <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center">
          {/* Profile Picture Section */}
          <div className="py-7 flex flex-col items-center group cursor-pointer relative">
             <input 
               type="file" 
               className="hidden" 
               ref={fileInputRef} 
               onChange={handleImageUpload} 
               accept="image/*"
             />
             <div 
               onClick={() => fileInputRef.current?.click()}
               className="w-50 h-50 rounded-full bg-wa-divider flex items-center justify-center overflow-hidden relative"
             >
                {authUser?.profilePic ? (
                   <img src={authUser.profilePic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                   <div className="flex flex-col items-center justify-center text-wa-text-muted">
                      <User className="w-24 h-24 mb-1" />
                      <span className="text-[10px]">ADD PHOTO</span>
                   </div>
                )}
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-[10px] font-bold">
                   <Camera className="w-6 h-6 mb-1" />
                   <span>CHANGE PROFILE PHOTO</span>
                </div>

                {/* Loading state */}
                {isUpdatingProfile && (
                   <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader className="w-8 h-8 animate-spin text-wa-accent" />
                   </div>
                )}
             </div>
          </div>

          <div className="w-full px-8 max-w-xl mx-auto space-y-8">
             {/* Name Section */}
             <div className="space-y-4">
                <span className="text-sm text-wa-accent font-normal">Your name</span>
                <div className="flex items-center justify-between pb-1">
                   <span className="text-[17px]">{authUser?.username}</span>
                </div>
                <p className="text-[14px] text-wa-text-muted leading-tight">
                   This is not your username or pin. This name will be visible to your WhatsApp contacts.
                </p>
             </div>

             {/* About Section */}
             <div className="space-y-4">
                <span className="text-sm text-wa-accent font-normal">About</span>
                <div className="flex items-center justify-between border-b border-wa-divider/50 pb-2 transition-colors focus-within:border-wa-accent">
                   {isEditingAbout ? (
                      <input 
                        type="text" 
                        value={about}
                        onChange={(e) => setAbout(e.target.value)}
                        autoFocus
                        onBlur={handleUpdateAbout}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateAbout()}
                        className="bg-transparent border-none outline-none text-[17px] w-full"
                      />
                   ) : (
                      <span className="text-[17px] truncate flex-1">{authUser?.about || "Hey there! I am using WhatsApp."}</span>
                   )}
                   
                   {isEditingAbout ? (
                      <Check className="w-5 h-5 text-wa-accent cursor-pointer" onClick={handleUpdateAbout} />
                   ) : (
                      <Pencil 
                        className="w-5 h-5 text-wa-text-muted cursor-pointer hover:text-wa-text" 
                        onClick={() => setIsEditingAbout(true)} 
                      />
                   )}
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default ProfilePage;
