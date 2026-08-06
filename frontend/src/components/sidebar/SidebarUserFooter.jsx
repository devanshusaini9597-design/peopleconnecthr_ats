import React from 'react';
import { LogOut } from 'lucide-react';
import { ROLE_BADGE } from './sidebarConstants';

export default function SidebarUserFooter({
  collapsed,
  initials,
  userName,
  userRole,
  onLogoutClick,
}) {
  return (
    <div className="relative border-t border-stone-800/40 p-3 pb-4 flex-shrink-0 z-10 bg-stone-950">
      <div className={`flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-stone-800/40 transition-colors min-w-0 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-lg shadow-teal-500/20 select-none">
          {initials}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-sm font-semibold text-stone-200 truncate leading-tight">{userName || 'User'}</p>
              <span className={`inline-flex items-center mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border max-w-full truncate ${ROLE_BADGE[userRole] || ROLE_BADGE.readonly}`}>
                {userRole}
              </span>
            </div>
            <button
              type="button"
              onClick={onLogoutClick}
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
          type="button"
          onClick={onLogoutClick}
          className="w-full mt-1 p-2 rounded-xl flex items-center justify-center hover:bg-red-500/15 text-stone-600 hover:text-red-400 transition-colors"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
