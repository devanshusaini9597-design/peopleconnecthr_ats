import React from 'react';
import {
  Archive, ArchiveRestore, Eye, Loader2, Settings2,
} from 'lucide-react';
import Modal from '../ui/Modal';
import MoveToButton from '../applications/MoveToButton';
import DeskHandoffActions from './DeskHandoffActions';

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * Premium modal for submission operations — stage, archive, ownership, edits, audit.
 * Keeps the candidate board free of congested action stacks.
 */
export default function HandoffManageModal({
  open,
  onClose,
  row,
  stages = [],
  saving = false,
  reviewers = [],
  canHardDelete = false,
  onMove,
  onOpenAts,
  onArchive,
  onRestore,
  onReassign,
  onEditCandidate,
  onHardDelete,
}) {
  if (!row) return null;

  const candidate = row.candidateId || {};
  const job = row.jobId || {};
  const name = candidate.name || 'Candidate';
  const archived = Boolean(row.archivedAt);
  const currentStage = stages.find((s) => s.id === row.status) || stages[0];
  const mandate = job.title || job.role || 'Mandate';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage submission"
      description="Update review stage, ownership, and candidate records for this freelance handoff."
      size="md"
      icon={Settings2}
      disableFocusLock
      footer={(
        <button type="button" className="btn-secondary" onClick={onClose}>
          Done
        </button>
      )}
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-50 via-white to-brand-50/40 px-4 py-3.5 flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-[12px] font-bold shadow-sm shadow-brand-500/20 shrink-0">
            {initials(name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-stone-900 truncate" title={name}>{name}</p>
            <p className="text-[12px] text-stone-500 truncate mt-0.5">{mandate}</p>
          </div>
          {currentStage ? (
            <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border ${currentStage.chip || 'bg-stone-50 text-stone-700 border-stone-200'}`}>
              {currentStage.label}
            </span>
          ) : null}
        </div>

        {!archived ? (
          <section className="space-y-2.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Review stage</p>
              <p className="text-[12px] text-stone-500 mt-0.5">
                Advance or decline this submission. Locked stages reopen when you unlock them. The freelance recruiter sees updates live.
              </p>
            </div>
            <MoveToButton
              app={{ _id: row._id, stage: row.status }}
              stages={stages}
              onMove={async (id, status) => {
                const ok = await onMove?.(id, status);
                if (ok !== false) onClose?.();
              }}
              label="Update stage"
            />
          </section>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3 text-[12px] text-amber-950">
            This submission is archived. Restore it to resume stage updates and reviewer notes.
          </div>
        )}

        <section className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Workspace</p>
          <div className="grid grid-cols-1 gap-2">
            {candidate.name ? (
              <button
                type="button"
                onClick={() => {
                  onOpenAts?.(candidate.name);
                  onClose?.();
                }}
                className="w-full h-11 px-4 rounded-xl text-[13px] font-semibold text-stone-800 border border-stone-200 bg-white hover:border-brand-300 hover:bg-brand-50/40 transition-all inline-flex items-center justify-center gap-2"
              >
                <Eye size={15} strokeWidth={2.25} />
                Open candidate in ATS
              </button>
            ) : null}
            {archived ? (
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  const ok = await onRestore?.(row._id);
                  if (ok !== false) onClose?.();
                }}
                className="w-full h-11 px-4 rounded-xl text-[13px] font-semibold text-brand-800 border border-brand-200 bg-brand-50 hover:bg-brand-100 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <ArchiveRestore size={15} strokeWidth={2.25} />}
                Restore to active queue
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  const ok = await onArchive?.(row._id);
                  if (ok !== false) onClose?.();
                }}
                className="w-full h-11 px-4 rounded-xl text-[13px] font-medium text-stone-700 border border-stone-200 bg-white hover:bg-stone-50 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} strokeWidth={2} />}
                Archive submission
              </button>
            )}
          </div>
        </section>

        <section className="space-y-2.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Ownership & records</p>
            <p className="text-[12px] text-stone-500 mt-0.5">
              Transfer internal ownership, correct candidate data, or review the audit trail.
            </p>
          </div>
          <DeskHandoffActions
            row={row}
            saving={saving}
            reviewers={reviewers}
            canHardDelete={canHardDelete}
            onReassign={onReassign}
            onEditCandidate={onEditCandidate}
            onHardDelete={onHardDelete}
          />
        </section>
      </div>
    </Modal>
  );
}
