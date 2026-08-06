import React from 'react';
import { Plus, Edit, Trash2, Search, ArrowUpDown, Users2, Link2, Loader2 } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import PremiumSelect from '../ui/PremiumSelect';
import { SORT_OPTIONS } from './masterDataConstants';

export default function MasterDataCatalog({
  cfg,
  Icon,
  query,
  setQuery,
  sortKey,
  setSortKey,
  loading,
  visible,
  hasClientSharing,
  hasClientPortal,
  seeding,
  onSeed,
  onCreate,
  onEdit,
  onDelete,
  onShare,
  onPortal,
}) {
  return (
    <div className="card-ats-bordered relative overflow-hidden" data-tour="list-table">
      <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row gap-3 sm:items-center" data-tour="list-toolbar">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${cfg.headline.toLowerCase()}…`}
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white text-sm font-medium outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all"
          />
        </div>
        <div className="w-full sm:w-48 flex-shrink-0">
          <PremiumSelect
            compact
            value={sortKey}
            onChange={setSortKey}
            options={SORT_OPTIONS}
            icon={ArrowUpDown}
            placeholder="Sort"
          />
        </div>
        <p className="text-xs text-stone-500 sm:ml-auto whitespace-nowrap">
          {loading ? '…' : `${visible.length.toLocaleString()} ${visible.length === 1 ? 'entry' : 'entries'}`}
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-7 h-7 text-brand-600 animate-spin" />
          <p className="text-sm text-stone-500">Loading catalog…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="py-6">
          <EmptyState
            icon={query ? Search : Icon}
            tone={query ? 'amber' : 'brand'}
            message={query ? 'No matches' : `No ${cfg.headline.toLowerCase()} yet`}
            subMessage={query ? 'Try a different search.' : `Add your first ${cfg.singular} — it will appear in Add Candidate.`}
          />
          {!query && (
            <div className="flex flex-wrap justify-center gap-2 pb-8 -mt-2">
              {cfg.seedable && (
                <button type="button" onClick={onSeed} disabled={seeding} className="btn-secondary disabled:opacity-50">
                  {seeding ? 'Loading…' : 'Load starter set'}
                </button>
              )}
              <button type="button" onClick={onCreate} className="btn-primary">
                <Plus size={16} /> Add {cfg.singular}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-stone-100/90">
                <th className="px-4 sm:px-5 py-3 text-[10px] font-bold text-stone-600 uppercase tracking-wider">Name</th>
                <th className="px-4 sm:px-5 py-3 text-[10px] font-bold text-stone-600 uppercase tracking-wider">Description</th>
                <th className="px-4 sm:px-5 py-3 text-[10px] font-bold text-stone-600 uppercase tracking-wider w-28">Status</th>
                <th className="px-4 sm:px-5 py-3 text-[10px] font-bold text-stone-600 uppercase tracking-wider w-36 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item._id} className="border-t border-stone-100 hover:bg-stone-50/70 transition-colors">
                  <td className="px-4 sm:px-5 py-3.5 text-sm font-semibold text-stone-900">{item.name}</td>
                  <td className="px-4 sm:px-5 py-3.5 text-sm text-stone-600 max-w-md truncate">{item.description || '—'}</td>
                  <td className="px-4 sm:px-5 py-3.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                      item.isActive !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {item.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 sm:px-5 py-3.5">
                    <div className="flex items-center justify-end gap-0.5">
                      <button type="button" onClick={() => onEdit(item)} className="p-2 rounded-lg text-brand-600 hover:bg-brand-50" title="Edit">
                        <Edit size={15} />
                      </button>
                      <button type="button" onClick={() => onDelete(item)} className="p-2 rounded-lg text-red-600 hover:bg-red-50" title="Delete">
                        <Trash2 size={15} />
                      </button>
                      {hasClientSharing && (
                        <button
                          type="button"
                          onClick={() => onShare(item)}
                          className={`p-2 rounded-lg ${(item.restrictedToUsers || []).length > 0 ? 'text-amber-600 hover:bg-amber-50' : 'text-stone-400 hover:bg-stone-100'}`}
                          title="Sharing"
                        >
                          <Users2 size={15} />
                        </button>
                      )}
                      {hasClientPortal && (
                        <button
                          type="button"
                          onClick={() => onPortal(item)}
                          className={`p-2 rounded-lg ${item.portal?.enabled ? 'text-brand-600 hover:bg-brand-50' : 'text-stone-400 hover:bg-stone-100'}`}
                          title="Client portal"
                        >
                          <Link2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
