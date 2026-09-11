import React, { useState, useEffect, useMemo, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { planHasFeature, planHasAnyIntegration } from '../config/planFeatures';
import ConfirmationModal from './ConfirmationModal';
import {
  SECTIONS,
  planHasAnyAiFeature,
} from './sidebar/sidebarConstants';
import SidebarNav from './sidebar/SidebarNav';
import SidebarFlyout from './sidebar/SidebarFlyout';
import SidebarUserFooter from './sidebar/SidebarUserFooter';
import { resolveOrgLogoSrc } from '../utils/orgLogo';
import useJobNavUpdates from '../hooks/useJobNavUpdates';
import useAnnouncementNavUpdates from '../hooks/useAnnouncementNavUpdates';
import useReportShareNavUpdates from '../hooks/useReportShareNavUpdates';
import useSupportNavUpdates from '../hooks/useSupportNavUpdates';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [flyoutGroupKey, setFlyoutGroupKey] = useState(null);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0, maxH: 400 });
  const flyoutBtnRefs = useRef({});
  const location = useLocation();
  const navigate = useNavigate();
  const { organization, user: authUser, logout } = useAuth();
  const userRole = authUser?.role || 'recruiter';
  const flushNavAwayFromAts = userRole === 'freelancer' && location.pathname === '/ats';
  const orgPlan = organization?.plan;
  const permissions = authUser?.permissions;
  const hasModuleKeys = Array.isArray(permissions) && permissions.some((p) => String(p).startsWith('modules.'));
  // Use effective permissions from API (org-edited system role OR custom pack).
  // Fall back to fixed role lists only when permissions are missing.
  const usePermissionPack = hasModuleKeys && userRole !== 'owner';
  const permissionSet = useMemo(
    () => (usePermissionPack ? new Set(permissions) : null),
    [usePermissionPack, permissions]
  );

  const visibleSections = useMemo(() => (
    SECTIONS
      .filter((section) => {
        if (usePermissionPack) return true;
        return section.roles.includes(userRole);
      })
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => {
            if (item.onlyRoles && !item.onlyRoles.includes(userRole)) return false;
            if (item.platformOnly && !authUser?.isPlatformOperator) return false;
            if (item.hideForRoles && item.hideForRoles.includes(userRole)) return false;
            if (usePermissionPack) {
              const freelancerBypass = userRole === 'freelancer' && (
                item.onlyRoles?.includes('freelancer') || item.freelancerAlways
              );
              if (!freelancerBypass) {
                if (item.module && !permissionSet.has(item.module)) return false;
              }
            } else if (!item.roles.includes(userRole)) {
              return false;
            }
            if (item.anyIntegration) return planHasAnyIntegration(orgPlan);
            if (item.anyAi) return planHasAnyAiFeature(orgPlan);
            if (item.feature) {
              const freelancerBypassFeature = userRole === 'freelancer' && (
                item.onlyRoles?.includes('freelancer') || item.freelancerAlways
              );
              if (!freelancerBypassFeature) return planHasFeature(orgPlan, item.feature);
            }
            return true;
          }
        )
      }))
      .filter((section) => section.items.length > 0)
  ), [userRole, orgPlan, usePermissionPack, permissionSet, authUser?.isPlatformOperator]);

  const pathToGroup = useMemo(() => {
    const map = {};
    visibleSections.forEach((s) => s.items.forEach((item) => { map[item.path] = s.key; }));
    return map;
  }, [visibleSections]);

  const [openGroups, setOpenGroups] = useState(() => {
    const initial = new Set(['main', 'recruitment', 'lists', 'communication']);
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

  useEffect(() => {
    if (!collapsed) setFlyoutGroupKey(null);
  }, [collapsed]);

  useEffect(() => {
    if (!flyoutGroupKey) return undefined;
    const handleClose = (e) => {
      const el = document.getElementById('sidebar-flyout');
      if (el?.contains(e.target)) return;
      const btn = flyoutBtnRefs.current[flyoutGroupKey];
      if (btn?.contains(e.target)) return;
      setFlyoutGroupKey(null);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setFlyoutGroupKey(null); };
    document.addEventListener('mousedown', handleClose);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClose);
      document.removeEventListener('keydown', handleKey);
    };
  }, [flyoutGroupKey]);

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

  const handleCollapsedGroupClick = (key) => {
    const btn = flyoutBtnRefs.current[key];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const vh = window.innerHeight;
      const gap = 8;
      const group = visibleSections.find((g) => g.key === key);
      const itemCount = group?.items.length ?? 4;
      const contentH = itemCount * 44 + 56;
      const maxH = Math.min(contentH, vh - gap * 2);
      const spaceBelow = vh - rect.top - gap;
      const top = spaceBelow >= maxH
        ? rect.top
        : Math.max(gap, vh - maxH - gap);
      setFlyoutPos({ top, left: rect.right + 6, maxH });
    }
    setFlyoutGroupKey((prev) => (prev === key ? null : key));
  };

  const isGroupActive = (items) => items.some((it) => location.pathname === it.path || location.pathname.startsWith(`${it.path}/`));

  const flyoutSection = flyoutGroupKey
    ? visibleSections.find((s) => s.key === flyoutGroupKey)
    : null;

  const newJobsCount = useJobNavUpdates();
  const newAnnouncementsCount = useAnnouncementNavUpdates();
  const newReportSharesCount = useReportShareNavUpdates();
  const newSupportCount = useSupportNavUpdates();
  const navBadges = useMemo(() => {
    const badges = {};
    if (newJobsCount > 0) {
      badges['/jobs'] = newJobsCount;
      badges['/mandates'] = newJobsCount;
    }
    if (newAnnouncementsCount > 0) badges['/announcements'] = newAnnouncementsCount;
    if (newReportSharesCount > 0) badges['/analytics'] = newReportSharesCount;
    if (newSupportCount > 0) badges['/feedback'] = newSupportCount;
    return badges;
  }, [newJobsCount, newAnnouncementsCount, newReportSharesCount, newSupportCount]);

  useEffect(() => {
    const keys = visibleSections
      .filter((section) => section.items.some((item) => (navBadges[item.path] || 0) > 0))
      .map((section) => section.key);
    if (!keys.length) return;
    setOpenGroups((prev) => {
      const next = new Set(prev);
      let changed = false;
      keys.forEach((key) => {
        if (!next.has(key)) {
          next.add(key);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [navBadges, visibleSections]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={handleCloseMobile}
          aria-hidden
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
          <NavLink
            to="/dashboard"
            onClick={(e) => {
              handleCloseMobile();
              if (flushNavAwayFromAts) {
                e.preventDefault();
                navigate('/dashboard', { flushSync: true });
              }
            }}
            className={`flex items-center gap-3 min-w-0 flex-1 ${collapsed ? 'justify-center' : ''}`}
          >
            {organization?.logo ? (
              <img src={resolveOrgLogoSrc(organization.logo)} alt="" className="w-9 h-9 rounded-xl object-contain bg-white flex-shrink-0 shadow-lg" />
            ) : (
              <img
                src="/logo.png"
                alt="People Connect HR"
                className="w-9 h-9 rounded-xl object-cover flex-shrink-0 shadow-lg shadow-teal-500/25 ring-1 ring-teal-400/20"
              />
            )}
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-bold text-stone-100 text-sm leading-tight truncate">{organization?.name || 'People Connect HR'}</p>
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
          <SidebarNav
            collapsed={collapsed}
            visibleSections={visibleSections}
            openGroups={openGroups}
            flyoutGroupKey={flyoutGroupKey}
            locationPathname={location.pathname}
            flyoutBtnRefs={flyoutBtnRefs}
            onCollapsedGroupClick={handleCollapsedGroupClick}
            onToggleGroup={toggleGroup}
            onCloseMobile={handleCloseMobile}
            isGroupActive={isGroupActive}
            navBadges={navBadges}
            flushNavAwayFromAts={flushNavAwayFromAts}
          />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-stone-950/70 to-transparent" />
        </div>

        <SidebarUserFooter
          collapsed={collapsed}
          photo={authUser?.profilePicture || ''}
          userName={authUser?.name || 'User'}
          userEmail={authUser?.email || ''}
          userRole={userRole}
          onLogoutClick={() => setShowLogoutConfirm(true)}
        />
      </aside>

      <ConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logout();
        }}
        title="Log out?"
        message="End your session on this device? You’ll need to sign in again to continue."
        confirmText="Log out"
        type="danger"
      />

      <SidebarFlyout
        collapsed={collapsed}
        flyoutSection={flyoutSection}
        flyoutPos={flyoutPos}
        locationPathname={location.pathname}
        onCloseMobile={handleCloseMobile}
        onCloseFlyout={() => setFlyoutGroupKey(null)}
        navBadges={navBadges}
        flushNavAwayFromAts={flushNavAwayFromAts}
      />
    </>
  );
};

export default Sidebar;
