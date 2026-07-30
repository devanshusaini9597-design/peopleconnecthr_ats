import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BarChart3, 
  Briefcase, 
  GitPullRequest, 
  Users, 
  Kanban, 
  UserPlus, 
  FileText, 
  Search, 
  Calendar, 
  UserCog, 
  Building2, 
  Plug, 
  Mail, 
  Settings, 
  User, 
  CreditCard,
  ChevronLeft,
  X,
  LogOut
} from 'lucide-react';
import { handleLogout } from '../utils/authUtils';

const getUserData = () => {
  try {
    const data = localStorage.getItem('userData');
    if (data) return JSON.parse(data);
  } catch {}
  return { name: 'User', role: 'recruiter' };
};

const getOrgData = () => {
  try {
    const data = localStorage.getItem('orgData');
    if (data) return JSON.parse(data);
  } catch {}
  return { name: 'SkillNix', logo: null };
};

const SECTIONS = [
  {
    title: 'MAIN',
    roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'],
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'] },
      { label: 'Analytics', path: '/analytics', icon: BarChart3, roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'] },
    ]
  },
  {
    title: 'RECRUITMENT',
    roles: ['owner', 'admin', 'recruiter'],
    items: [
      { label: 'Jobs', path: '/jobs', icon: Briefcase, roles: ['owner', 'admin', 'recruiter'] },
      { label: 'Applications', path: '/applications', icon: GitPullRequest, roles: ['owner', 'admin', 'recruiter'] },
      { label: 'Candidates', path: '/ats', icon: Users, roles: ['owner', 'admin', 'recruiter'] },
      { label: 'Pipeline Board', path: '/recruitment', icon: Kanban, roles: ['owner', 'admin', 'recruiter'] },
      { label: 'Add Candidate', path: '/add-candidate', icon: UserPlus, roles: ['owner', 'admin', 'recruiter'] },
      { label: 'Resume Parsing', path: '/resume-parsing', icon: FileText, roles: ['owner', 'admin', 'recruiter'] },
      { label: 'Candidate Search', path: '/candidate-search', icon: Search, roles: ['owner', 'admin', 'recruiter'] },
    ]
  },
  {
    title: 'INTERVIEWS',
    roles: ['owner', 'admin', 'recruiter', 'interviewer'],
    items: [
      { label: 'Interviews', path: '/interviews', icon: Calendar, roles: ['owner', 'admin', 'recruiter', 'interviewer'] },
    ]
  },
  {
    title: 'ORGANIZATION',
    roles: ['owner', 'admin'],
    items: [
      { label: 'Team', path: '/team', icon: UserCog, roles: ['owner', 'admin'] },
      { label: 'Organization', path: '/organization', icon: Building2, roles: ['owner', 'admin'] },
      { label: 'Integrations', path: '/organization/integrations', icon: Plug, roles: ['owner', 'admin'] },
    ]
  },
  {
    title: 'SETTINGS',
    roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'],
    items: [
      { label: 'Email Templates', path: '/email-templates', icon: Mail, roles: ['owner', 'admin', 'recruiter'] },
      { label: 'Email Settings', path: '/email-settings', icon: Settings, roles: ['owner', 'admin'] },
      { label: 'Profile', path: '/settings', icon: User, roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'] },
    ]
  },
  {
    title: 'BILLING',
    roles: ['owner'],
    items: [
      { label: 'Billing', path: '/billing', icon: CreditCard, roles: ['owner'] },
    ]
  }
];

const Sidebar = ({ isOpen, setIsOpen }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const userData = getUserData();
  const userRole = userData.role || 'recruiter';
  const orgData = getOrgData();

  const handleCloseMobile = () => {
    if (isOpen && setIsOpen) setIsOpen(false);
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={handleCloseMobile}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        bg-slate-900 border-r border-slate-800 text-slate-300
        transform transition-all duration-300 ease-in-out
        lg:transform-none
        flex flex-col
        ${collapsed ? 'w-20' : 'w-64'}
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo Section */}
        <div className={`
          h-16 border-b border-slate-800 flex items-center justify-between px-4
          transition-all duration-300 shrink-0
        `}>
          {!collapsed && (
            <div className="flex items-center gap-3 overflow-hidden">
              {orgData.logo ? (
                <img src={orgData.logo} alt="Org Logo" className="w-8 h-8 rounded object-cover" />
              ) : (
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-sm">
                    {orgData.name ? orgData.name.charAt(0).toUpperCase() : 'S'}
                  </span>
                </div>
              )}
              <span className="font-bold text-white text-sm truncate">{orgData.name || 'SkillNix'}</span>
            </div>
          )}
          
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white ml-auto"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronLeft 
              size={18} 
              className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
            />
          </button>

          <button
            onClick={handleCloseMobile}
            className={`lg:hidden p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white ${collapsed ? 'hidden' : ''}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
          {SECTIONS.filter(section => section.roles.includes(userRole)).map((section, idx) => {
            const sectionItems = section.items.filter(item => item.roles.includes(userRole));
            
            if (sectionItems.length === 0) return null;

            return (
              <div key={idx} className="space-y-1">
                {!collapsed && (
                  <div className="px-3 mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {section.title}
                    </span>
                  </div>
                )}
                
                <div className="space-y-1">
                  {sectionItems.map((item) => (
                    <NavLink
                      key={item.label}
                      to={item.path}
                      onClick={handleCloseMobile}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200
                        ${isActive 
                          ? 'bg-blue-600 text-white' 
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }
                        ${collapsed ? 'justify-center' : ''}
                      `}
                      title={collapsed ? item.label : ''}
                    >
                      <item.icon size={20} className="shrink-0" />
                      {!collapsed && <span className="font-medium text-sm truncate">{item.label}</span>}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User / Bottom Section */}
        <div className="p-4 border-t border-slate-800 shrink-0 space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                <User size={20} className="text-slate-300" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium text-white truncate">{userData.name || 'User'}</span>
                <span className="text-xs text-slate-400 capitalize truncate">{userRole}</span>
              </div>
            </div>
          )}

          <button 
            onClick={() => handleLogout(navigate)}
            className={`
              w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-400/10 hover:text-red-300 rounded-lg transition-colors cursor-pointer
              ${collapsed ? 'justify-center' : ''}
            `}
            title="Logout"
          >
            <LogOut size={20} className="shrink-0" />
            {!collapsed && <span className="font-medium text-sm">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
