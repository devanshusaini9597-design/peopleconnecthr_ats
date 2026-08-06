import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Briefcase, ArrowRight } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';

export default function FormSettingsPanel({
  jobId,
  setJobId,
  title,
  setTitle,
  jobOptions,
  jobsLoading,
  jobs,
  selectedJob,
  onRemoveForm,
}) {
  return (
    <aside
      data-tour="form-settings"
      className="lg:col-span-3 card-ats-bordered p-4 sm:p-5 relative overflow-hidden flex flex-col min-w-0 lg:sticky lg:top-4 lg:self-start"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="relative min-w-0 mb-4">
        <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Form settings</h2>
        <p className="text-[11px] text-stone-400 mt-0.5">Job, title, and lifecycle</p>
      </div>

      <div className="relative space-y-3.5 flex-1">
        <div>
          <label className="label-ats">Job *</label>
          <PremiumSelect
            compact
            icon={Briefcase}
            value={jobId}
            onChange={(v) => setJobId(v || '')}
            options={jobOptions}
            placeholder={jobsLoading ? 'Loading jobs…' : jobs.length ? 'Select a job' : 'No jobs yet'}
            searchable={jobs.length > 6}
            searchPlaceholder="Search jobs…"
            disabled={jobsLoading || !jobs.length}
            emptyLabel="No jobs found"
          />
          {!jobsLoading && jobs.length === 0 && (
            <Link
              to="/jobs"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
            >
              Create a job first <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        <div>
          <label className="label-ats" htmlFor="form-title">Form title</label>
          <input
            id="form-title"
            className="input-ats"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Application Form"
            disabled={!jobId}
          />
        </div>

        {selectedJob ? (
          <div className="rounded-xl border border-stone-100 bg-stone-50/90 px-3 py-2 text-[11px] text-stone-500 leading-snug">
            Editing form for{' '}
            <span className="font-semibold text-stone-800">{selectedJob.title}</span>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50 px-3 py-2 text-[11px] text-stone-400 leading-snug">
            Select a job to load or create its application form.
          </div>
        )}
      </div>

      <div className="relative mt-5 pt-4 border-t border-stone-100 space-y-2">
        <button
          type="button"
          onClick={onRemoveForm}
          disabled={!jobId}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[12px] font-semibold text-stone-600 hover:border-red-200 hover:bg-red-50/70 hover:text-red-700 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap"
        >
          <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">Remove form</span>
        </button>
        <p className="text-[11px] text-stone-400 leading-snug">
          Reverts this job to the default apply form.
        </p>
      </div>
    </aside>
  );
}
