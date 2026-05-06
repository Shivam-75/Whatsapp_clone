import { Routes, Route, Navigate } from 'react-router-dom';
import clsx from 'clsx';
import { Toaster } from "react-hot-toast";
import FarLeftSidebar from './components/layout/FarLeftSidebar';
import LeftSidebar from './components/layout/LeftSidebar';
import WelcomeScreen from './components/layout/WelcomeScreen';
import { useAuthStore } from "./store/useAuthStore";
import { useChatStore } from "./store/useChatStore";
import { useStatusStore } from "./store/useStatusStore";
import { useGroupStore } from "./store/useGroupStore";
import { useEffect, lazy, Suspense } from "react";
import { Loader } from "lucide-react";

// Lazy loading pages for performance
const StatusPage = lazy(() => import('./pages/StatusPage'));
const GroupsPage = lazy(() => import('./pages/GroupsPage'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ChatWindow = lazy(() => import('./components/layout/ChatWindow'));

function App() {
  const { authUser, checkAuth, isCheckingAuth, socket } = useAuthStore();
  const { isSidebarVisible, subscribeToMessages, unsubscribeFromMessages } = useChatStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (authUser && socket) {
      subscribeToMessages();
      useStatusStore.getState().subscribeToStatusUpdates();
      useGroupStore.getState().subscribeToGroupUpdates();
      return () => {
        unsubscribeFromMessages();
        useStatusStore.getState().unsubscribeFromStatusUpdates();
        useGroupStore.getState().unsubscribeFromGroupUpdates();
      };
    }
  }, [authUser, socket, subscribeToMessages, unsubscribeFromMessages]);

  if (isCheckingAuth && !authUser) {
    return (
      <div className="h-screen flex items-center justify-center bg-wa-bg">
        <Loader className="w-10 h-10 animate-spin text-wa-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full overflow-hidden text-wa-text bg-wa-bg relative">
      {authUser && (
        <div className={clsx(
          "shrink-0 z-30 transition-all duration-300",
          !isSidebarVisible ? "hidden md:flex" : "flex w-full md:w-auto h-full"
        )}>
          <div className="flex flex-col md:flex-row h-full w-full">
            <FarLeftSidebar />
            <LeftSidebar />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={clsx(
        "flex-1 h-full bg-wa-bg-panel relative flex flex-col transition-all duration-300",
        authUser && isSidebarVisible && "hidden md:flex"
      )}>
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center bg-wa-bg-panel">
            <Loader className="w-8 h-8 animate-spin text-wa-accent" />
          </div>
        }>
          <Routes>
            <Route path="/" element={authUser ? <WelcomeScreen /> : <Navigate to="/login" />} />
            <Route path="/signup" element={!authUser ? <Signup /> : <Navigate to="/" />} />
            <Route path="/login" element={!authUser ? <Login /> : <Navigate to="/" />} />
            
            {/* Chat Screen */}
            <Route path="/chat/:chatId" element={authUser ? <ChatWindow /> : <Navigate to="/login" />} />
            
            {/* Profile Screen */}
            <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
            <Route path="/status" element={authUser ? <StatusPage /> : <Navigate to="/login" />} />
            <Route path="/groups" element={authUser ? <GroupsPage /> : <Navigate to="/login" />} />
          </Routes>
        </Suspense>
      </div>
      <Toaster position="top-center" reverseOrder={false} />
    </div>
  );
}

export default App;