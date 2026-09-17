import React, { useState } from 'react';
import { Eye, Pencil, Copy, Check, Briefcase } from 'lucide-react';
import Modal from '../ui/Modal';
import JobJdPreview from './JobJdPreview';
import { jobFromRecord } from './jobsConstants';

function personLabel(person) {
  if (!person) return '';
  if (typeof person === 'string') return person;
  return person.name || person.email || '';
}

export default function JobViewModal({
  open,
  job,
  onClose,
  onEdit,
  allowCopyJobId = false,
  onCopiedJobId,
}) {
  const [copied, setCopied] = useState(false);
  if (!open || !job) return null;
  const form = jobFromRecord(job);
  const status = job.status || 'Open';
  const title = job.role || job.title || 'Untitled role';
  const hiringManager = job.mandateSpoc || job.hiringManager;
  const hiringLabel = personLabel(hiringManager);
  const jobCode = String(job.jobCode || form.jobCode || '').trim();

  const copyJobId = async () => {
    if (!jobCode) return;
    try {
      await navigator.clipboard.writeText(jobCode);
      setCopied(true);
      onCopiedJobId?.(jobCode);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Job requisition"
      description={[jobCode, title].filter(Boolean).join(' · ')}
      size="xl"
      icon={Eye}
      closeOnBackdrop={false}
      bodyClassName="flex-1 min-h-0 min-w-0 overflow-y-auto p-0 bg-white"
      footer={(
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Close</button>
          {onEdit && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => onEdit(job)}
            >
              <Pencil size={15} /> Edit
            </button>
          )}
        </>
      )}
    >
      {allowCopyJobId && jobCode ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 bg-gradient-to-r from-teal-50/80 via-white to-white px-6 sm:px-8 py-3">
          <div className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-teal-200/90 bg-teal-50/80 pl-2.5 pr-1 py-0.5 text-teal-800">
            <Briefcase size={11} className="shrink-0 text-teal-600" strokeWidth={2.25} />
            <span
              title={`Job ID ${jobCode}`}
              className="min-w-0 truncate font-mono text-[11px] font-semibold tabular-nums tracking-wide leading-none"
            >
              {jobCode}
            </span>
            <button
              type="button"
              onClick={copyJobId}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-teal-700 transition-colors hover:bg-teal-100 hover:text-teal-900"
              title={copied ? 'Copied' : 'Copy Job ID'}
              aria-label={copied ? 'Job ID copied' : `Copy Job ID ${jobCode}`}
            >
              {copied
                ? <Check size={12} strokeWidth={2.75} className="text-emerald-600" />
                : <Copy size={12} strokeWidth={2.25} />}
            </button>
          </div>
          <p className="text-[11px] text-stone-400 font-medium">Copy to share with your team</p>
        </div>
      ) : null}
      <JobJdPreview
        form={form}
        heading="Requisition"
        status={status}
        openings={job.openings}
        hiringManager={hiringLabel}
        embedded
      />
    </Modal>
  );
}
