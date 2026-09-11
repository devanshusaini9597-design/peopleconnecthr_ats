import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { GROUP_STYLES } from './sidebarConstants';

function unreadLabel(count) {
  if (count === 1) return '1 new';
  if (count > 9) return '9+ new';
  return `${count} new`;
}

function UpdateBadge({ count, ping = false }) {
  if (!count) return null;
  return (
    <span className="ml-auto flex-shrink-0 relative inline-flex items-center">
      {ping ? (
        <span className="absolute inset-0 rounded-full bg-rose-400/80 animate-ping" aria-hidden />
      ) : null}
      <span className="relative inline-flex items-center h-[18px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold tracking-wide shadow-sm shadow-rose-500/40">
        {unreadLabel(count)}
      </span>
    </span>
  );
}

export default function SidebarNav({
  collapsed,
  visibleSections,
  openGroups,
  flyoutGroupKey,
  locationPathname,
  flyoutBtnRefs,
  onCollapsedGroupClick,
  onToggleGroup,
  onCloseMobile,
  isGroupActive,
  navBadges = {},
  /** Freelancer leaving Candidates: flushSync SPA nav (not full reload) */
  flushNavAwayFromAts = false,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleNavClick = (e, path) => {
    onCloseMobile?.();
    if (flushNavAwayFromAts && path && path !== '/ats') {
      e.preventDefault();
      navigate(path, { flushSync: true });
    }
  };

  return (
    <nav className={`h-full py-4 px-3 space-y-1 overflow-y-auto ${collapsed ? 'scrollbar-hide' : 'sidebar-nav-scrollbar'}`}>
      {visibleSections.map((section) => {
        const GroupIcon = section.icon;
        const gc = GROUP_STYLES[section.key] || GROUP_STYLES.main;
        const isOpenGroup = openGroups.has(section.key);
        const hasActive = isGroupActive(section.items);
        const sectionTitle = t(section.titleKey || `nav.sections.${section.key}`, { defaultValue: section.title });
        const groupNewCount = section.items.reduce((sum, item) => sum + (navBadges[item.path] || 0), 0);

        if (collapsed) {
          return (
            <div key={section.key}>
              <button
                ref={(el) => { flyoutBtnRefs.current[section.key] = el; }}
                type="button"
                title={sectionTitle}
                onClick={() => onCollapsedGroupClick(section.key)}
                className={`relative flex items-center justify-center w-full py-2.5 rounded-xl transition-all duration-200 ${
                  hasActive || flyoutGroupKey === section.key ? gc.activeBg : 'hover:bg-stone-800/50'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  hasActive || flyoutGroupKey === section.key ? gc.iconBg : 'bg-stone-800/50'
                }`}>
                  <GroupIcon className={`w-4 h-4 ${hasActive || flyoutGroupKey === section.key ? gc.iconColor : 'text-stone-500'}`} />
                </div>
                {groupNewCount > 0 ? (
                  <span className="absolute top-1 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[9px] font-bold text-white leading-none flex items-center justify-center shadow-sm">
                    {groupNewCount > 9 ? '9+' : groupNewCount}
                  </span>
                ) : hasActive ? (
                  <span className={`absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full ${gc.activeBar}`} />
                ) : null}
              </button>
            </div>
          );
        }

        return (
          <div key={section.key}>
            <button
              type="button"
              onClick={() => onToggleGroup(section.key)}
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
                <span className="truncate text-sm">{sectionTitle}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {groupNewCount > 0 ? (
                  <span className="relative inline-flex items-center h-[18px] px-1.5 rounded-full bg-rose-500 text-[10px] font-bold text-white leading-none">
                    {unreadLabel(groupNewCount)}
                  </span>
                ) : null}
                <ChevronRight className={`w-3.5 h-3.5 text-stone-600 transition-transform duration-200 ${isOpenGroup ? 'rotate-90' : ''}`} />
              </div>
            </button>

            <div className={`overflow-hidden transition-all duration-200 ${isOpenGroup ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="mt-0.5 ml-3 pl-3 pb-1 space-y-0.5 border-l border-stone-800">
                {section.items.map((item) => {
                  const ItemIcon = item.icon;
                  const active = locationPathname === item.path;
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
                        onClick={(e) => {
                          e.preventDefault();
                        }}
                        className="relative flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium text-stone-600 opacity-70 cursor-not-allowed"
                      >
                        <ItemIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate flex-1 min-w-0 text-left">{itemLabel}</span>
                        <span className="ml-auto flex-shrink-0 inline-flex items-center h-[18px] px-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-[9px] font-bold uppercase tracking-wide text-amber-300/90">
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
                      className={`relative flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        active
                          ? `bg-white/5 ${gc.activeText}`
                          : 'text-stone-500 hover:bg-stone-800/40 hover:text-stone-200'
                      }`}
                    >
                      {active && (
                        <div className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full ${gc.activeBar}`} />
                      )}
                      <ItemIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate flex-1 min-w-0">{itemLabel}</span>
                      <UpdateBadge count={itemCount} ping={itemCount > 0 && !active} />
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
  );
}
