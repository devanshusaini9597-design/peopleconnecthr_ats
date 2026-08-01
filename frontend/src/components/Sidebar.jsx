import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  Briefcase,
  GitPullRequest,
  Users,
  Kanban,
  FileText,
  Calendar,
  UserCog,
  Building2,
  Plug,
  Mail,
  Settings,
  User,
  CreditCard,
  ScrollText,
  ShieldPlus,
  KeyRound,
  Webhook,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  X,
  LogOut,
  Layers,
  ClipboardList,
  Palette,
  Chrome,
  Home
} from 'lucide-react';
import { handleLogout } from '../utils/authUtils';
import { useAuth } from '../context/AuthContext';
import { planHasFeature } from '../config/planFeatures';

const getUserData = () => {
  try {
    const data = localStorage.getItem('userData');
    if (data) return JSON.parse(data);
  } catch { /* ignore */ }
  return { name: 'User', role: 'recruiter' };
};

const getOrgData = () => {
  try {
    const data = localStorage.getItem('orgData');
    if (data) return JSON.parse(data);
  } catch { /* ignore */ }
  return { name: 'SkillNix', logo: null };
};

const GROUP_STYLES = {
  main:          { iconBg: 'bg-teal-500/25',   iconColor: 'text-teal-400',   activeBg: 'bg-teal-500/10',   activeBar: 'bg-teal-400',   activeText: 'text-teal-300' },
  recruitment:   { iconBg: 'bg-teal-500/25',   iconColor: 'text-teal-400',   activeBg: 'bg-teal-500/10',   activeBar: 'bg-teal-400',   activeText: 'text-teal-300' },
  interviews:    { iconBg: 'bg-sky-500/20',    iconColor: 'text-sky-400',    activeBg: 'bg-sky-500/10',    activeBar: 'bg-sky-400',    activeText: 'text-sky-300' },
  organization:  { iconBg: 'bg-amber-500/20',  iconColor: 'text-amber-400',  activeBg: 'bg-amber-500/10',  activeBar: 'bg-amber-400',  activeText: 'text-amber-300' },
  settings:      { iconBg: 'bg-violet-500/20', iconColor: 'text-violet-400', activeBg: 'bg-violet-500/10', activeBar: 'bg-violet-400', activeText: 'text-violet-300' },
  billing:       { iconBg: 'bg-emerald-500/20',iconColor: 'text-emerald-400',activeBg: 'bg-emerald-500/10',activeBar: 'bg-emerald-400',activeText: 'text-emerald-300' },
};

const SECTIONS = [
  {
    key: 'main',
    title: 'Main',
    icon: Home,
    roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'],
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'] },
      { label: 'Analytics', path: '/analytics', icon: BarChart3, roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'] },
    ]
  },
  {
    key: 'recruitment',
    title: 'Recruitment',
    icon: Users,
    roles: ['owner', 'admin', 'recruiter'],
    items: [
      { label: 'Jobs', path: '/jobs', icon: Briefcase, roles: ['owner', 'admin', 'recruiter'] },
      { label: 'Applications', path: '/applications', icon: GitPullRequest, roles: ['owner', 'admin', 'recruiter'] },
      { label: 'Candidates', path: '/ats', icon: Users, roles: ['owner', 'admin', 'recruiter'] },
      { label: 'Pipeline Board', path: '/recruitment', icon: Kanban, roles: ['owner', 'admin', 'recruiter'] },
      { label: 'Resume Parsing', path: '/resume-parsing', icon: FileText, roles: ['owner', 'admin', 'recruiter'] },
      { label: 'Talent Pools', path: '/talent-pools', icon: Layers, roles: ['owner', 'admin', 'recruiter'], feature: 'candidates.talentPools' },
      { label: 'Assessments', path: '/assessments', icon: ClipboardList, roles: ['owner', 'admin', 'recruiter'], feature: 'assessments' },
    ]
  },
  {
    key: 'interviews',
    title: 'Interviews',
    icon: Calendar,
    roles: ['owner', 'admin', 'recruiter', 'interviewer'],
    items: [
      { label: 'Interviews', path: '/interviews', icon: Calendar, roles: ['owner', 'admin', 'recruiter', 'interviewer'] },
    ]
  },
  {
    key: 'organization',
    title: 'Organization',
    icon: Building2,
    roles: ['owner', 'admin'],
    items: [
      { label: 'Team', path: '/team', icon: UserCog, roles: ['owner', 'admin'] },
      { label: 'Organization', path: '/organization', icon: Building2, roles: ['owner', 'admin'] },
      { label: 'Integrations', path: '/organization/integrations', icon: Plug, roles: ['owner', 'admin'], feature: 'integrations.byoEmail' },
      { label: 'Audit Log', path: '/organization/audit-log', icon: ScrollText, roles: ['owner', 'admin'], feature: 'audit.log' },
      { label: 'Custom Roles', path: '/organization/custom-roles', icon: ShieldPlus, roles: ['owner', 'admin'], feature: 'team.customRoles' },
      { label: 'Single Sign-On', path: '/organization/sso', icon: KeyRound, roles: ['owner', 'admin'], feature: 'sso' },
      { label: 'Webhooks & API', path: '/organization/webhooks-api', icon: Webhook, roles: ['owner', 'admin'], feature: 'integrations.webhooksReadOnly' },
      { label: 'Scheduled Reports', path: '/organization/scheduled-reports', icon: CalendarClock, roles: ['owner', 'admin'], feature: 'reports.custom' },
      { label: 'White-Label Kit', path: '/organization/white-label', icon: Palette, roles: ['owner', 'admin'] },
      { label: 'Chrome Extension', path: '/organization/chrome-extension', icon: Chrome, roles: ['owner', 'admin'] },
    ]
  },
  {
    key: 'settings',
    title: 'Settings',
    icon: Settings,
    roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'],
    items: [
      { label: 'Email Templates', path: '/email-templates', icon: Mail, roles: ['owner', 'admin', 'recruiter'] },
      { label: 'Email Settings', path: '/email-settings', icon: Settings, roles: ['owner', 'admin'], feature: 'integrations.byoEmail' },
      { label: 'Profile', path: '/settings', icon: User, roles: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'] },
    ]
  },
  {
    key: 'billing',
    title: 'Billing',
    icon: CreditCard,
    roles: ['owner'],
    items: [
      { label: 'Billing', path: '/billing', icon: CreditCard, roles: ['owner'] },
    ]
  }
];

const ROLE_BADGE = {
  owner: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  admin: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  recruiter: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  interviewer: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  readonly: 'bg-stone-500/15 text-stone-400 border-stone-500/30',
};

const Sidebar = ({ isOpen, setIsOpen }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const userData = getUserData();
  const userRole = userData.role || 'recruiter';
  const orgData = getOrgData();
  const { organization } = useAuth();
  const orgPlan = organization?.plan;

  const initials = (userData.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const visibleSections = useMemo(() => (
    SECTIONS
      .filter((section) => section.roles.includes(userRole))
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => item.roles.includes(userRole) && (!item.feature || planHasFeature(orgPlan, item.feature))
        )
      }))
      .filter((section) => section.items.length > 0)
  ), [userRole, orgPlan]);

  const pathToGroup = useMemo(() => {
    const map = {};
    visibleSections.forEach((s) => s.items.forEach((item) => { map[item.path] = s.key; }));
    return map;
  }, [visibleSections]);

  const [openGroups, setOpenGroups] = useState(() => {
    const initial = new Set(['main', 'recruitment']);
    const key = pathToGroup[location.pathname];
    if (key) initial.add(key);
    return initial;
  });

  useEffect(() => {
    const key = pathToGroup[location.pathname];
    if (key) setOpenGroups((prev) => new Set(prev).add(key));
  }, [location.pathname, pathToGroup]);

  // Notify layout of collapsed width for main content margin
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('sidebarCollapsed', { detail: collapsed }));
  }, [collapsed]);

  const handleCloseMobile = () => {
    if (isOpen && setIsOpen) setIsOpen(false);
  };

  const toggleGroup = (key) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isGroupActive = (items) => items.some((it) => location.pathname === it.path || location.pathname.startsWith(it.path + '/'));

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={handleCloseMobile}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden
          bg-gradient-to-b from-stone-900 via-stone-950 to-stone-950
          border-r border-stone-800/50 shadow-2xl
          transition-all duration-300 ease-out
          ${collapsed ? 'w-20' : 'w-[280px]'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Ambient accents */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(20,184,166,0.08),transparent)] pointer-events-none" />
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-teal-500/30 via-transparent to-transparent pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center justify-between h-[68px] px-4 border-b border-stone-800/40 flex-shrink-0">
          <NavLink to="/dashboard" onClick={handleCloseMobile} className={`flex items-center gap-3 min-w-0 flex-1 ${collapsed ? 'justify-center' : ''}`}>
            {orgData.logo ? (
              <img src={orgData.logo} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0 shadow-lg" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 via-teal-600 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-500/25 text-white flex-shrink-0">
                <span className="font-bold text-sm">
                  {(orgData.name || 'S').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-bold text-stone-100 text-sm leading-tight truncate">{orgData.name || 'SkillNix'}</p>
                <p className="text-[10px] text-stone-500 font-medium leading-tight">Recruitment Suite</p>
              </div>
            )}
          </NavLink>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 hover:bg-stone-800/70 rounded-lg transition-colors text-stone-500 hover:text-stone-300 flex-shrink-0"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={handleCloseMobile} className="lg:hidden p-1.5 hover:bg-stone-800/60 rounded-lg text-stone-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <div className="relative flex-1 min-h-0">
          <nav className={`h-full py-4 px-3 space-y-1 overflow-y-auto ${collapsed ? 'scrollbar-hide' : 'sidebar-nav-scrollbar'}`}>
            {visibleSections.map((section) => {
              const GroupIcon = section.icon;
              const gc = GROUP_STYLES[section.key] || GROUP_STYLES.main;
              const isOpenGroup = openGroups.has(section.key);
              const hasActive = isGroupActive(section.items);

              if (collapsed) {
                return (
                  <div key={section.key} className="space-y-0.5">
                    {section.items.map((item) => {
                      const ItemIcon = item.icon;
                      const active = location.pathname === item.path;
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          end
                          onClick={handleCloseMobile}
                          title={item.label}
                          className={`relative flex items-center justify-center w-full py-2.5 rounded-xl transition-all duration-200 ${
                            active ? gc.activeBg : 'hover:bg-stone-800/50'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            active ? gc.iconBg : 'bg-stone-800/50'
                          }`}>
                            <ItemIcon className={`w-4 h-4 ${active ? gc.iconColor : 'text-stone-500'}`} />
                          </div>
                          {active && <span className={`absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full ${gc.activeBar}`} />}
                        </NavLink>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div key={section.key}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(section.key)}
                    className={`relative flex items-center justify-between w-full gap-2 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                      hasActive
                        ? `${gc.activeBg} ${gc.activeText}`
                        : 'text-stone-400 hover:bg-stone-800/50 hover:text-stone-200'
                    }`}
                  >
                    {hasActive && (
                      <div className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full ${gc.activeBar}`} />
                    )}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        hasActive ? gc.iconBg : 'bg-stone-800/60'
                      }`}>
                        <GroupIcon className={`w-4 h-4 ${hasActive ? gc.iconColor : 'text-stone-500'}`} />
                      </div>
                      <span className="truncate text-sm">{section.title}</span>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 text-stone-600 transition-transform duration-200 ${isOpenGroup ? 'rotate-90' : ''}`} />
                  </button>

                  <div className={`overflow-hidden transition-all duration-200 ${isOpenGroup ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="mt-0.5 ml-3 pl-3 pb-1 space-y-0.5 border-l border-stone-800">
                      {section.items.map((item) => {
                        const ItemIcon = item.icon;
                        const active = location.pathname === item.path;
                        return (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            end
                            onClick={handleCloseMobile}
                            className={`relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                              active
                                ? `bg-white/5 ${gc.activeText}`
                                : 'text-stone-500 hover:bg-stone-800/40 hover:text-stone-200'
                            }`}
                          >
                            {active && (
                              <div className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full ${gc.activeBar}`} />
                            )}
                            <ItemIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="h-3" aria-hidden="true" />
          </nav>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-stone-950/70 to-transparent" />
        </div>

        {/* User footer */}
        <div className="relative border-t border-stone-800/40 p-3 pb-4 flex-shrink-0 z-10 bg-stone-950">
          <div className={`flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-stone-800/40 transition-colors min-w-0 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-lg shadow-teal-500/20 select-none">
              {initials}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-semibold text-stone-200 truncate leading-tight">{userData.name || 'User'}</p>
                  <span className={`inline-flex items-center mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border max-w-full truncate ${ROLE_BADGE[userRole] || ROLE_BADGE.readonly}`}>
                    {userRole}
                  </span>
                </div>
                <button
                  onClick={() => handleLogout(navigate)}
                  className="p-1.5 rounded-lg hover:bg-red-500/15 text-stone-600 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          {collapsed && (
            <button
              onClick={() => handleLogout(navigate)}
              className="w-full mt-1 p-2 rounded-xl flex items-center justify-center hover:bg-red-500/15 text-stone-600 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
