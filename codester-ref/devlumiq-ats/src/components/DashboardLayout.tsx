'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   DashboardLayout — Main authenticated app shell
   Sections: Sidebar (logo · nav groups · user menu) ·
             Top Header (search · notifications · locale switcher) ·
             Main Content Area · Floating Chat · Logout Confirm Modal
   Wraps all pages under: src/app/dashboard/
───────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  Menu, X, Home, Users, BarChart3, Settings, LogOut,
  Bell, Search, ChevronDown, ChevronLeft, Command, FolderOpen, FileText,
  LayoutGrid, Mail, MessageCircle, Calendar, ChevronRight,
  Sparkles, Crown, Star, Zap, FileCheck, MessageSquare, Upload, Share2, Briefcase, Shield,
  Building, Puzzle, Info, CheckCircle2, AlertTriangle, Inbox, Clock, Tags, Archive
} from 'lucide-react';
import { ROLE_PERMISSIONS, Role } from '@/lib/roles';
import { roleBadgeClass } from '@/lib/roleUi';
import LocaleSwitcher from './LocaleSwitcher';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import Breadcrumbs from './Breadcrumbs';
import FloatingChat from './FloatingChat';
import Logo from './Logo';
import { ConfirmModal } from './ui/ConfirmModal';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [navLoading, setNavLoading] = useState(false);
  const getInitialOpenGroups = () => {
    const set = new Set<string>();
    const path = pathname;
    if (['/dashboard/candidates', '/dashboard/kanban', '/dashboard/jobs', '/dashboard/talent-pools'].includes(path)) set.add('recruitment');
    else if (['/dashboard/analytics', '/dashboard/reports', '/dashboard/dei'].includes(path)) set.add('analytics');
    else if (['/dashboard/inbox', '/dashboard/messages'].includes(path)) set.add('communication');
    else if (path.startsWith('/dashboard/premium') || path === '/dashboard/company' || path === '/dashboard/integrations') set.add('premium');
    else if (['/dashboard/assessments', '/dashboard/skills', '/dashboard/referrals', '/dashboard/esignature', '/dashboard/background-checks'].includes(path)) set.add('tools');
    else { set.add('recruitment'); set.add('analytics'); set.add('communication'); }
    return set;
  };
  const [openNavGroups, setOpenNavGroups] = useState<Set<string>>(getInitialOpenGroups);
  const [flyoutGroupKey, setFlyoutGroupKey] = useState<string | null>(null);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0, maxH: 400 });
  const flyoutBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const prevPathRef = useRef(pathname);
  const bellRef = useRef<HTMLButtonElement>(null);
  const notificationsPanelRef = useRef<HTMLDivElement>(null);
  const [notificationsPanelStyle, setNotificationsPanelStyle] = useState({ top: 0, left: 0, width: 320 });

  useLayoutEffect(() => {
    if (!showNotifications || !bellRef.current || typeof window === 'undefined') return;
    const rect = bellRef.current.getBoundingClientRect();
    const padding = 12;
    const maxW = Math.min(380, window.innerWidth - padding * 2);
    const isNarrow = window.innerWidth < 640;
    const left = isNarrow ? (window.innerWidth - maxW) / 2 : Math.min(rect.right - maxW, window.innerWidth - maxW - padding);
    const clampedLeft = Math.max(padding, left);
    setNotificationsPanelStyle({
      top: rect.bottom + 8,
      left: clampedLeft,
      width: maxW,
    });
  }, [showNotifications]);

  const [displayName, setDisplayName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [initials, setInitials] = useState('U');
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const u = json?.user;
        if (u?.email) setUserEmail(u.email);
        if (u?.role) setUserRole(u.role);
        if (u?.name) {
          setDisplayName(u.name);
          setInitials(u.name.slice(0, 2).toUpperCase());
        } else if (u?.email) {
          const name = u.email.split('@')[0] || u.email;
          setDisplayName(name);
          setInitials(name.slice(0, 2).toUpperCase());
        }
      })
      .catch(() => {
        if (typeof window !== 'undefined') {
          const n = localStorage.getItem('userName');
          const e = localStorage.getItem('userEmail');
          if (e) setUserEmail(e);
          const name = n || (e?.includes('@') ? e.split('@')[0] : e) || 'User';
          setDisplayName(name);
          setInitials(name.slice(0, 2).toUpperCase());
        }
      });
    return () => { cancelled = true; };
  }, []);

  const { t, locale } = useLocale();
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; type: string; isRead: boolean; href?: string | null; createdAt: string }[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/notifications', { credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setNotifications(json.notifications ?? []);
        setUnreadCount(json.unreadCount ?? 0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}), credentials: 'include' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success(t('header.markedRead'), t('header.markedReadDesc'));
    } catch {}
  };

  const handleNotificationClick = async (n: typeof notifications[0]) => {
    if (!n.isRead) {
      fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }), credentials: 'include' }).catch(() => {});
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setShowNotifications(false);
    if (n.href) router.push(n.href);
  };

  const formatNotifTime = (dateStr: string) => {
    const ms = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(ms / 3600000);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(ms / 86400000);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const notifTypeConfig: Record<string, { bg: string; text: string; Icon: React.ElementType; border: string }> = {
    info: { bg: 'bg-blue-50', text: 'text-blue-600', Icon: Info, border: 'border-blue-100' },
    success: { bg: 'bg-emerald-50', text: 'text-emerald-600', Icon: CheckCircle2, border: 'border-emerald-100' },
    warning: { bg: 'bg-amber-50', text: 'text-amber-600', Icon: AlertTriangle, border: 'border-amber-100' },
    error: { bg: 'bg-red-50', text: 'text-red-600', Icon: Info, border: 'border-red-100' },
    interview: { bg: 'bg-purple-50', text: 'text-purple-600', Icon: Calendar, border: 'border-purple-100' },
    callback: { bg: 'bg-orange-50', text: 'text-orange-600', Icon: Clock, border: 'border-orange-100' },
    message: { bg: 'bg-brand-50', text: 'text-brand-600', Icon: MessageSquare, border: 'border-brand-100' },
  };

  const groupConfig: Record<string, { iconBg: string; iconColor: string; activeBg: string; activeBar: string; activeText: string }> = {
    recruitment:  { iconBg: 'bg-brand-500/25',   iconColor: 'text-brand-400',   activeBg: 'bg-brand-500/10',   activeBar: 'bg-brand-400',   activeText: 'text-brand-300'   },
    premium:      { iconBg: 'bg-amber-500/20',   iconColor: 'text-amber-400',   activeBg: 'bg-amber-500/10',   activeBar: 'bg-amber-400',   activeText: 'text-amber-300'   },
    tools:        { iconBg: 'bg-violet-500/20',  iconColor: 'text-violet-400',  activeBg: 'bg-violet-500/10',  activeBar: 'bg-violet-400',  activeText: 'text-violet-300'  },
    analytics:    { iconBg: 'bg-sky-500/20',     iconColor: 'text-sky-400',     activeBg: 'bg-sky-500/10',     activeBar: 'bg-sky-400',     activeText: 'text-sky-300'     },
    communication:{ iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400', activeBg: 'bg-emerald-500/10', activeBar: 'bg-emerald-400', activeText: 'text-emerald-300' },
  };
  const _ALL  = ['ADMIN','RECRUITER','HIRING_MANAGER','INTERVIEWER','VIEWER'];
  const _STAFF = ['ADMIN','RECRUITER','HIRING_MANAGER'];
  type NavItem = { labelKey: string; icon: React.ElementType; path: string; badge?: number; requiredPermission?: string };
  type NavGroup = { key: string; labelKey: string; icon: React.ElementType; roles: string[]; items: NavItem[] };
  const userPermissions: string[] = userRole ? ((ROLE_PERMISSIONS[userRole as Role] ?? []) as string[]) : [];
  const canAccessItem = (perm?: string) => !perm || !userRole || userPermissions.includes(perm);
  const navGroups: NavGroup[] = [
    { key: 'recruitment', labelKey: 'dashboard.navRecruitment', icon: Users, roles: _ALL, items: [
      { labelKey: 'dashboard.candidates', icon: Users, path: '/dashboard/candidates', requiredPermission: 'VIEW_CANDIDATES' },
      { labelKey: 'dashboard.kanban', icon: LayoutGrid, path: '/dashboard/kanban', requiredPermission: 'VIEW_APPLICATIONS' },
      { labelKey: 'dashboard.jobs', icon: FolderOpen, path: '/dashboard/jobs', requiredPermission: 'VIEW_JOBS' },
      { labelKey: 'dashboard.talentPools', icon: Archive, path: '/dashboard/talent-pools', requiredPermission: 'VIEW_CANDIDATES' },
    ]},
    { key: 'premium', labelKey: 'premium.title', icon: Crown, roles: ['ADMIN','RECRUITER','HIRING_MANAGER','INTERVIEWER'], items: [
      { labelKey: 'premium.smartSearch.title', icon: Search, path: '/dashboard/premium/search', requiredPermission: 'USE_SMART_SEARCH' },
      { labelKey: 'premium.emailTemplates.title', icon: Mail, path: '/dashboard/premium/email', requiredPermission: 'USE_EMAIL_TEMPLATES' },
      { labelKey: 'premium.interviewScoring.title', icon: Star, path: '/dashboard/premium/scoring', requiredPermission: 'SCORE_INTERVIEW' },
      { labelKey: 'premium.offerLetters.title', icon: FileCheck, path: '/dashboard/premium/offers', requiredPermission: 'GENERATE_OFFER_LETTER' },
      { labelKey: 'premium.teamComments.title', icon: MessageSquare, path: '/dashboard/premium/comments', requiredPermission: 'USE_TEAM_COMMENTS' },
      { labelKey: 'premium.resumeParser.title', icon: Upload, path: '/dashboard/premium/resume', requiredPermission: 'USE_RESUME_PARSER' },
      { labelKey: 'premium.jobPosting.title', icon: Briefcase, path: '/dashboard/premium/jobposting', requiredPermission: 'CREATE_JOB' },
      { labelKey: 'premium.jobBoards.title', icon: Share2, path: '/dashboard/premium/jobboards', requiredPermission: 'MANAGE_INTEGRATIONS' },
      { labelKey: 'dashboard.integrations', icon: Puzzle, path: '/dashboard/integrations', requiredPermission: 'MANAGE_INTEGRATIONS' },
      { labelKey: 'dashboard.company', icon: Building, path: '/dashboard/company', requiredPermission: 'MANAGE_COMPANY' },
    ]},
    { key: 'tools', labelKey: 'dashboard.navTools', icon: Sparkles, roles: _STAFF, items: [
      { labelKey: 'dashboard.assessments', icon: FileCheck, path: '/dashboard/assessments', requiredPermission: 'VIEW_ASSESSMENTS' },
      { labelKey: 'dashboard.skills', icon: Tags, path: '/dashboard/skills', requiredPermission: 'VIEW_CANDIDATES' },
      { labelKey: 'dashboard.referrals', icon: Users, path: '/dashboard/referrals', requiredPermission: 'VIEW_REFERRALS' },
      { labelKey: 'dashboard.esignature', icon: FileCheck, path: '/dashboard/esignature', requiredPermission: 'USE_ESIGNATURE' },
      { labelKey: 'dashboard.backgroundChecks', icon: Shield, path: '/dashboard/background-checks', requiredPermission: 'VIEW_BACKGROUND_CHECKS' },
    ]},
    { key: 'analytics', labelKey: 'dashboard.navAnalytics', icon: BarChart3, roles: ['ADMIN','RECRUITER','HIRING_MANAGER','VIEWER'], items: [
      { labelKey: 'dashboard.analytics', icon: BarChart3, path: '/dashboard/analytics', requiredPermission: 'VIEW_ANALYTICS' },
      { labelKey: 'dashboard.reports', icon: FileText, path: '/dashboard/reports', requiredPermission: 'VIEW_REPORTS' },
      { labelKey: 'dashboard.dei', icon: Shield, path: '/dashboard/dei', requiredPermission: 'MANAGE_SETTINGS' },
    ]},
    { key: 'communication', labelKey: 'dashboard.navCommunication', icon: Mail, roles: _ALL, items: [
      { labelKey: 'dashboard.inbox', icon: Mail, path: '/dashboard/inbox' },
      { labelKey: 'dashboard.messages', icon: MessageCircle, path: '/dashboard/messages' },
    ]},
  ];
  const visibleNavGroups = userRole
    ? navGroups.filter((g) => g.roles.includes(userRole))
    : navGroups;
  const toggleNavGroup = (key: string) => setOpenNavGroups((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const openCollapsedGroup = (key: string) => setOpenNavGroups((prev) => (prev.has(key) ? new Set() : new Set([key])));
  const handleCollapsedGroupClick = (key: string) => {
    const btn = flyoutBtnRefs.current[key];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const vh = window.innerHeight;
      const gap = 8;
      // Size flyout to its actual content so ALL items are visible
      const group = navGroups.find((g) => g.key === key);
      const itemCount = group?.items.length ?? 4;
      // 44px per row + 56px for the header section
      const contentH = itemCount * 44 + 56;
      // Never taller than the viewport (small screens)
      const maxH = Math.min(contentH, vh - gap * 2);
      // Prefer opening with flyout top = button top (most natural)
      const spaceBelow = vh - rect.top - gap;
      const top = spaceBelow >= maxH
        ? rect.top                         // fits below — align with button
        : Math.max(gap, vh - maxH - gap);  // shift up so it fits in viewport
      setFlyoutPos({ top, left: rect.right + 6, maxH });
    }
    setFlyoutGroupKey((prev) => (prev === key ? null : key));
  };
  const isGroupActive = (items: NavItem[]) => items.some((it) => pathname === it.path);

  // Client-side fast-redirect — server middleware already guards the route;
  // we only redirect here when both localStorage flags are absent (e.g. cookies
  // cleared manually). A missing token alone does not redirect — the session
  // API call in the useEffect above will handle auth failures gracefully.
  useEffect(() => {
    const token = localStorage.getItem('token');
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    // Only redirect if *both* flags are missing; avoids false-positive on first
    // load before hydration or when using cookie-only auth without localStorage.
    if (!token && !isLoggedIn) router.push('/login');
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
        setShowNotifications(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // AJAX-like: show thin loading bar and smooth transition on route change
  useEffect(() => {
    if (pathname === prevPathRef.current) return;
    prevPathRef.current = pathname;
    setNavLoading(true);
    const t = setTimeout(() => setNavLoading(false), 320);
    return () => clearTimeout(t);
  }, [pathname]);

  // Scroll main content to top on route change - prevents layout/gap issues on back/forward nav
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Auto-expand sidebar group that contains current page
  useEffect(() => {
    const groupForPath: Record<string, string> = {
      '/dashboard/candidates': 'recruitment', '/dashboard/kanban': 'recruitment', '/dashboard/jobs': 'recruitment',
      '/dashboard/talent-pools': 'recruitment',
      '/dashboard/analytics': 'analytics', '/dashboard/reports': 'analytics', '/dashboard/dei': 'analytics',
      '/dashboard/inbox': 'communication', '/dashboard/messages': 'communication',
      '/dashboard/company': 'premium', '/dashboard/integrations': 'premium',
      '/dashboard/assessments': 'tools', '/dashboard/skills': 'tools', '/dashboard/referrals': 'tools',
      '/dashboard/esignature': 'tools', '/dashboard/background-checks': 'tools',
    };
    const key = groupForPath[pathname];
    if (key) setOpenNavGroups((prev) => new Set(prev).add(key));
    // Also expand premium group for any /dashboard/premium/* path
    if (pathname.startsWith('/dashboard/premium')) {
      setOpenNavGroups((prev) => new Set(prev).add('premium'));
    }
  }, [pathname]);

  // Close collapsed flyout on outside click or Escape
  useEffect(() => {
    if (!flyoutGroupKey) return;
    const handleClose = (e: MouseEvent) => {
      const el = document.getElementById('sidebar-flyout');
      if (el?.contains(e.target as Node)) return;
      setFlyoutGroupKey(null);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFlyoutGroupKey(null); };
    document.addEventListener('mousedown', handleClose);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClose);
      document.removeEventListener('keydown', handleKey);
    };
  }, [flyoutGroupKey]);

  useEffect(() => {
    if (!sidebarCollapsed) setFlyoutGroupKey(null);
  }, [sidebarCollapsed]);

  const handleLogoutClick = () => {
    setShowUserMenu(false);
    setLogoutConfirmOpen(true);
  };

  const handleLogoutConfirm = async () => {
    // Clear server-side httpOnly session cookie first
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // proceed even if request fails
    }
    localStorage.removeItem('token');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    setLogoutConfirmOpen(false);
    toast.success(t('dashboard.logout'), 'You have been signed out.');
    router.push('/login');
  };

  const toast = useToast();
  return (
    <div className="flex h-dvh bg-stone-50 overflow-hidden">
      {/* --- Section: DashboardLayout Root - start --- */}
      {/* Sidebar overlay - mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar — dark theme - FIXED */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarCollapsed ? 80 : 280,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col overflow-x-hidden overflow-y-hidden bg-gradient-to-b from-stone-900 via-stone-950 to-stone-950 border-r border-stone-800/50 shadow-2xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Subtle gradient accents */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgb(13_148_136/0.08),transparent)] pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-brand-500/5 to-transparent pointer-events-none" />
        
        {/* Sidebar glow accent */}
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-brand-500/30 via-transparent to-transparent" />

        <div className="relative flex items-center justify-between h-[68px] px-4 border-b border-stone-800/40 flex-shrink-0">
          <Link href="/dashboard" className={`flex items-center gap-3 min-w-0 flex-1 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-teal-700 flex items-center justify-center shadow-lg shadow-brand-500/25 text-white flex-shrink-0">
              <Logo className="w-4 h-4 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="font-bold text-stone-100 text-sm leading-tight truncate">{t('dashboard.title')}</p>
                <p className="text-[10px] text-stone-500 font-medium leading-tight">Recruitment Suite</p>
              </div>
            )}
          </Link>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-1.5 hover:bg-stone-800/70 rounded-lg transition-colors text-stone-500 hover:text-stone-300 flex-shrink-0"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 hover:bg-stone-800/60 rounded-lg text-stone-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav scroll area — wrapper enables the bottom gradient overlay */}
        <div className="relative flex-1 min-h-0">
        <nav className={`h-full py-4 px-3 space-y-1 overflow-y-auto ${sidebarCollapsed ? 'scrollbar-hide' : 'sidebar-nav-scrollbar'}`}>
          {/* Dashboard (standalone) */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 }}>
            <Link href="/dashboard" onClick={() => setSidebarOpen(false)} title={sidebarCollapsed ? t('dashboard.title') : undefined}>
              <div className={`relative flex items-center gap-3 ${ sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'} rounded-xl font-medium transition-all duration-200 ${
                pathname === '/dashboard' ? 'bg-stone-800 text-white' : 'text-stone-400 hover:bg-stone-800/50 hover:text-stone-200'
              }`}>
                {pathname === '/dashboard' && !sidebarCollapsed && (
                  <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-brand-400" />
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  pathname === '/dashboard' ? 'bg-brand-500/30' : 'bg-stone-800/60'
                }`}>
                  <Home className={`w-4 h-4 ${pathname === '/dashboard' ? 'text-brand-300' : 'text-stone-500'}`} />
                </div>
                {!sidebarCollapsed && <span className="text-sm">{t('dashboard.title')}</span>}
              </div>
            </Link>
          </motion.div>

          {/* Grouped dropdowns */}
          {visibleNavGroups.map((group, gi) => {
            const GroupIcon = group.icon;
            const isOpen = openNavGroups.has(group.key);
            const hasActive = isGroupActive(group.items);
            return (
              <motion.div key={group.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + gi * 0.04 }}>
                {(() => {
                  const gc = groupConfig[group.key];
                  return sidebarCollapsed ? (
                    <div>
                      <button
                        ref={(el) => { flyoutBtnRefs.current[group.key] = el; }}
                        type="button"
                        title={t(group.labelKey)}
                        onClick={() => handleCollapsedGroupClick(group.key)}
                        className={`relative flex items-center justify-center w-full py-2.5 rounded-xl transition-all duration-200 ${
                          hasActive ? gc?.activeBg ?? 'bg-stone-800' : 'hover:bg-stone-800/50'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                          hasActive ? gc?.iconBg ?? 'bg-stone-700' : 'bg-stone-800/50'
                        }`}>
                          <GroupIcon className={`w-4 h-4 ${hasActive ? gc?.iconColor ?? 'text-stone-300' : 'text-stone-500'}`} />
                        </div>
                        {hasActive && gc && (
                          <span className={`absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full ${gc.activeBar} shadow-[0_0_5px_rgba(13,148,136,0.7)]`} />
                        )}
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleNavGroup(group.key)}
                        className={`relative flex items-center justify-between w-full gap-2 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                          hasActive
                            ? `${gc?.activeBg ?? 'bg-stone-800'} ${gc?.activeText ?? 'text-stone-200'}`
                            : 'text-stone-400 hover:bg-stone-800/50 hover:text-stone-200'
                        }`}
                      >
                        {hasActive && gc && (
                          <div className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full ${gc.activeBar}`} />
                        )}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            hasActive ? gc?.iconBg ?? 'bg-stone-700' : 'bg-stone-800/60'
                          }`}>
                            <GroupIcon className={`w-4 h-4 ${hasActive ? gc?.iconColor ?? 'text-stone-300' : 'text-stone-500'}`} />
                          </div>
                          <span className="truncate text-sm">{t(group.labelKey)}</span>
                        </div>
                        <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.18 }}>
                          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-stone-600" />
                        </motion.div>
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-0.5 ml-3 pl-3 pb-1 space-y-0.5 border-l border-stone-800">
                              {group.items.map((item) => {
                                const ItemIcon = item.icon;
                                const active = pathname === item.path;
                                const locked = !canAccessItem(item.requiredPermission);
                                if (locked) return null;
                                return (
                                  <Link key={item.path} href={item.path} onClick={() => setSidebarOpen(false)}>
                                    <div className={`relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                      active
                                        ? `bg-white/5 ${gc?.activeText ?? 'text-stone-200'}`
                                        : 'text-stone-500 hover:bg-stone-800/40 hover:text-stone-200'
                                    }`}>
                                      {active && gc && (
                                        <div className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full ${gc.activeBar}`} />
                                      )}
                                      <span className="relative flex-shrink-0">
                                        <ItemIcon className="w-3.5 h-3.5" />
                                        {item.badge != null && item.badge > 0 && (
                                          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-0.5 flex items-center justify-center rounded-full bg-brand-500 text-white text-[9px] font-bold">
                                            {item.badge > 99 ? '99+' : item.badge}
                                          </span>
                                        )}
                                      </span>
                                      <span>{t(item.labelKey)}</span>
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  );
                })()}
              </motion.div>
            );
          })}

          {/* Calendar (standalone) */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Link href="/dashboard/calendar" onClick={() => setSidebarOpen(false)} title={sidebarCollapsed ? t('dashboard.calendar') : undefined}>
              <div className={`relative flex items-center gap-3 ${sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'} rounded-xl font-medium transition-all duration-200 ${
                pathname === '/dashboard/calendar' ? 'bg-stone-800 text-white' : 'text-stone-400 hover:bg-stone-800/50 hover:text-stone-200'
              }`}>
                {pathname === '/dashboard/calendar' && !sidebarCollapsed && (
                  <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-brand-400" />
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  pathname === '/dashboard/calendar' ? 'bg-brand-500/30' : 'bg-stone-800/60'
                }`}>
                  <Calendar className={`w-4 h-4 ${pathname === '/dashboard/calendar' ? 'text-brand-300' : 'text-stone-500'}`} />
                </div>
                {!sidebarCollapsed && <span className="text-sm">{t('dashboard.calendar')}</span>}
              </div>
            </Link>
          </motion.div>

          {/* Settings group (Settings + role-gated links) — staff only */}
          {(() => {
            if (!['ADMIN', 'RECRUITER', 'HIRING_MANAGER'].includes(userRole)) return null;
            const settingsPaths = ['/dashboard/settings', '/dashboard/settings/users', '/dashboard/settings/audit-log'];
            const isSettingsActive = settingsPaths.some(p => pathname.startsWith(p));
            const isSettingsOpen = openNavGroups.has('settings');
            const settingsSubItems = [
              { label: 'User Management', icon: Users, path: '/dashboard/settings/users', requiredPermission: 'MANAGE_USERS' },
              { label: 'Audit Logs', icon: Shield, path: '/dashboard/settings/audit-log', requiredPermission: 'VIEW_AUDIT_LOGS' },
            ];
            const adminItems = settingsSubItems;
            return (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.22 }}>
                {sidebarCollapsed ? (
                  <Link href="/dashboard/settings" onClick={() => setSidebarOpen(false)} title="Settings">
                    <div className={`relative flex items-center justify-center py-2.5 rounded-xl font-medium transition-all duration-200 ${
                      isSettingsActive ? 'bg-stone-800 text-white' : 'text-stone-400 hover:bg-stone-800/50 hover:text-stone-200'
                    }`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSettingsActive ? 'bg-brand-500/30' : 'bg-stone-800/60'
                      }`}>
                        <Settings className={`w-4 h-4 ${isSettingsActive ? 'text-brand-300' : 'text-stone-500'}`} />
                      </div>
                    </div>
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleNavGroup('settings')}
                      className={`relative flex items-center justify-between w-full gap-2 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                        isSettingsActive ? 'bg-stone-800/80 text-stone-200' : 'text-stone-400 hover:bg-stone-800/50 hover:text-stone-200'
                      }`}
                    >
                      {isSettingsActive && <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-brand-400" />}
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSettingsActive ? 'bg-brand-500/30' : 'bg-stone-800/60'
                        }`}>
                          <Settings className={`w-4 h-4 ${isSettingsActive ? 'text-brand-300' : 'text-stone-500'}`} />
                        </div>
                        <span className="text-sm">{t('dashboard.settings')}</span>
                      </div>
                      <motion.div animate={{ rotate: isSettingsOpen ? 90 : 0 }} transition={{ duration: 0.18 }}>
                        <ChevronRight className="w-3.5 h-3.5 text-stone-600" />
                      </motion.div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isSettingsOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-0.5 ml-3 pl-3 pb-1 space-y-0.5 border-l border-stone-800">
                            <Link href="/dashboard/settings" onClick={() => setSidebarOpen(false)}>
                              <div className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                                pathname === '/dashboard/settings' ? 'bg-white/5 text-stone-200' : 'text-stone-500 hover:bg-stone-800/40 hover:text-stone-200'
                              }`}>
                                <Settings className="w-3.5 h-3.5" /><span>General</span>
                              </div>
                            </Link>
                            {adminItems.filter(item => canAccessItem(item.requiredPermission)).map(item => (
                              <Link key={item.path} href={item.path} onClick={() => setSidebarOpen(false)}>
                                <div className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                                  pathname === item.path ? 'bg-white/5 text-stone-200' : 'text-stone-500 hover:bg-stone-800/40 hover:text-stone-200'
                                }`}>
                                  <item.icon className="w-3.5 h-3.5" /><span>{item.label}</span>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </motion.div>
            );
          })()}

          {/* Bottom spacer — fixes Chrome overflow-y padding-bottom bug */}
          <div className="h-3" aria-hidden="true" />
        </nav>
        {/* Gradient fade — signals scrollable content on big screens */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-stone-950/70 to-transparent" />
        </div>

        <div className="relative border-t border-stone-800/40 p-3 pb-4 flex-shrink-0 z-10 bg-stone-950">
          <div className={`flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-stone-800/40 transition-colors min-w-0 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-lg shadow-brand-500/20 select-none">
              {initials}
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-semibold text-stone-200 truncate leading-tight">{displayName}</p>
                  <p className="text-[11px] text-stone-500 truncate leading-tight mt-0.5">{userEmail}</p>
                  {userRole && (
                    <span className={`inline-flex items-center mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border max-w-full truncate ${roleBadgeClass(userRole)}`}>
                      {userRole.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogoutClick}
                  className="p-1.5 rounded-lg hover:bg-red-500/15 text-stone-600 hover:text-red-400 transition-colors flex-shrink-0"
                  title={t('dashboard.logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          {sidebarCollapsed && (
            <button
              onClick={handleLogoutClick}
              className="w-full p-2 rounded-xl flex items-center justify-center hover:bg-red-500/15 text-stone-600 hover:text-red-400 transition-colors"
              title={t('dashboard.logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.aside>

      {/* Collapsed sidebar flyout — portal so it's never clipped by overflow */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {sidebarCollapsed && flyoutGroupKey ? (() => {
            const fg = visibleNavGroups.find((g) => g.key === flyoutGroupKey);
            if (!fg) return null;
            const FGIcon = fg.icon;
            return (
              <motion.div
                id="sidebar-flyout"
                key={flyoutGroupKey}
                initial={{ opacity: 0, x: -8, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -8, scale: 0.97 }}
                transition={{ duration: 0.14, ease: [0.25, 0.1, 0.25, 1] }}
                style={{ top: flyoutPos.top, left: flyoutPos.left, position: 'fixed', maxHeight: flyoutPos.maxH }}
                className="py-1.5 min-w-[220px] overflow-y-auto rounded-xl bg-stone-900 border border-stone-700/80 shadow-2xl z-[200] sidebar-nav-scrollbar"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-stone-800 bg-stone-900">
                  <FGIcon className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{t(fg.labelKey)}</p>
                </div>
                <div className="py-1">
                  {fg.items.map((item) => {
                    const ItemIcon = item.icon;
                    const active = pathname === item.path;
                    const flyoutLocked = !canAccessItem(item.requiredPermission);
                    if (flyoutLocked) return null;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => { setSidebarOpen(false); setFlyoutGroupKey(null); }}
                      >
                        <div className={`flex items-center gap-3 mx-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                          active ? 'text-brand-300 bg-brand-500/15' : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                        }`}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            active ? 'bg-brand-500/25 text-brand-300' : 'bg-stone-800 text-stone-400'
                          }`}>
                            <ItemIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className="flex-1 min-w-0 truncate">{t(item.labelKey)}</span>
                          {item.badge != null && item.badge > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-bold flex-shrink-0">
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 shadow-[0_0_4px_rgba(13,148,136,0.8)]" />}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            );
          })() : null}
        </AnimatePresence>,
        document.body
      )}

      {/* Main content area - with left margin for fixed sidebar */}
      <div 
        className={`flex-1 flex flex-col min-w-0 h-full transition-all duration-300 ease-out ${
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-[280px]'
        }`}
      >
        {/* Header - FIXED */}
        <header className="sticky top-0 z-30 glass border-b border-stone-200/60 flex-shrink-0">
          <div className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-6 gap-2 sm:gap-4 min-w-0">
            {/* Mobile: Menu + LocaleSwitcher adjacent */}
            <div className="lg:hidden flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-2.5 hover:bg-stone-100 rounded-xl transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5 text-stone-600" />
              </button>
              <LocaleSwitcher />
            </div>
            <div className="hidden md:block flex-1 max-w-lg min-w-0">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 group-focus-within:text-brand-500 transition-colors" />
                <input
                  type="text"
                  placeholder={t('header.searchPlaceholder')}
                  aria-label={t('header.searchPlaceholder')}
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none text-sm transition-all placeholder:text-stone-400 text-stone-900"
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-stone-100 text-[10px] font-medium text-stone-500">
                  <Command className="w-3 h-3" />K
                </kbd>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 min-w-0" ref={menuRef}>
              <div className="hidden md:block"><LocaleSwitcher /></div>
              <div className="relative">
                <motion.button
                  ref={bellRef}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`relative p-2.5 rounded-xl transition-all duration-200 ${showNotifications ? 'bg-brand-100 text-brand-600' : 'hover:bg-stone-100 text-stone-600'}`}
                >
                  <Bell className={`w-5 h-5 ${showNotifications ? 'text-brand-600' : 'text-stone-600'}`} />
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] font-bold shadow-lg shadow-red-500/30"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </motion.span>
                  )}
                </motion.button>
                {typeof document !== 'undefined' &&
                  createPortal(
                    <AnimatePresence>
                      {showNotifications && (
                        <>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowNotifications(false)}
                            className="fixed inset-0 z-[180]"
                            aria-hidden
                          />
                          <motion.div
                            ref={notificationsPanelRef}
                            initial={{ opacity: 0, y: -8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.96 }}
                            transition={{ duration: 0.15 }}
                            style={{ top: notificationsPanelStyle.top, left: notificationsPanelStyle.left, width: notificationsPanelStyle.width }}
                            className="fixed max-h-[min(70vh,420px)] flex flex-col bg-white rounded-2xl shadow-xl border border-stone-200/80 overflow-hidden z-[200]"
                          >
                      <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-gradient-to-r from-stone-50/50 to-transparent">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shadow-md">
                            <Bell className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-stone-900">{t('header.notifications')}</h3>
                            <p className="text-xs text-stone-500">
                              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                            </p>
                          </div>
                        </div>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
                          >
                            {t('header.markAllRead')}
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="py-10 px-6 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center mb-4 shadow-inner">
                              <Inbox className="w-8 h-8 text-stone-400" />
                            </div>
                            <h4 className="text-base font-semibold text-stone-900 mb-1">No notifications</h4>
                            <p className="text-sm text-stone-500">You&apos;re all caught up! New notifications will appear here.</p>
                          </div>
                        ) : (
                          notifications.map((n) => {
                            const config = notifTypeConfig[n.type] || notifTypeConfig.info;
                            const Icon = config.Icon;
                            return (
                              <div
                                key={n.id}
                                onClick={() => handleNotificationClick(n)}
                                className={`group p-4 border-b border-stone-50 hover:bg-stone-50 transition-all duration-200 cursor-pointer ${!n.isRead ? 'bg-gradient-to-r from-brand-50/50 to-transparent' : ''}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${config.bg} ${config.text} ${config.border} border shadow-sm group-hover:shadow-md transition-shadow`}>
                                    <Icon className="w-5 h-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className={`text-sm break-words ${!n.isRead ? 'font-semibold text-stone-900' : 'font-medium text-stone-700'}`}>{n.title}</p>
                                      {!n.isRead && (
                                        <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1.5" />
                                      )}
                                    </div>
                                    <p className="text-xs text-stone-500 mt-0.5 break-words line-clamp-2 leading-relaxed">{n.message}</p>
                                    <p className="text-[11px] text-stone-400 mt-1.5 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {formatNotifTime(n.createdAt)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                            <Link href="/dashboard" onClick={() => setShowNotifications(false)} className="flex items-center justify-center gap-2 p-3 text-center text-sm font-semibold text-brand-600 hover:bg-stone-50 border-t border-stone-100">
                              {t('header.viewAll')}
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>,
                    document.body
                  )}
              </div>
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2.5 px-2.5 sm:px-3 py-2 hover:bg-stone-100 rounded-xl transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center font-bold text-sm text-white shadow-md">
                    {initials}
                  </div>
                  <span className="hidden sm:inline text-sm font-semibold text-stone-700">Hi, {displayName}</span>
                  {userRole && (
                    <span className={`hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${roleBadgeClass(userRole)}`}>
                      {userRole.replace('_', ' ')}
                    </span>
                  )}
                  <ChevronDown className={`hidden sm:inline w-4 h-4 text-stone-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </motion.button>
                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-stone-200/80 py-2 z-50 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-stone-100">
                        <p className="font-semibold text-stone-900">{displayName}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{userEmail}</p>
                      </div>
                      <button
                        onClick={handleLogoutClick}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
                      >
                        <LogOut className="w-4 h-4" />
                        {t('dashboard.logout')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          ref={mainRef}
          className="flex-1 min-h-0 overflow-auto overflow-x-hidden bg-stone-50/50 relative"
          role="main"
        >
          {/* Thin top loading bar - AJAX-like feel */}
          <AnimatePresence>
            {navLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-0 left-0 right-0 h-0.5 bg-brand-500 z-10 overflow-hidden"
              >
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '85%' }}
                  transition={{ duration: 0.28, ease: 'easeInOut' }}
                  className="h-full bg-gradient-to-r from-brand-500 to-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.6)]"
                />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="p-4 sm:p-5 lg:p-5 w-full min-w-0">
            <div className="max-w-7xl mx-auto">
              <Breadcrumbs />
              {children}
            </div>
          </div>
        </main>
      </div>
      <FloatingChat />
      <ConfirmModal
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogoutConfirm}
        title={t('confirm.logoutTitle')}
        description={t('confirm.logoutDesc')}
        confirmLabel={t('confirm.logout')}
        cancelLabel={t('common.cancel')}
        variant="primary"
      />
      {/* --- Section: DashboardLayout Root - end --- */}
    </div>
  );
}

