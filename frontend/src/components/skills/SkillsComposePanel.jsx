import React from 'react';
import { Plus, Loader2 } from 'lucide-react';

export default function SkillsComposePanel({
  newName,
  setNewName,
  newCategory,
  setNewCategory,
  categories,
  creating,
  editing,
  onSubmit,
}) {
  return (
    <form
      data-tour="skills-compose"
      onSubmit={onSubmit}
      className="lg:col-span-4 card-ats-bordered p-5 sm:p-6 relative overflow-hidden space-y-4 h-fit lg:sticky lg:top-4 min-w-0"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative min-w-0">
        <h2 className="text-base font-bold text-stone-900 tracking-tight">Add custom skill</h2>
        <p className="text-[11px] text-stone-400 mt-0.5">
          Org-specific skills sit alongside the system catalog.
        </p>
      </div>

      <div className="relative">
        <label className="label-ats" htmlFor="skill-name">Skill name *</label>
        <input
          id="skill-name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="input-ats"
          placeholder="e.g. GraphQL Federation"
          required
          disabled={!!editing}
        />
      </div>
      <div className="relative">
        <label className="label-ats" htmlFor="skill-category">Category</label>
        <input
          id="skill-category"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="input-ats"
          placeholder="Custom"
          list="skill-categories"
          disabled={!!editing}
        />
        <datalist id="skill-categories">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>

      <button
        type="submit"
        disabled={creating || !newName.trim() || !!editing}
        className="btn-primary w-full relative"
      >
        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Add skill
      </button>

      <p className="text-[11px] text-stone-500 leading-relaxed relative">
        Tip: attach skills to candidates and jobs, then use match scoring when shortlisting.
      </p>
    </form>
  );
}
