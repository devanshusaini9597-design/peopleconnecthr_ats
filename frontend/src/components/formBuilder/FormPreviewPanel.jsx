import React from 'react';
import { Eye } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import FormPreview from './FormPreview';

export default function FormPreviewPanel({ jobId, loading, title, fields, jobTitle }) {
  return (
    <div data-tour="form-preview" className="lg:col-span-4 min-w-0 flex">
      <div className="card-ats-bordered relative overflow-hidden min-h-[28rem] flex flex-col w-full lg:sticky lg:top-4 lg:self-start">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="relative px-4 sm:px-5 pt-4 pb-3 border-b border-stone-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Live preview</h2>
            <p className="text-[11px] text-stone-400 mt-0.5">Careers apply page</p>
          </div>
          <span className="badge-neutral text-[10px] flex-shrink-0 inline-flex items-center gap-1">
            <Eye className="w-3 h-3" /> Preview
          </span>
        </div>
        <div className="relative flex-1 p-3.5 sm:p-4 bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_48%)]">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 skeleton-ats rounded-xl" />)}
            </div>
          ) : !jobId ? (
            <div className="h-full min-h-[18rem] flex items-center justify-center">
              <EmptyState
                icon={Eye}
                tone="brand"
                compact
                message="No job selected"
                subMessage="Choose a job to preview its application form."
              />
            </div>
          ) : (
            <FormPreview title={title} fields={fields} jobTitle={jobTitle} />
          )}
        </div>
      </div>
    </div>
  );
}
