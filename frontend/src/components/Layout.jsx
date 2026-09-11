import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import RouteLoadingBar from './RouteLoadingBar';
import AnnouncementBanner from './AnnouncementBanner';
import SetPasswordModal from './auth/SetPasswordModal';
import usePresenceHeartbeat from '../hooks/usePresenceHeartbeat';
import { PresenceProvider } from '../context/PresenceContext';

const Layout = ({ children }) => {
  usePresenceHeartbeat();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mainRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const onCollapse = (e) => setSidebarCollapsed(!!e.detail);
    window.addEventListener('sidebarCollapsed', onCollapse);
    return () => window.removeEventListener('sidebarCollapsed', onCollapse);
  }, []);

  // Keep shell mounted; jump to top instantly (smooth scroll + remount looks like a sidebar glitch)
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  // Close mobile drawer on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <PresenceProvider>
    <div className="flex h-dvh bg-stone-50 overflow-hidden">
      <RouteLoadingBar />
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div
        className={`flex-1 flex flex-col min-w-0 h-full transition-[margin] duration-300 ease-out ${
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-[280px]'
        }`}
      >
        <Header setSidebarOpen={setSidebarOpen} sidebarOpen={sidebarOpen} />
        <AnnouncementBanner />

        <main
          ref={mainRef}
          id="main-content"
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-stone-50/80 [scrollbar-gutter:stable]"
          role="main"
        >
          {/* Remount on path change so SPA swaps never stick on Candidates (URL changed, UI stale).
              No animate-page-enter here — page shells animate themselves. */}
          <div key={location.pathname} className="w-full min-w-0 min-h-0">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
      <SetPasswordModal />
    </div>
    </PresenceProvider>
  );
};

export default Layout;
