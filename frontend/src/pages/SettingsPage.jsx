import React from 'react';
import { useChatStore } from '../store/useChatStore';
import { ArrowLeft, User, Bell, Shield, HelpCircle } from 'lucide-react';

const SettingsPage = () => {
  const { setSidebarVisible, notificationPermission, requestNotificationPermission } = useChatStore();

  const handleNotificationRequest = async () => {
    if (notificationPermission === 'default') {
      await requestNotificationPermission();
    } else if (notificationPermission === 'denied') {
      alert("Notifications are blocked by your browser. Please enable them in your browser settings to receive alerts.");
    }
  };

  return (
    <div className="h-full w-full bg-wa-bg flex flex-col">
      {/* Header */}
      <div className="h-[108px] bg-wa-bg-panel flex items-end px-6 pb-4">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setSidebarVisible(true)}
            className="text-wa-text-muted hover:text-wa-text transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-wa-text">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-wa-bg">
        <div className="flex flex-col">
          <div className="flex items-center px-6 py-4 hover:bg-wa-bg-hover cursor-pointer transition-colors">
            <User className="w-6 h-6 text-wa-text-muted mr-6" />
            <div className="flex-1 border-b border-wa-divider pb-4">
              <h2 className="text-[17px] text-wa-text">Account</h2>
              <p className="text-sm text-wa-text-muted">Security notifications, change number</p>
            </div>
          </div>

          <div className="flex items-center px-6 py-4 hover:bg-wa-bg-hover cursor-pointer transition-colors">
            <Shield className="w-6 h-6 text-wa-text-muted mr-6" />
            <div className="flex-1 border-b border-wa-divider pb-4">
              <h2 className="text-[17px] text-wa-text">Privacy</h2>
              <p className="text-sm text-wa-text-muted">Block contacts, disappearing messages</p>
            </div>
          </div>

          <div 
            onClick={handleNotificationRequest}
            className="flex items-center px-6 py-4 hover:bg-wa-bg-hover cursor-pointer transition-colors"
          >
            <Bell className="w-6 h-6 text-wa-text-muted mr-6" />
            <div className="flex-1 border-b border-wa-divider pb-4 flex justify-between items-center pr-4">
              <div>
                <h2 className="text-[17px] text-wa-text">Browser Notifications</h2>
                <p className="text-sm text-wa-text-muted">
                  {notificationPermission === 'granted' ? 'Enabled' : 
                   notificationPermission === 'denied' ? 'Blocked' : 'Click to enable alerts'}
                </p>
              </div>
              {notificationPermission === 'default' && (
                <button className="bg-wa-accent text-white text-xs font-bold px-3 py-1 rounded-full">
                  Enable
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center px-6 py-4 hover:bg-wa-bg-hover cursor-pointer transition-colors">
            <HelpCircle className="w-6 h-6 text-wa-text-muted mr-6" />
            <div className="flex-1 pb-4">
              <h2 className="text-[17px] text-wa-text">Help</h2>
              <p className="text-sm text-wa-text-muted">Help center, contact us, privacy policy</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
