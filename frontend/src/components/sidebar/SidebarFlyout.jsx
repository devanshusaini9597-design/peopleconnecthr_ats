import React from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GROUP_STYLES } from './sidebarConstants';

export default function SidebarFlyout({
  collapsed,
  flyoutSection,
  flyoutPos,
  locationPathname,
  onCloseMobile,
  onCloseFlyout,
  navBadges = {},
  flushNavAwayFromAts = false,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (typeof document === 'undefined' || !collapsed || !flyoutSection) return null;

  const FGIcon = flyoutSection.icon;
  const gc = GROUP_STYLES[flyoutSection.key] || GROUP_STYLES.main;
  const sectionTitle = t(flyoutSection.titleKey || `nav.sections.${flyoutSection.key}`, {
    defaultValue: flyoutSection.title,
  });

  const handleNavClick = (e, path) => {
    onCloseMobile();
    onCloseFlyout();
    if (flushNavAwayFromAts && path && path !== '/ats') {
      e.preventDefault();
      navigate(path, { flushSync: true });
    }
  };

  return createPortal(
    <div
      id="sidebar-flyout"
      style={{ top: flyoutPos.top, left: flyoutPos.left, position: 'fixed', maxHeight: flyoutPos.maxH }}
      className="py-1.5 min-w-[220px] overflow-y-auto rounded-xl bg-stone-900 border border-stone-700/80 shadow-2xl z-[200] sidebar-nav-scrollbar animate-fade-in"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-stone-800 bg-stone-900">
        <FGIcon className={`w-3.5 h-3.5 flex-shrink-0 ${gc.iconColor}`} />
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{sectionTitle}</p>
      </div>
      <div className="py-1">
        {flyoutSection.items.map((item) => {
          const ItemIcon = item.icon;
          const active = locationPathname === item.path || locationPathname.startsWith(`${item.path}/`);
          const itemLabel = t(item.labelKey || item.label, { defaultValue: item.label });
          const itemCount = navBadges[item.path] || 0;
          const comingSoon = Boolean(item.comingSoon || item.disabled);

          if (comingSoon) {
            return (
              <button
                key={item.path}
                type="button"
                title="Credits — coming soon"
                aria-label={`${itemLabel} — coming soon`}
                onClick={(e) => e.preventDefault()}
                className="flex items-center gap-3 mx-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-500 opacity-70 cursor-not-allowed w-[calc(100%-0.75rem)]"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-stone-800 text-stone-500">
                  <ItemIcon className="w-3.5 h-3.5" />
                </div>
                <span className="flex-1 min-w-0 truncate text-left">{itemLabel}</span>
                <span className="flex-shrink-0 inline-flex items-center h-[18px] px-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-[9px] font-bold uppercase tracking-wide text-amber-300/90">
                  Coming soon
                </span>
              </button>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end
              onClick={(e) => handleNavClick(e, item.path)}
              className={`flex items-center gap-3 mx-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                active ? 'text-brand-300 bg-brand-500/15' : 'text-stone-300 hover:bg-stone-800 hover:text-white'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                active ? 'bg-brand-500/25 text-brand-300' : 'bg-stone-800 text-stone-400'
              }`}>
                <ItemIcon className="w-3.5 h-3.5" />
              </div>
              <span className="flex-1 min-w-0 truncate">{itemLabel}</span>
              {itemCount > 0 ? (
                <span className="flex-shrink-0 inline-flex items-center h-[18px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold tracking-wide">
                  {itemCount === 1 ? '1 new' : `${itemCount > 9 ? '9+' : itemCount} new`}
                </span>
              ) : active ? (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
              ) : null}
            </NavLink>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
