import React from 'react';
import { Mail, Plus, Edit3, Trash2, Eye, Copy, Search } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import PremiumSelect from '../ui/PremiumSelect';
import { stripHtml } from '../ui/EmailBodyEditor';
import {
  CATEGORY_META,
  FILTER_OPTIONS,
  VARIABLE_OPTIONS,
} from './emailTemplatesConstants';

export default function EmailTemplateList({
  filtered,
  searchTerm,
  setSearchTerm,
  filterCategory,
  setFilterCategory,
  onCreate,
  onPreview,
  onEdit,
  onDuplicate,
  onDelete,
}) {
  return (
    <>
      <div data-tour="tpl-filters" className="card-ats-bordered relative overflow-hidden p-3 sm:p-4">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="relative flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              type="search"
              placeholder="Search by name or subject…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-ats !pl-10 w-full"
              aria-label="Search templates"
            />
          </div>
          <div className="w-full sm:w-56 shrink-0">
            <PremiumSelect
              value={filterCategory}
              onChange={(v) => setFilterCategory(v || 'all')}
              options={FILTER_OPTIONS}
              placeholder="Category"
              compact
            />
          </div>
        </div>
      </div>

      <div data-tour="tpl-catalog">
        {filtered.length === 0 ? (
          <div className="card-ats-bordered relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <EmptyState
              icon={Mail}
              tone="emerald"
              message="No templates found"
              subMessage={searchTerm || filterCategory !== 'all' ? 'Try a different search or category.' : 'Create your first email template to get started.'}
              action={
                <button type="button" onClick={onCreate} className="btn-primary">
                  <Plus size={14} /> Create template
                </button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((t) => {
              const meta = CATEGORY_META[t.category] || CATEGORY_META.custom;
              const Icon = meta.icon;
              return (
                <div
                  key={t._id}
                  className="card-ats-bordered hover:border-brand-200/80 flex flex-col relative overflow-hidden transition-colors"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                  <div className="p-4 pb-3 flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0 border border-white/60`}>
                      <Icon size={16} className={meta.text} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="text-sm font-bold text-stone-900 truncate tracking-tight">{t.name}</h3>
                        {t.isDefault && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded border border-stone-200">DEFAULT</span>
                        )}
                      </div>
                      <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md border ${meta.badge}`}>
                        {meta.label}
                      </span>
                      <p className="text-[11px] text-stone-500 truncate mt-1.5">{t.subject}</p>
                    </div>
                  </div>

                  <div className="px-4 pb-3 flex-1">
                    <div className="bg-stone-50 rounded-xl p-3 border border-stone-100 min-h-[5rem]">
                      <p className="text-[11px] text-stone-500 line-clamp-4 leading-relaxed whitespace-pre-line">
                        {(() => {
                          const plain = stripHtml(t.body || '');
                          return plain.substring(0, 200) + (plain.length > 200 ? '…' : '');
                        })()}
                      </p>
                    </div>
                  </div>

                  {t.variables?.length > 0 && (
                    <div className="px-4 pb-3">
                      <div className="flex flex-wrap gap-1">
                        {t.variables.slice(0, 4).map((v) => {
                          const opt = VARIABLE_OPTIONS.find((o) => o.key === v);
                          return (
                            <span key={v} className="text-[10px] font-semibold px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded-md border border-brand-100">
                              {opt?.label || v}
                            </span>
                          );
                        })}
                        {t.variables.length > 4 && (
                          <span className="text-[10px] text-stone-400 font-medium">+{t.variables.length - 4}</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="px-4 py-3 border-t border-stone-100 flex items-center gap-1 flex-wrap">
                    <button type="button" onClick={() => onPreview(t)} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-all">
                      <Eye size={12} /> Preview
                    </button>
                    <button type="button" onClick={() => onEdit(t)} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
                      <Edit3 size={12} /> Edit
                    </button>
                    <button type="button" onClick={() => onDuplicate(t)} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-stone-600 hover:bg-stone-100 rounded-lg transition-all">
                      <Copy size={12} /> Duplicate
                    </button>
                    {!t.isDefault && (
                      <button
                        type="button"
                        onClick={() => onDelete(t)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all ml-auto"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
