import React, { useState, useEffect, useMemo, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import { handleLogout } from '../utils/authUtils';
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

const Sidebar = ({ isOpen, setIsOpen }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [flyoutGroupKey, setFlyoutGroupKey] = useState(null);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0, maxH: 400 });
  const flyoutBtnRefs = useRef({});
  const navigate = useNavigate();
  const location = useLocation();
  const { organization, user: authUser } = useAuth();
  const userRole = authUser?.role || 'recruiter';
  const orgPlan = organization?.plan;
  const permissions = authUser?.permissions;
  const hasModuleKeys = Array.isArray(permissions) && permissions.some((p) => String(p).startsWith('modules.'));
  const useCustomPack = Boolean(authUser?.customRoleId) && hasModuleKeys && userRole !== 'owner';
  const permissionSet = useMemo(
    () => (useCustomPack ? new Set(permissions) : null),
    [useCustomPack, permissions]
  );

  const initials = (authUser?.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const visibleSections = useMemo(() => (
    SECTIONS
      .filter((section) => {
        if (useCustomPack) return true;
        return section.roles.includes(userRole);
      })
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => {
            if (useCustomPack) {
              if (item.module && !permissionSet.has(item.module)) return false;
            } else if (!item.roles.includes(userRole)) {
              return false;
            }
            if (item.anyIntegration) return planHasAnyIntegration(orgPlan);
            if (item.anyAi) return planHasAnyAiFeature(orgPlan);
            if (item.feature) return planHasFeature(orgPlan, item.feature);
            return true;
          }
        )
      }))
      .filter((section) => section.items.length > 0)
  ), [userRole, orgPlan, useCustomPack, permissionSet]);

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
          <NavLink to="/dashboard" onClick={handleCloseMobile} className={`flex items-center gap-3 min-w-0 flex-1 ${collapsed ? 'justify-center' : ''}`}>
            {organization?.logo ? (
              <img src={organization.logo} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0 shadow-lg" />
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
          />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-stone-950/70 to-transparent" />
        </div>

        <SidebarUserFooter
          collapsed={collapsed}
          initials={initials}
          userName={authUser?.name || 'User'}
          userRole={userRole}
          onLogoutClick={() => setShowLogoutConfirm(true)}
        />
      </aside>

      <ConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          handleLogout(navigate);
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
      />
    </>
  );
};

export default Sidebar;
