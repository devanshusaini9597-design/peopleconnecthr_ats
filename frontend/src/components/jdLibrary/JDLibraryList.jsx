import React from 'react';
import {
  Search, BookOpen, Sparkles, Briefcase, Plus, Loader2, Trash2,
  BookmarkPlus, Pencil, MapPin, IndianRupee, Layers,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';

export default function JDLibraryList({
  searchTerm,
  setSearchTerm,
  tab,
  setTab,
  saved,
  loading,
  filteredTemplates,
  deletingId,
  onOpenCreate,
  onSelectTemplate,
  onOpenEdit,
  onConfirmDelete,
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-300/90 bg-white p-3.5 sm:p-4 relative overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-end">
          <div className="relative flex-1 min-w-0">
            <label className="label-ats">Search templates</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none z-[1]" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search roles, skills, industry…"
                className="input-ats input-ats-icon"
                autoFocus
              />
            </div>
          </div>
          <button type="button" onClick={onOpenCreate} className="btn-primary flex-shrink-0 w-full sm:w-auto">
            <Plus size={16} /> New template
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-stone-100">
          {[
            { id: 'all', label: 'All' },
            { id: 'saved', label: `Saved (${saved.length})` },
            { id: 'starters', label: 'Starters' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                tab === t.id
                  ? 'bg-brand-50 text-brand-800 border-brand-200'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-0.5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-stone-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-brand-600" /> Loading templates…
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="rounded-2xl border border-stone-300/90 bg-white">
            <EmptyState
              icon={tab === 'saved' ? BookOpen : Search}
              tone={tab === 'saved' ? 'brand' : 'amber'}
              compact
              message={tab === 'saved' ? 'No saved templates yet' : 'No templates match'}
              subMessage={
                tab === 'saved'
                  ? 'Create one with New template, or save an existing job as a template from the Jobs overflow menu.'
                  : 'Try a different keyword.'
              }
              action={
                tab === 'saved' ? (
                  <button type="button" onClick={onOpenCreate} className="btn-primary !py-2">
                    <Plus size={16} /> Create template
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="group relative rounded-2xl border border-stone-300/90 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-stone-400/90 hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.12)] transition-all"
            >
              <div className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-brand-500 to-teal-400 opacity-80" />
              <button
                type="button"
                onClick={() => onSelectTemplate(template)}
                className="w-full text-left p-4 pl-5 focus-ring"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-50 to-teal-50 border border-brand-100 flex items-center justify-center flex-shrink-0">
                    <Briefcase size={18} className="text-brand-700" />
                  </div>
                  <div className="min-w-0 flex-1 pr-14">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold text-stone-900 tracking-tight uppercase text-[13px] sm:text-sm">
                        {template.role}
                      </h3>
                      {template.isStarter ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-sky-200 bg-sky-50 text-sky-800">
                          <Sparkles size={10} /> Starter
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-brand-200 bg-brand-50 text-brand-800">
                          <BookmarkPlus size={10} /> Saved
                        </span>
                      )}
                      {template.industry ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-stone-200 bg-stone-50 text-stone-600">
                          <Layers size={10} /> {template.industry}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-stone-500 leading-relaxed line-clamp-2">
                      {template.description || template.summary || 'No description'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500">
                      {template.experience ? (
                        <span className="font-medium">{template.experience}</span>
                      ) : null}
                      {template.location ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <MapPin size={11} /> {template.location}
                        </span>
                      ) : null}
                      {template.ctc ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-stone-700">
                          <IndianRupee size={11} /> {template.ctc}
                        </span>
                      ) : null}
                    </div>
                    {template.skills?.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {template.skills.slice(0, 6).map((skill) => (
                          <span key={skill} className="inline-flex max-w-[10rem] truncate px-2 py-0.5 rounded-md text-[10px] font-semibold bg-brand-50 text-brand-800 border border-brand-100">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-brand-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 absolute right-4 top-4">
                    Use template
                  </span>
                </div>
              </button>

              {!template.isStarter && (
                <div className="absolute right-2 bottom-2 sm:top-2 sm:bottom-auto inline-flex items-center gap-1">
                  <button
                    type="button"
                    title="Edit template"
                    onClick={(e) => onOpenEdit(template, e)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-brand-100 bg-brand-50/80 text-brand-700 shadow-sm hover:bg-brand-100 transition-all"
                  >
                    <Pencil size={14} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    title="Delete template"
                    disabled={deletingId === template._id}
                    onClick={(e) => { e.stopPropagation(); onConfirmDelete(template); }}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-red-100 bg-red-50/70 text-red-600 shadow-sm hover:bg-red-100 transition-all disabled:opacity-50"
                  >
                    {deletingId === template._id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} strokeWidth={2} />}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
