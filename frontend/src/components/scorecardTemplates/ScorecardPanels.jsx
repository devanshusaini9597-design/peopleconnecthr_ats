import React from 'react';
import { Plus, Loader2, Trash2, Pencil, Layers, Scale, Award } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import { WEIGHT_OPTIONS, emptyCriterion } from './scorecardConstants';

export function ScorecardCatalog({
  loading, catalogMeta, rows, openCreate, openEdit, setDeleteTarget,
}) {
  return (
    <div data-tour="sc-catalog" className="card-ats-bordered relative overflow-hidden min-h-[32rem] flex flex-col">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative px-4 sm:px-5 pt-4 pb-3 border-b border-stone-100 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Template library</h2>
          <p className="text-[11px] text-stone-400 mt-0.5">{catalogMeta}</p>
        </div>
        <span className="badge-neutral text-[10px] flex-shrink-0 inline-flex items-center gap-1">
          <Layers className="w-3 h-3" /> Catalog
        </span>
      </div>

      <div className="relative flex-1 p-3.5 sm:p-5 bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_40%)]">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 skeleton-ats rounded-2xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="h-full min-h-[20rem] flex items-center justify-center">
            <EmptyState
              icon={Award}
              tone="brand"
              message="No templates yet"
              subMessage="Create structured scorecards for consistent hiring."
              action={(
                <button type="button" className="btn-primary" onClick={openCreate}>
                  <Plus className="w-4 h-4" /> Create template
                </button>
              )}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map((t) => {
              const criteria = t.criteria || [];
              return (
                <article
                  key={t._id}
                  className="rounded-2xl border border-stone-200/80 bg-white p-4 flex flex-col shadow-[0_1px_0_rgba(28,25,23,0.03)] hover:border-stone-300/90 transition-colors min-w-0"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-stone-900 tracking-tight truncate">
                        {t.name}
                      </h3>
                      <p className="text-[11px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                        {t.description || 'No description'}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="p-2 rounded-xl text-stone-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        aria-label="Edit template"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(t)}
                        className="p-2 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        aria-label="Delete template"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="badge-brand text-[10px]">
                      {criteria.length} criterion{criteria.length === 1 ? '' : 'a'}
                    </span>
                    <span className="badge-neutral text-[10px] inline-flex items-center gap-1">
                      <Scale className="w-3 h-3" />
                      Weight sum {criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0)}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 flex-1">
                    {criteria.slice(0, 4).map((c, i) => (
                      <div
                        key={i}
                        className="text-[11px] rounded-xl bg-stone-50/90 border border-stone-100 px-2.5 py-2 flex justify-between gap-2 min-w-0"
                      >
                        <span className="text-stone-700 font-medium truncate min-w-0">{c.name}</span>
                        <span className="text-brand-700 font-bold flex-shrink-0 tabular-nums">×{c.weight}</span>
                      </div>
                    ))}
                    {criteria.length > 4 && (
                      <p className="text-[10px] text-stone-400 px-1">
                        +{criteria.length - 4} more
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function ScorecardFormModal({
  open, closeModal, editId, saving, form, setForm, save,
  updateCriterion, setCriterionDeleteIdx,
}) {
  return (
    <Modal
      open={open}
      onClose={closeModal}
      title={editId ? 'Edit scorecard template' : 'New scorecard template'}
      description="Define weighted criteria hiring managers will score."
      size="lg"
      closeOnBackdrop={!saving}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={closeModal} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form="sc-template-form"
            className="btn-primary"
            disabled={saving || !form.name.trim()}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {editId ? 'Save changes' : 'Create template'}
          </button>
        </>
      )}
    >
      <form id="sc-template-form" onSubmit={save} className="space-y-4">
        <div>
          <label className="label-ats" htmlFor="sc-name">Template name *</label>
          <input
            id="sc-name"
            className="input-ats"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Engineering panel"
          />
        </div>
        <div>
          <label className="label-ats" htmlFor="sc-desc">Description</label>
          <input
            id="sc-desc"
            className="input-ats"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="When to use this scorecard"
          />
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="font-semibold text-stone-800 text-sm">Criteria</h4>
              <p className="text-[11px] text-stone-400 mt-0.5">
                {form.criteria.length} item{form.criteria.length === 1 ? '' : 's'} · higher weight = more impact
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary !py-1.5 !text-xs"
              onClick={() => setForm({ ...form, criteria: [...form.criteria, emptyCriterion()] })}
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {form.criteria.map((c, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-3 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700">Criterion {idx + 1}</span>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                  disabled={form.criteria.length <= 1}
                  onClick={() => {
                    if (form.criteria.length <= 1) return;
                    setCriterionDeleteIdx(idx);
                  }}
                  aria-label={`Remove criterion ${idx + 1}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_8.5rem] gap-2">
                <div>
                  <label className="label-ats">Name *</label>
                  <input
                    className="input-ats"
                    value={c.name}
                    onChange={(e) => updateCriterion(idx, { name: e.target.value })}
                    placeholder="e.g. Communication"
                  />
                </div>
                <div>
                  <label className="label-ats">Weight</label>
                  <PremiumSelect
                    compact
                    icon={Scale}
                    value={String(c.weight)}
                    onChange={(v) => updateCriterion(idx, { weight: Number(v) || 1 })}
                    options={WEIGHT_OPTIONS}
                    placeholder="Weight"
                  />
                </div>
              </div>
              <div>
                <label className="label-ats">Guidance notes</label>
                <input
                  className="input-ats"
                  value={c.description || ''}
                  onChange={(e) => updateCriterion(idx, { description: e.target.value })}
                  placeholder="Optional tip for interviewers"
                />
              </div>
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}
