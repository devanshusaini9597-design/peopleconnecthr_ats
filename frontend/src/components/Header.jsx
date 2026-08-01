import React, { useState, useEffect } from 'react';
import { Menu, Search, ChevronDown, User, LogOut, Building2, CreditCard, Settings, Shield, Command } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { handleLogout } from '../utils/authUtils';
import NotificationBell from './NotificationBell';
import { authenticatedFetch } from '../utils/fetchUtils';
import BASE_API_URL from '../config';

const Header = ({ setSidebarOpen, sidebarOpen }) => {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [profilePicture, setProfilePicture] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const userEmail = localStorage.getItem('userEmail') || 'User';
  const userName = localStorage.getItem('userName') || '';
  const displayName = userName || (userEmail.includes('@') ? userEmail.split('@')[0] : userEmail);
  const initials = (userName ? userName.split(' ').map((w) => w[0]).join('').slice(0, 2) : displayName.slice(0, 2)).toUpperCase();
  const userRole = localStorage.getItem('userRole') || 'recruiter';
  const orgName = localStorage.getItem('orgName') || '';
  const isAdmin = ['owner', 'admin'].includes(userRole);

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
    owner: 'bg-amber-100 text-amber-700 border-amber-200',
    admin: 'bg-sky-100 text-sky-700 border-sky-200',
    recruiter: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    interviewer: 'bg-violet-100 text-violet-700 border-violet-200',
    readonly: 'bg-stone-100 text-stone-600 border-stone-200',
  };

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

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/candidate-search?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-stone-200/60 flex-shrink-0">
      <div className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-6 gap-2 sm:gap-4 min-w-0">
        {/* Left */}
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2.5 hover:bg-stone-100 rounded-xl transition-colors flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-stone-600" />
          </button>

          <form onSubmit={handleSearch} className="hidden md:block flex-1 max-w-lg min-w-0">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 group-focus-within:text-teal-600 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidates, jobs..."
                aria-label="Search"
                className="w-full pl-11 pr-16 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 outline-none text-sm transition-all placeholder:text-stone-400 text-stone-900"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-stone-100 text-[10px] font-medium text-stone-500">
                <Command className="w-3 h-3" />K
              </kbd>
            </div>
          </form>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <NotificationBell />

          <div className="relative user-menu-container">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 sm:gap-2.5 px-2 sm:px-3 py-2 hover:bg-stone-100 rounded-xl transition-colors"
              title="User menu"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center font-bold text-sm text-white shadow-md flex-shrink-0 overflow-hidden">
                {profilePicture ? (
                  <img src={`${BASE_API_URL}${profilePicture}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <span className="hidden sm:inline text-sm font-semibold text-stone-700">Hi, {displayName}</span>
              <span className={`hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${roleBadgeColors[userRole] || roleBadgeColors.readonly}`}>
                {userRole}
              </span>
              <ChevronDown className={`hidden sm:inline w-4 h-4 text-stone-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-stone-200/80 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-stone-50/80 to-transparent">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-stone-900 truncate">{displayName}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize border flex-shrink-0 ${roleBadgeColors[userRole] || roleBadgeColors.readonly}`}>
                      {userRole}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5 truncate">{userEmail}</p>
                  {orgName && (
                    <p className="text-xs text-teal-700 font-medium mt-1.5 flex items-center gap-1">
                      <Building2 size={11} />{orgName}
                    </p>
                  )}
                </div>
                <div className="py-1">
                  <button onClick={() => { navigate('/settings'); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2.5 transition-colors">
                    <User size={16} className="text-stone-400" />
                    My Profile
                  </button>
                  {isAdmin && (
                    <>
                      <button onClick={() => { navigate('/organization'); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2.5 transition-colors">
                        <Settings size={16} className="text-stone-400" />
                        Organization Settings
                      </button>
                      <button onClick={() => { navigate('/organization/integrations'); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2.5 transition-colors">
                        <Shield size={16} className="text-stone-400" />
                        Integrations
                      </button>
                    </>
                  )}
                  {userRole === 'owner' && (
                    <button onClick={() => { navigate('/billing'); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2.5 transition-colors">
                      <CreditCard size={16} className="text-stone-400" />
                      Billing & Plans
                    </button>
                  )}
                </div>
                <div className="border-t border-stone-100 py-1">
                  <button onClick={() => handleLogout(navigate)} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors font-medium">
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
