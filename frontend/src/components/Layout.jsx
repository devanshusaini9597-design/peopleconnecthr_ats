import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import RouteLoadingBar from './RouteLoadingBar';
import AnnouncementBanner from './AnnouncementBanner';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mainRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const onCollapse = (e) => setSidebarCollapsed(!!e.detail);
    window.addEventListener('sidebarCollapsed', onCollapse);
    return () => window.removeEventListener('sidebarCollapsed', onCollapse);
  }, []);

  // AJAX-style: keep shell mounted, scroll content to top on route change
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname]);

  // Close mobile drawer on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
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
          className="flex-1 min-h-0 overflow-auto overflow-x-hidden bg-stone-50/80"
          role="main"
        >
          <div
            key={location.pathname}
            className="w-full min-w-0 h-full animate-page-enter"
          >
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
