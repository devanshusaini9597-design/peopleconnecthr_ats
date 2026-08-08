import React from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GROUP_STYLES } from './sidebarConstants';

export default function SidebarFlyout({
  collapsed,
  flyoutSection,
  flyoutPos,
  locationPathname,
  onCloseMobile,
  onCloseFlyout,
}) {
  const { t } = useTranslation();
  if (typeof document === 'undefined' || !collapsed || !flyoutSection) return null;

  const FGIcon = flyoutSection.icon;
  const gc = GROUP_STYLES[flyoutSection.key] || GROUP_STYLES.main;
  const sectionTitle = t(flyoutSection.titleKey || `nav.sections.${flyoutSection.key}`, {
    defaultValue: flyoutSection.title,
  });

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
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end
              onClick={() => {
                onCloseMobile();
                onCloseFlyout();
              }}
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
              {active && <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />}
            </NavLink>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
