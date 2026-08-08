import React from 'react';
import {
  ShieldPlus, Plus, Trash2, Edit2, Search, LayoutGrid, Zap,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { countModules, countActions } from '../../config/permissionsCatalog';

export function RolesSearchBar({ query, setQuery }) {
  return (
    <div data-tour="roles-filters" className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="p-3 sm:p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input-ats input-ats-icon"
            placeholder="Search roles…"
            aria-label="Search roles"
          />
        </div>
      </div>
    </div>
  );
}

export function RolesGrid({
  roles,
  filteredRoles,
  openCreate,
  openEdit,
  setDeleteTarget,
}) {
  if (roles.length === 0) {
    return (
      <div className="card-ats-bordered">
        <EmptyState
          icon={ShieldPlus}
          tone="violet"
          message="No custom roles yet"
          subMessage="Create a permission pack with the sidebar modules and actions your team needs."
          action={
            <button type="button" onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" /> New Role
            </button>
          }
        />
      </div>
    );
  }

  if (filteredRoles.length === 0) {
    return (
      <div className="card-ats-bordered">
        <EmptyState
          icon={Search}
          message="No roles match"
          subMessage="Try a different search term."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 stagger-children">
      {filteredRoles.map((role) => {
        const mods = countModules(role.permissions);
        const acts = countActions(role.permissions);
        return (
          <article
            key={role._id}
            className="card-ats-bordered p-5 relative overflow-hidden group flex flex-col"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-start gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center shadow-md shadow-brand-500/20 flex-shrink-0">
                <ShieldPlus className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-stone-900 tracking-tight truncate">{role.name}</h3>
                {role.description ? (
                  <p className="text-sm text-stone-500 mt-0.5 line-clamp-2">{role.description}</p>
                ) : (
                  <p className="text-sm text-stone-400 mt-0.5 italic">No description</p>
                )}
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-stone-100">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-brand-50 text-brand-700 border-brand-100">
                  <LayoutGrid size={10} /> {mods} module{mods !== 1 ? 's' : ''}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-teal-50 text-teal-700 border-teal-100">
                  <Zap size={10} /> {acts} action{acts !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(role)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-brand-600 hover:border-brand-300"
                  title="Edit role"
                  aria-label={`Edit ${role.name}`}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(role)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 hover:text-red-600 hover:border-red-200"
                  title="Delete role"
                  aria-label={`Delete ${role.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
