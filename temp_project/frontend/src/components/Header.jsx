import React, { useState, useEffect } from 'react';
import { Menu, Bell, Search, ChevronDown, User, LogOut, Building2, CreditCard, Settings, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { handleLogout } from '../utils/authUtils';
import { useToast } from './Toast';
import NotificationBell from './NotificationBell';
import { authenticatedFetch } from '../utils/fetchUtils';
import BASE_API_URL from '../config';

const Header = ({ setSidebarOpen, sidebarOpen }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [profilePicture, setProfilePicture] = useState('');

  // Get user info from localStorage
  const userEmail = localStorage.getItem('userEmail') || 'User';
  const userName = localStorage.getItem('userName') || '';
  const displayName = userName || (userEmail.includes('@') ? userEmail.split('@')[0] : userEmail);
  const initials = (userName ? userName.split(' ').map(w => w[0]).join('').slice(0, 2) : displayName.slice(0, 2)).toUpperCase();
  const userRole = localStorage.getItem('userRole') || 'recruiter';
  const orgName = localStorage.getItem('orgName') || '';
  const isAdmin = ['owner', 'admin'].includes(userRole);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showUserMenu && !e.target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const roleBadgeColors = {
    owner: 'bg-amber-100 text-amber-700',
    admin: 'bg-blue-100 text-blue-700',
    recruiter: 'bg-green-100 text-green-700',
    interviewer: 'bg-purple-100 text-purple-700',
    readonly: 'bg-gray-100 text-gray-600',
  };

  // Fetch profile picture on mount and when Settings updates it
  useEffect(() => {
    const fetchProfilePicture = async () => {
      try {
        const res = await authenticatedFetch(`${BASE_API_URL}/api/profile`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user?.profilePicture) {
            setProfilePicture(data.user.profilePicture);
          } else {
            setProfilePicture('');
          }
        }
      } catch {
        setProfilePicture('');
      }
    };
    fetchProfilePicture();

    const onPictureUpdated = (e) => {
      setProfilePicture(e.detail ?? '');
    };
    window.addEventListener('profilePictureUpdated', onPictureUpdated);
    return () => window.removeEventListener('profilePictureUpdated', onPictureUpdated);
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200 transition-all duration-300">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 gap-4">
        {/* Left Section */}
        <div className="flex items-center gap-2 sm:gap-4 flex-1">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            title="Toggle sidebar"
          >
            <Menu size={24} className="text-gray-600" />
          </button>

          {/* Search Bar - Hidden on small screens */}
          <div className="hidden md:block flex-1 max-w-md">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search candidates, jobs..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
          <NotificationBell />

          {/* User Profile Dropdown */}
          <div className="relative user-menu-container">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="User menu"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 overflow-hidden bg-blue-600 text-white">
                {profilePicture ? (
                  <img src={`${BASE_API_URL}${profilePicture}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <span className="hidden sm:inline text-sm font-medium text-gray-700">Hi, {displayName}</span>
              <ChevronDown size={16} className="text-gray-600 hidden sm:inline" />
            </button>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${roleBadgeColors[userRole] || 'bg-gray-100 text-gray-600'}`}>
                      {userRole}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{userEmail}</p>
                  {orgName && <p className="text-xs text-indigo-600 font-medium mt-1 flex items-center gap-1"><Building2 size={11} />{orgName}</p>}
                </div>
                <div className="py-1">
                  <button onClick={() => { navigate('/settings'); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors cursor-pointer">
                    <User size={16} className="text-gray-400" />
                    My Profile
                  </button>
                  {isAdmin && (
                    <>
                      <button onClick={() => { navigate('/organization'); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors cursor-pointer">
                        <Settings size={16} className="text-gray-400" />
                        Organization Settings
                      </button>
                      <button onClick={() => { navigate('/organization/integrations'); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors cursor-pointer">
                        <Shield size={16} className="text-gray-400" />
                        Integrations
                      </button>
                    </>
                  )}
                  {userRole === 'owner' && (
                    <button onClick={() => { navigate('/billing'); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors cursor-pointer">
                      <CreditCard size={16} className="text-gray-400" />
                      Billing & Plans
                    </button>
                  )}
                </div>
                <div className="border-t border-gray-100 py-1">
                  <button onClick={() => handleLogout(navigate)} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer">
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </header>
  );
};

export default Header;