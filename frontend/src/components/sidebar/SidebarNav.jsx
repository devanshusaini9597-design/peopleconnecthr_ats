import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { GROUP_STYLES } from './sidebarConstants';

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
}) {
  return (
    <nav className={`h-full py-4 px-3 space-y-1 overflow-y-auto ${collapsed ? 'scrollbar-hide' : 'sidebar-nav-scrollbar'}`}>
      {visibleSections.map((section) => {
        const GroupIcon = section.icon;
        const gc = GROUP_STYLES[section.key] || GROUP_STYLES.main;
        const isOpenGroup = openGroups.has(section.key);
        const hasActive = isGroupActive(section.items);

        if (collapsed) {
          return (
            <div key={section.key}>
              <button
                ref={(el) => { flyoutBtnRefs.current[section.key] = el; }}
                type="button"
                title={section.title}
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
                {hasActive && (
                  <span className={`absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full ${gc.activeBar}`} />
                )}
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
                <span className="truncate text-sm">{section.title}</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 text-stone-600 transition-transform duration-200 ${isOpenGroup ? 'rotate-90' : ''}`} />
            </button>

            <div className={`overflow-hidden transition-all duration-200 ${isOpenGroup ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="mt-0.5 ml-3 pl-3 pb-1 space-y-0.5 border-l border-stone-800">
                {section.items.map((item) => {
                  const ItemIcon = item.icon;
                  const active = locationPathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end
                      onClick={onCloseMobile}
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
  );
}
