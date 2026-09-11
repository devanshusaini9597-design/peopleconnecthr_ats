import React, { useState } from 'react';
import { Eye, Pencil, Copy, Check } from 'lucide-react';
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
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 bg-teal-50/50 px-6 sm:px-8 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-teal-700/80">Job ID</p>
            <p className="mt-0.5 font-mono text-[13px] font-semibold tabular-nums tracking-wide text-teal-900 truncate">
              {jobCode}
            </p>
          </div>
          <button
            type="button"
            onClick={copyJobId}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-teal-200 bg-white text-teal-800 shadow-sm transition-colors hover:bg-teal-50"
            title={copied ? 'Copied' : `Copy Job ID ${jobCode}`}
            aria-label={copied ? 'Job ID copied' : `Copy Job ID ${jobCode}`}
          >
            {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
          </button>
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
