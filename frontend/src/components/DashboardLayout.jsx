import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Home, Users, BarChart4, Settings, LogOut, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react';

const DashboardLayout = ({ children, title, subtitle }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true); // Mobile menu
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Desktop collapse
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', icon: Home, path: '/ats' },
    { label: 'Candidates', icon: Users, path: '/candidate-search' },
    { label: 'Reports', icon: BarChart4, path: '/analytics' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* SIDEBAR */}
      <div className={`hidden lg:flex fixed lg:relative h-screen bg-gradient-to-b from-blue-900 to-blue-800 text-white shadow-xl transition-all duration-300 ease-in-out z-40 flex-col ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="flex flex-col h-full w-full">
          {/* LOGO */}
          <div className="p-4 border-b border-blue-700 flex items-center justify-center">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3 w-full">
                <div className="w-10 h-10 bg-blue-400 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Briefcase size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold">PeopleConnect</h2>
                  <p className="text-xs text-blue-200">ATS System</p>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-10 h-10 bg-blue-400 rounded-lg flex items-center justify-center">
                <Briefcase size={20} className="text-white" />
              </div>
            )}
          </div>

          {/* NAVIGATION */}
          <nav className="flex-1 px-2 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg font-medium transition whitespace-nowrap ${
                    isActive(item.path)
                      ? 'bg-blue-700 text-white'
                      : 'text-blue-100 hover:bg-blue-700'
                  }`}
                  title={sidebarCollapsed ? item.label : ''}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* FOOTER */}
          <div className="p-2 border-t border-blue-700">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-blue-100 font-medium hover:bg-blue-700 transition whitespace-nowrap"
              title={sidebarCollapsed ? 'Logout' : ''}
            >
              <LogOut size={20} className="flex-shrink-0" />
              {!sidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </div>

      {/* SIDEBAR COLLAPSE BUTTON - Edge Position */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="hidden lg:flex absolute left-0 top-1/2 transform -translate-y-1/2 z-50 ml-64 transition-all duration-300 ease-in-out"
        style={{
          marginLeft: sidebarCollapsed ? 'calc(80px - 12px)' : 'calc(256px - 12px)',
        }}
        title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        <div className="bg-white border-2 border-blue-900 rounded-full p-2 hover:bg-blue-50 shadow-md hover:shadow-lg transition-all hover:scale-110">
          {sidebarCollapsed ? (
            <ChevronRight size={18} className="text-blue-900" />
          ) : (
            <ChevronLeft size={18} className="text-blue-900" />
          )}
        </div>
      </button>

      {/* MOBILE HAMBURGER (visible only on mobile) */}
      <div className="lg:hidden w-full flex flex-col h-screen">
        {/* MOBILE HEADER */}
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-4 py-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <Menu size={24} className="text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              <p className="text-sm text-gray-600">{subtitle}</p>
            </div>
          </div>
        </header>

        {/* MOBILE SIDEBAR */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)}></div>
        )}
        <div className={`fixed left-0 top-0 w-64 h-screen bg-gradient-to-b from-blue-900 to-blue-800 text-white shadow-xl transform transition-transform duration-300 ease-in-out z-40 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex flex-col h-full p-6 pt-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-blue-400 rounded-lg flex items-center justify-center">
                <Briefcase size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">PeopleConnect</h2>
                <p className="text-xs text-blue-200">ATS System</p>
              </div>
            </div>
            <nav className="flex-1 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                      isActive(item.path)
                        ? 'bg-blue-700 text-white'
                        : 'text-blue-100 hover:bg-blue-700'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-blue-100 font-medium hover:bg-blue-700 transition"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* MOBILE CONTENT */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>
      {/* DESKTOP LAYOUT */}
      <div className="hidden lg:flex flex-1 flex-col overflow-hidden">
        {/* DESKTOP HEADER */}
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-4 md:px-8 py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              <p className="text-sm text-gray-600">{subtitle}</p>
            </div>
          </div>
        </header>

        {/* DESKTOP CONTENT */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;