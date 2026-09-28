import React, { useEffect, useState } from 'react';
import { Eye, Pencil, Copy, Check, Briefcase, GitPullRequest, Sparkles } from 'lucide-react';
import Modal from '../ui/Modal';
import JobJdPreview from './JobJdPreview';
import { jobFromRecord } from './jobsConstants';
import JobApplicantCounts from './JobApplicantCounts';
import TalentMatchDesk from '../talentMatch/TalentMatchDesk';
import ConfirmationModal from '../ConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import { canAccessMis } from '../../utils/misAccess';

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
  onViewPipeline,
  allowCopyJobId = false,
  onCopiedJobId,
  startOnTalent = false,
}) {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState(() => (startOnTalent === false ? 'requisition' : 'talent'));
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [talentHasResults, setTalentHasResults] = useState(false);
  const [talentEverOpened, setTalentEverOpened] = useState(() => startOnTalent !== false);
  const { user } = useAuth();

  useEffect(() => {
    setTab(startOnTalent === false ? 'requisition' : 'talent');
    setTalentHasResults(false);
    setTalentEverOpened(startOnTalent !== false);
    setCloseConfirmOpen(false);
  }, [job?._id, startOnTalent]);

  if (!open || !job) return null;

  const form = jobFromRecord(job);
  const status = job.status || 'Open';
  const title = job.role || job.title || 'Untitled role';
  const hiringManager = job.mandateSpoc || job.hiringManager;
  const hiringLabel = personLabel(hiringManager);
  const jobCode = String(job.jobCode || form.jobCode || '').trim();
  const pipelineEntries = Object.entries(job.pipeline || {})
    .filter(([, n]) => Number(n) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  const talentOpen = tab === 'talent';

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

  const handleTabChange = (nextTab) => {
    if (nextTab === 'talent') setTalentEverOpened(true);
    setTab(nextTab);
  };

  const handleClose = () => {
    if (talentHasResults) {
      setCloseConfirmOpen(true);
      return;
    }
    onClose?.();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Job requisition"
        description={[jobCode, title].filter(Boolean).join(' · ')}
        size="workbench"
        fillHeight
        icon={Eye}
        closeOnBackdrop={false}
        bodyClassName={
          talentOpen
            ? 'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0 bg-white'
            : 'flex-1 min-h-0 min-w-0 overflow-y-auto p-0 bg-white'
        }
        footer={talentOpen ? null : (
          <>
            <button type="button" onClick={handleClose} className="btn-secondary">Close</button>
            {onViewPipeline && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onViewPipeline(job)}
              >
                <GitPullRequest size={15} /> View candidates
              </button>
            )}
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
        <div className={`flex min-h-0 ${talentOpen ? 'h-full flex-1' : ''} flex-col overflow-hidden`}>
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-stone-200 bg-white px-4 py-2 sm:px-5">
            <nav className="flex items-center gap-0" aria-label="Requisition sections">
              {[
                { id: 'requisition', label: 'Requisition', icon: Briefcase },
                { id: 'talent', label: 'Suggested talent', icon: Sparkles },
              ].map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTabChange(item.id)}
                    className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors ${
                      active
                        ? 'border-teal-600 text-stone-900'
                        : 'border-transparent text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <Icon size={14} className={active ? 'text-teal-600' : 'text-stone-400'} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
              {allowCopyJobId && jobCode ? (
                <div className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-stone-200 bg-stone-50 pl-2 pr-0.5 py-0.5 text-stone-800">
                  <Briefcase size={11} className="shrink-0 text-stone-500" strokeWidth={2.25} />
                  <span
                    title={`Job ID ${jobCode}`}
                    className="min-w-0 truncate font-mono text-[10px] font-semibold tabular-nums tracking-wide"
                  >
                    {jobCode}
                  </span>
                  <button
                    type="button"
                    onClick={copyJobId}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-stone-500 hover:bg-stone-200 hover:text-stone-900"
                    title={copied ? 'Copied' : 'Copy Job ID'}
                    aria-label={copied ? 'Job ID copied' : `Copy Job ID ${jobCode}`}
                  >
                    {copied
                      ? <Check size={11} strokeWidth={2.75} className="text-emerald-600" />
                      : <Copy size={11} strokeWidth={2.25} />}
                  </button>
                </div>
              ) : null}

              <JobApplicantCounts
                job={job}
                compact
                onOpen={onViewPipeline ? (j, kind) => onViewPipeline(j, kind) : undefined}
              />

              {!talentOpen
                ? pipelineEntries.slice(0, 3).map(([stage, count]) => (
                  <span
                    key={stage}
                    className="inline-flex items-center gap-1 rounded border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-semibold text-stone-600"
                  >
                    {stage}
                    <span className="tabular-nums text-stone-800">{count}</span>
                  </span>
                ))
                : null}

              {onViewPipeline ? (
                <button
                  type="button"
                  onClick={() => onViewPipeline(job)}
                  className="text-[12px] font-semibold text-teal-700 hover:text-teal-900"
                >
                  Open candidates
                </button>
              ) : null}
            </div>
          </div>

          {/* Keep Suggested talent mounted so matches survive tab switches */}
          {talentEverOpened ? (
            <div className={`min-h-0 flex-1 flex-col overflow-hidden ${talentOpen ? 'flex' : 'hidden'}`}>
              <TalentMatchDesk
                fixedJob={job}
                embedded
                initialSource={canAccessMis(user) ? 'all' : 'candidates'}
                sources={canAccessMis(user) ? ['candidates', 'mis'] : ['candidates']}
                onResultsChange={(count) => setTalentHasResults(Number(count) > 0)}
              />
            </div>
          ) : null}

          {!talentOpen ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <JobJdPreview
                form={form}
                heading="Requisition"
                status={status}
                openings={job.openings}
                hiringManager={hiringLabel}
                embedded
              />
            </div>
          ) : null}
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={closeConfirmOpen}
        onClose={() => setCloseConfirmOpen(false)}
        type="warning"
        title="Close this requisition?"
        message="Suggested talent matches will be cleared when you close. Re-running the match on a large directory can take a minute."
        confirmText="Close anyway"
        onConfirm={() => {
          setCloseConfirmOpen(false);
          onClose?.();
        }}
      />
    </>
  );
}
