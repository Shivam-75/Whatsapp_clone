import { Routes, Route, Navigate } from 'react-router-dom';
import clsx from 'clsx';
import { Toaster } from "react-hot-toast";
import FarLeftSidebar from './components/layout/FarLeftSidebar';
import LeftSidebar from './components/layout/LeftSidebar';
import StatusPage from './pages/StatusPage';
import WelcomeScreen from './components/layout/WelcomeScreen';
import ChatWindow from './components/layout/ChatWindow';
import GroupsPage from './pages/GroupsPage';
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProfilePage from "./pages/ProfilePage";
import { useAuthStore } from "./store/useAuthStore";
import { useChatStore } from "./store/useChatStore";
import { useStatusStore } from "./store/useStatusStore";
import { useGroupStore } from "./store/useGroupStore";
import { useEffect } from "react";
import { Loader } from "lucide-react";

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
      </div>
      <Toaster position="top-center" reverseOrder={false} />
    </div>
  );
}

export default App;