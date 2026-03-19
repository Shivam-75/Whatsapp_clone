import React from 'react';
import { MessageSquare, RefreshCcw, LayoutGrid, Users, Settings, User, LogOut, X } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import Avatar from '../common/Avatar';

const FarLeftSidebar = () => {
  const { authUser, logout } = useAuthStore();
  const { isDrawerOpen, setDrawerOpen, sidebarView, setSidebarView, setSidebarVisible } = useChatStore();
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile Overlay */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <div className={clsx(
        "fixed md:relative top-0 left-0 h-full w-[60px] bg-wa-bg-panel border-r border-wa-divider flex flex-col items-center py-3 justify-between shrink-0 z-50 transition-transform duration-300 ease-in-out md:translate-x-0",
        !isDrawerOpen && "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex flex-col gap-4 w-full items-center">
          {/* Mobile Close Button */}
          <button 
            onClick={() => setDrawerOpen(false)}
            className="md:hidden w-10 h-10 rounded-full flex items-center justify-center cursor-pointer text-wa-text-muted hover:bg-wa-bg-hover transition-colors mb-2"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Top Icons */}
        <Link 
          to="/" 
          onClick={() => {
              setDrawerOpen(false);
              setSidebarView("chats");
              setSidebarVisible(true);
          }}
          className={clsx(
            "w-10 h-10 rounded-full flex items-center justify-center cursor-pointer group transition-colors",
            sidebarView === "chats" ? "bg-wa-bg-hover text-wa-text" : "text-wa-text-muted hover:bg-wa-bg-hover"
          )}
        >
          <MessageSquare className="w-5 h-5 text-current group-hover:text-wa-text" />
        </Link>
        <Link 
          to="/status"
          onClick={() => {
              setDrawerOpen(false);
              setSidebarVisible(false);
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer text-wa-text-muted hover:bg-wa-bg-hover group transition-colors"
        >
          <RefreshCcw className="w-5 h-5 text-current group-hover:text-wa-text" />
        </Link>
        <button
          onClick={() => {
            setDrawerOpen(false);
            setSidebarView("groups");
            setSidebarVisible(true);
            navigate("/");
          }}
          className={clsx(
            "w-10 h-10 rounded-full flex items-center justify-center cursor-pointer group transition-colors",
            sidebarView === "groups" ? "bg-wa-bg-hover text-wa-text" : "text-wa-text-muted hover:bg-wa-bg-hover"
          )}
        >
          <LayoutGrid className="w-5 h-5 text-current group-hover:text-wa-text" />
        </button>
        <button 
          onClick={() => {
              setDrawerOpen(false);
              setSidebarView("users");
              setSidebarVisible(true);
              navigate("/"); // Go to home if we are in status etc. 
          }}
          className={clsx(
            "w-10 h-10 rounded-full flex items-center justify-center cursor-pointer group transition-colors",
            sidebarView === "users" ? "bg-wa-bg-hover text-wa-text" : "text-wa-text-muted hover:bg-wa-bg-hover"
          )}
        >
          <Users className="w-5 h-5 text-current group-hover:text-wa-text" />
        </button>
      </div>
      <div className="flex flex-col gap-4 w-full items-center">
        {/* Bottom Icons */}
        <Link 
          to="/settings"
          onClick={() => {
              setDrawerOpen(false);
              useChatStore.getState().setSidebarVisible(false);
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer text-wa-text-muted hover:bg-wa-bg-hover group transition-colors"
        >
          <Settings className="w-5 h-5 text-current group-hover:text-wa-text" />
        </Link>
          <button 
            onClick={() => logout()}
            className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer text-wa-text-muted hover:bg-wa-bg-hover group transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5 text-current group-hover:text-wa-text" />
          </button>
          <Link 
            to="/profile" 
            onClick={() => {
                setDrawerOpen(false);
                useChatStore.getState().setSidebarVisible(false);
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity"
          >
            <Avatar user={authUser} size="w-8 h-8" textClassName="text-xs" />
          </Link>
        </div>
      </div>
    </>
  );
};

export default FarLeftSidebar;
