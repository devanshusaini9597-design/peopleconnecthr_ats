import React from 'react';
import { Briefcase, BookOpen } from 'lucide-react';

export default function JDLibraryForm({ form, setForm, onSubmit }) {
  return (
    <form id="jd-template-form" onSubmit={onSubmit} className="space-y-5">
      <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 inline-flex items-center justify-center">
            <Briefcase size={13} />
          </span>
          <div>
            <p className="text-xs font-bold text-stone-800">Template details</p>
            <p className="text-[11px] text-stone-400">Role, location, and compensation</p>
          </div>
        </div>
        <div>
          <label className="label-ats">Role / Title *</label>
          <input
            required
            type="text"
            className="input-ats field-premium"
            placeholder="e.g. Senior React Developer"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-ats">Experience</label>
            <input
              type="text"
              className="input-ats field-premium"
              placeholder="e.g. 3-5 Years"
              value={form.experience}
              onChange={(e) => setForm({ ...form, experience: e.target.value })}
            />
          </div>
          <div>
            <label className="label-ats">Location</label>
            <input
              type="text"
              className="input-ats field-premium"
              placeholder="e.g. Remote / Pune"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <div>
            <label className="label-ats">CTC / Salary</label>
            <input
              type="text"
              className="input-ats field-premium"
              placeholder="e.g. 12 - 18 LPA"
              value={form.ctc}
              onChange={(e) => setForm({ ...form, ctc: e.target.value })}
            />
          </div>
          <div>
            <label className="label-ats">Skills (comma separated)</label>
            <input
              type="text"
              className="input-ats field-premium"
              placeholder="React, Node.js, TypeScript"
              value={form.skills}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="h-7 w-7 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 inline-flex items-center justify-center">
            <BookOpen size={13} />
          </span>
          <div>
            <p className="text-xs font-bold text-stone-800">Job description</p>
            <p className="text-[11px] text-stone-400">Reusable JD body for this template</p>
          </div>
        </div>
        <textarea
          className="textarea-ats field-premium h-32"
          placeholder="Paste or write the JD template…"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </section>
    </form>
  );
}
