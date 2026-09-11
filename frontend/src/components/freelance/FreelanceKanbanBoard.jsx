import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArchiveRestore, Briefcase, CheckCircle2, Clock, GripVertical,
  Loader2, Lock, Mail, Settings2, User, XCircle,
} from 'lucide-react';
import PresenceBadge, { lastSeenLabel } from '../ui/PresenceBadge';
import PresenceAvatar from '../ui/PresenceAvatar';
import CandidateRemarkIndicator from '../ats/CandidateRemarkIndicator';
import { openNativeMail, freelancerCandidateMailDraft } from '../ui/ContactActionButtons';
import { formatRoleLabel } from '../organization/constants';
import ConfirmationModal from '../ConfirmationModal';
import DeskPager from './DeskPager';
import DeskPipelineExtras from './DeskPipelineExtras';
import HandoffManageModal from './HandoffManageModal';
import { cleanStageNoteText, pickCleanStageNote, parseTaggedStageNotes } from './stageNoteUtils';

const BOARD_PAGE_SIZE = 12;

const LINEAR = ['submitted', 'reviewing', 'shortlisted', 'selection', 'joined'];

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function linearOrder(stages) {
  return (stages || [])
    .filter((s) => !s.terminal && !/reject|drop/i.test(String(s.id || s.label || '')))
    .map((s) => s.id);
}

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatScorecardRemark(scorecard) {
  if (!scorecard) return '';
  const rec = String(scorecard.recommendation || '').replace(/_/g, ' ').trim();
  const summary = String(scorecard.summary || '').trim();
  const scores = Array.isArray(scorecard.scores) ? scorecard.scores : [];
  const scoreLine = scores
    .filter((s) => s?.criterion)
    .map((s) => `${s.criterion}: ${s.score}/5`)
    .join(' · ');
  const stage = String(scorecard.stage || '').trim();
  const parts = [
    stage ? `Stage: ${stage}` : '',
    rec ? `Recommendation: ${rec}` : '',
    scoreLine,
    summary,
  ].filter(Boolean);
  return parts.join('\n');
}

const REVIEW_SEEN_PREFIX = 'skillnix.freelanceReview.seen.';

function latestScorecard(row) {
  if (row?.scorecard?.recommendation || row?.scorecard?.scores?.length || row?.scorecard?.summary) {
    return row.scorecard;
  }
  const list = Array.isArray(row?.stageScorecards) ? row.stageScorecards : [];
  return list.length ? list[list.length - 1] : null;
}

function formatHiringReviewRemark(row, stageLabel = '') {
  const want = String(stageLabel || row?.boardStatus || row?.status || '').trim();
  const noteText = pickCleanStageNote(row, want);
  const wantKey = want.toLowerCase();
  const score = formatScorecardRemark(
    (Array.isArray(row?.stageScorecards)
      ? row.stageScorecards.find((s) => String(s.stage || '').toLowerCase() === wantKey)
      : null)
      || (String(row?.scorecard?.stage || '').toLowerCase() === wantKey || !row?.scorecard?.stage
        ? row?.scorecard
        : null)
  );
  const parts = [];
  if (noteText) parts.push(cleanStageNoteText(noteText));
  if (score) parts.push(score);
  if (!parts.length && row?.reviewedAt) {
    parts.push('The hiring team updated this submission’s stage.');
  }
  return parts.join('\n\n');
}

/** Only hiring-review events — not generic document updatedAt. */
function reviewUpdatedAtMs(row) {
  const times = [
    row?.reviewedAt,
    row?.scorecard?.updatedAt,
    ...(Array.isArray(row?.stageScorecards) ? row.stageScorecards.map((s) => s?.updatedAt) : []),
    ...(Array.isArray(row?.stageNotes) ? row.stageNotes.map((n) => n?.updatedAt) : []),
  ]
    .filter(Boolean)
    .map((t) => new Date(t).getTime())
    .filter((n) => Number.isFinite(n) && n > 0);
  return times.length ? Math.max(...times) : 0;
}

/**
 * Red-dot only for NEW updates after the freelancer has already acknowledged
 * the current snapshot. Missing localStorage key = first encounter → no badge
 * (historical reviews must not light up forever on first visit).
 */
function isHiringReviewUnread(row, stageLabel = '') {
  if (!row?._id) return false;
  const hasPayload = Boolean(formatHiringReviewRemark(row, stageLabel)) || Boolean(row?.reviewedAt);
  if (!hasPayload) return false;
  const updated = reviewUpdatedAtMs(row);
  if (!updated) return false;
  try {
    const raw = localStorage.getItem(`${REVIEW_SEEN_PREFIX}${row._id}`);
    if (raw == null) return false;
    return updated > Number(raw);
  } catch {
    return false;
  }
}

function markHiringReviewSeen(row) {
  if (!row?._id) return;
  const stamp = reviewUpdatedAtMs(row) || Date.now();
  try {
    localStorage.setItem(`${REVIEW_SEEN_PREFIX}${row._id}`, String(stamp));
  } catch { /* ignore */ }
}

/** Seed current review state as already-seen so only future updates badge. */
function bootstrapHiringReviewSeen(rows = []) {
  try {
    for (const row of rows) {
      if (!row?._id) continue;
      const key = `${REVIEW_SEEN_PREFIX}${row._id}`;
      if (localStorage.getItem(key) != null) continue;
      const updated = reviewUpdatedAtMs(row);
      if (updated) localStorage.setItem(key, String(updated));
    }
  } catch { /* ignore */ }
}

function relativeTime(value) {
  if (!value) return '—';
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function jobTitle(job) {
  return job?.title || job?.role || 'Untitled mandate';
}

function stageOf(row, stages) {
  if (!stages?.length) return row.status || 'submitted';
  if (stages.some((s) => s.id === row.status)) return row.status;
  // Company-stage boards: first stage as safe fallback
  return stages[0]?.id || row.status || 'submitted';
}

function isTerminalStage(stageId, stages) {
  const s = (stages || []).find((x) => x.id === stageId);
  if (s?.terminal) return true;
  return /reject|drop|declin/i.test(String(stageId || ''));
}

/**
 * Stage cell kinds for per-candidate boards:
 * - current: card lives here
 * - locked: cleared / frozen (no Place here) — Unlock reopens
 * - empty: available Place here / drop target
 * - skipped: non-interactive ahead display
 */
export function cellKind(current, stageId, stages) {
  if (current === stageId) return 'current';
  const order = stages?.length ? linearOrder(stages) : LINEAR;
  const currentTerminal = isTerminalStage(current, stages);
  const stageTerminal = isTerminalStage(stageId, stages);

  // Declined / rejected: lock every other stage until explicitly unlocked.
  if (currentTerminal) {
    return 'locked';
  }

  // From an active stage, terminal columns stay available (Place here to decline).
  if (stageTerminal) return 'empty';

  const ci = order.indexOf(current);
  const si = order.indexOf(stageId);
  if (si >= 0 && ci >= 0 && si < ci) return 'locked';
  return 'empty';
}

function canAcceptMove(kind, interactive) {
  if (!interactive) return false;
  return kind === 'empty' || kind === 'locked';
}

/** Compact pipeline card — same shape on company + freelancer boards. */
function CandidateCard({ row, stage, interactive, saving, dragging }) {
  const candidate = row.candidateId || row.candidateSnapshot || {};
  const name = candidate.name || 'Unnamed candidate';
  const job = row.jobId || {};
  const contact = candidate.contact || candidate.phone || '';
  const stageLabel = stage?.label || stage?.id || '';
  const hiringReview = formatHiringReviewRemark(row, stageLabel);
  const showReviewIcon = Boolean(hiringReview) || Boolean(row?.reviewedAt);
  const title = jobTitle(job);

  return (
    <article
      className={cx(
        'group/card bg-white rounded-xl border border-stone-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden transition-all duration-200',
        dragging && 'opacity-50 ring-2 ring-brand-400 scale-[0.98]',
        interactive && 'hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 cursor-grab active:cursor-grabbing'
      )}
    >
      <div className={cx('h-0.5 w-full', stage.bar || 'bg-brand-500')} />
      <div className="space-y-2 p-2.5 min-w-0">
        <div className="flex items-start gap-2 min-w-0">
          {interactive ? (
            <span
              className="text-stone-300 group-hover/card:text-brand-500 shrink-0 mt-0.5"
              title="Drag to another stage"
              aria-hidden="true"
            >
              <GripVertical size={13} strokeWidth={2.25} />
            </span>
          ) : null}
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
            {initials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5 min-w-0">
              <h4
                className="min-w-0 flex-1 font-semibold text-stone-900 text-[12px] leading-snug tracking-tight break-words [overflow-wrap:anywhere]"
                title={name}
              >
                {name}
              </h4>
              <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                {saving ? <Loader2 size={12} className="animate-spin text-brand-600" /> : null}
                {showReviewIcon ? (
                  <span
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <CandidateRemarkIndicator
                      remark={hiringReview}
                      candidateName={name}
                      alwaysShow
                      locked
                      showBadge={isHiringReviewUnread(row, stageLabel)}
                      onOpen={() => markHiringReviewSeen(row)}
                      title="Hiring review"
                      subtitle={`Current stage · ${stageLabel || 'Pipeline'}`}
                      emptyText="No hiring review for this stage yet"
                      ariaLabel="Hiring review"
                    />
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex items-start gap-1.5 min-w-0 rounded-lg bg-stone-100/90 px-2 py-1.5 text-[10.5px]"
          title={title}
        >
          <Briefcase size={11} className="shrink-0 text-brand-600 mt-0.5" strokeWidth={2.25} />
          <span className="min-w-0 flex-1 font-medium text-stone-800 leading-snug break-words [overflow-wrap:anywhere]">
            {title}
          </span>
        </div>

        <div className="space-y-1 text-[10px] text-stone-600 min-w-0">
          {candidate.email ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openNativeMail(candidate.email, freelancerCandidateMailDraft(candidate, {
                  jobTitle: title,
                  jobCode: job?.jobCode,
                }));
              }}
              className="flex w-full items-start gap-1.5 min-w-0 text-left rounded-md px-0.5 py-0.5 transition-colors hover:bg-brand-50 hover:text-brand-800"
              title={candidate.email}
            >
              <Mail size={11} className="shrink-0 text-brand-600 mt-0.5" strokeWidth={2.25} />
              <span className="min-w-0 flex-1 leading-snug break-all [overflow-wrap:anywhere]">
                {candidate.email}
              </span>
            </button>
          ) : null}
          {contact ? (
            <p className="flex items-start gap-1.5 min-w-0 tabular-nums px-0.5">
              <User size={11} className="shrink-0 text-brand-600 mt-0.5" strokeWidth={2.25} />
              <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{contact}</span>
            </p>
          ) : null}
        </div>

        <div className="flex items-center pt-1 border-t border-stone-100">
          <p className="flex items-center gap-1 text-[9px] font-medium text-stone-400 tabular-nums">
            <Clock size={10} className="shrink-0" strokeWidth={2.25} />
            {relativeTime(row.reviewedAt || row.updatedAt || row.createdAt)}
          </p>
        </div>
      </div>
    </article>
  );
}

function EmptyColumnSlot({ stage, kind, interactive, disabled, onRequestMove }) {
  const Icon = stage.icon;

  // Locked — compact; never auto-move. Click opens unlock confirmation.
  if (kind === 'done' || kind === 'locked') {
    if (interactive) {
      return (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onRequestMove?.(stage.id, 'locked')}
          className={cx(
            'relative h-full min-h-[72px] w-full rounded-xl border flex flex-col items-center justify-center gap-1 px-2 py-2.5 text-center transition-all',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'border-stone-200 bg-stone-50/90 hover:border-amber-300 hover:bg-amber-50/40'
          )}
          title={`${stage.label} is locked`}
          aria-label={`${stage.label} locked — unlock required`}
        >
          <span className="absolute top-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-500 shadow-sm">
            <Lock size={11} strokeWidth={2.5} />
          </span>
          <span className={cx(
            'inline-flex items-center justify-center w-7 h-7 rounded-full bg-white border shadow-sm text-stone-400',
            stage.border
          )}
          >
            {Icon ? <Icon size={13} strokeWidth={2.25} /> : <Lock size={13} strokeWidth={2.5} />}
          </span>
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-stone-500">Locked</p>
        </button>
      );
    }
    return (
      <div className={cx(
        'h-full min-h-[88px] rounded-xl border flex flex-col items-center justify-center gap-2 px-3 py-3 text-center',
        stage.border, stage.soft
      )}
      >
        <span className={cx(
          'inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border shadow-sm',
          stage.border, stage.text
        )}
        >
          <CheckCircle2 size={16} strokeWidth={2.5} />
        </span>
        <p className={cx('text-[9.5px] font-bold uppercase tracking-[0.1em]', stage.text)}>Completed</p>
      </div>
    );
  }

  if (!interactive) {
    const skipped = kind === 'skipped';
    return (
      <div className={cx(
        'h-full min-h-[88px] rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 px-3 py-3 text-center transition-colors',
        skipped ? 'border-stone-200/60 bg-stone-50/40' : 'border-stone-200/80 bg-white'
      )}
      >
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-stone-200 bg-stone-50 text-stone-300">
          {skipped
            ? <XCircle size={15} strokeWidth={2} />
            : (Icon ? <Icon size={15} strokeWidth={2} /> : <Clock size={15} strokeWidth={2} />)}
        </span>
        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-300">
          {skipped ? 'Skipped' : 'Awaiting'}
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onRequestMove?.(stage.id, 'empty')}
      className={cx(
        'h-full min-h-[72px] w-full rounded-xl border border-dashed flex flex-col items-center justify-center gap-1 px-2 py-2.5 text-center transition-all',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'border-brand-200 bg-brand-50/40 hover:border-brand-400 hover:bg-brand-50/70 hover:shadow-sm'
      )}
    >
      <span className={cx(
        'w-7 h-7 rounded-lg border bg-white flex items-center justify-center shadow-sm',
        stage.border || 'border-stone-200',
        stage.text || 'text-stone-400'
      )}
      >
        {Icon ? <Icon size={13} strokeWidth={2.25} /> : null}
      </span>
      <p className="text-[10px] font-bold uppercase tracking-wide text-brand-700">Place here</p>
    </button>
  );
}

function useBoardScroll() {
  const ref = useRef(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 });

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('[data-kanban-card], button, a, textarea, input, [role="listbox"]')) return;
    const el = ref.current;
    if (!el) return;
    drag.current = { active: true, startX: e.clientX, scrollLeft: el.scrollLeft };
    el.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!drag.current.active || !ref.current) return;
    const dx = e.clientX - drag.current.startX;
    ref.current.scrollLeft = drag.current.scrollLeft - dx;
  };

  const onPointerUp = (e) => {
    drag.current.active = false;
    try { ref.current?.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
  };

  return { ref, onPointerDown, onPointerMove, onPointerUp };
}

function CandidateBoardSection({
  row,
  serial,
  stages,
  interactive,
  saving,
  deskStatus,
  drafts,
  onDraft,
  onMove,
  onSaveNote,
  onOpenAts,
  onArchive,
  onRestore,
  selected,
  onToggleSelect,
  reviewers,
  canHardDelete,
  onReassign,
  onEditCandidate,
  onHardDelete,
  dragId,
  setDragId,
  overKey,
  setOverKey,
  canManageDesk = false,
  onSaveScorecard,
  onDecideApproval,
  onScheduleInterview,
}) {
  const scroll = useBoardScroll();
  const current = stageOf(row, stages);
  const currentStage = stages.find((s) => s.id === current) || stages[0];
  const kinds = stages.map((s) => cellKind(current, s.id, stages));
  const candidate = row.candidateId || {};
  const name = candidate.name || 'Unnamed candidate';
  const job = row.jobId || {};
  const freelancer = row.freelancerId || {};
  const spoc = row.spocUserId || {};
  const desk = deskStatus?.(freelancer) || { status: 'offline' };
  const lastLabel = desk.status === 'online'
    ? ''
    : lastSeenLabel(desk.lastActiveAt || desk.lastLoginAt);
  const archived = Boolean(row.archivedAt);
  const canEdit = interactive && !archived;
  const [manageOpen, setManageOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState(null);
  const [moveNote, setMoveNote] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const jobCode = job.jobCode || null;
  const reviewerName = spoc.name || spoc.email || 'Unassigned';
  const reviewerRole = formatRoleLabel(spoc.role) || 'Hiring manager';
  const isUrgent = String(job.priority || '').toLowerCase() === 'urgent';

  const requestStageMove = (stageId, kindHint) => {
    if (!canEdit || saving || !stageId || stageId === current) return;
    const target = stages.find((s) => s.id === stageId);
    if (!target) return;
    const kind = kindHint || cellKind(current, stageId, stages);
    setMoveNote('');
    setPendingMove({
      stageId,
      kind,
      label: target.label || stageId,
      fromLabel: currentStage?.label || current,
    });
  };

  const confirmPendingMove = async () => {
    if (!pendingMove?.stageId) return;
    setConfirmLoading(true);
    try {
      const trimmed = String(moveNote || '').trim();
      // Pass note for destination stage only — backend stores stage-wise history.
      await onMove?.(row._id, pendingMove.stageId, trimmed || undefined);
      setPendingMove(null);
      setMoveNote('');
    } finally {
      setConfirmLoading(false);
    }
  };

  const isLockedPending = pendingMove?.kind === 'locked' || pendingMove?.kind === 'done';
  const isTerminalTarget = isTerminalStage(pendingMove?.stageId, stages);

  return (
    <section className={cx(
      'group/board relative card-ats-bordered overflow-visible',
      'transition-shadow duration-200 hover:shadow-md hover:shadow-stone-200/50',
      archived && 'opacity-[0.96]'
    )}
    >
      <div className={cx(
        'absolute inset-x-0 top-0 h-0.5 rounded-t-2xl pointer-events-none z-10',
        archived
          ? 'bg-stone-400'
          : isUrgent
            ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-700'
            : 'bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600'
      )}
      />

      {/* Enterprise identity bar — candidate · stage · HM · job ID */}
      <header className="relative overflow-visible border-b border-stone-200/80 bg-white px-3.5 pt-3.5 pb-3 sm:px-4 rounded-t-2xl">
        <div className="flex items-center gap-2.5 min-w-0">
          {interactive && onToggleSelect ? (
            <label className="shrink-0 cursor-pointer" title="Select for bulk actions">
              <input
                type="checkbox"
                className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                checked={Boolean(selected)}
                onChange={() => onToggleSelect(row._id)}
              />
            </label>
          ) : null}

          <div className="flex items-center gap-2 shrink-0">
            <span className="w-6 h-6 rounded-md bg-stone-100 border border-stone-200 text-stone-500 flex items-center justify-center text-[10px] font-semibold tabular-nums">
              {serial}
            </span>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-600 to-teal-700 text-white flex items-center justify-center text-[12px] font-semibold shadow-sm ring-2 ring-white">
              {initials(name)}
            </div>
          </div>

          <div className="min-w-0 flex-1 overflow-visible">
            {/* Single professional identity row: name · stage · flags · hiring manager · job ID */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 min-w-0">
              {/* Candidate name + stage + flags */}
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <h2
                  className="text-[14px] sm:text-[15px] font-semibold tracking-tight text-stone-900 break-words leading-snug"
                  title={name}
                >
                  {name}
                </h2>
                <span
                  className={cx(
                    'inline-flex items-center h-5 px-2 rounded-full border text-[9px] font-semibold uppercase tracking-[0.04em] shrink-0',
                    currentStage?.chip || 'bg-stone-50 text-stone-700 border-stone-200'
                  )}
                  title={currentStage?.label}
                >
                  {currentStage?.label}
                </span>
                {isUrgent ? (
                  <span className="inline-flex items-center h-6 gap-1 px-2 rounded-full border border-red-200 bg-red-50 text-red-700 text-[10px] font-semibold uppercase tracking-[0.04em] shrink-0">
                    <AlertTriangle size={10} strokeWidth={2.5} />
                    Urgent
                  </span>
                ) : null}
                {archived ? (
                  <span className="inline-flex items-center h-6 px-2 rounded-full border border-stone-200 bg-stone-50 text-stone-500 text-[10px] font-semibold uppercase tracking-[0.04em] shrink-0">
                    Archived
                  </span>
                ) : null}
                {row.slaBreached ? (
                  <span className="inline-flex items-center h-6 gap-1 px-2 rounded-full border border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-semibold uppercase tracking-[0.04em] shrink-0">
                    <AlertTriangle size={10} /> SLA {row.agingDays}d
                  </span>
                ) : null}
              </div>

              {/* Divider (desktop only) */}
              <span className="hidden sm:block h-5 w-px bg-stone-200 shrink-0 self-center" aria-hidden="true" />

              {/* Hiring manager — compact single line */}
              <div
                className="inline-flex items-center gap-2 min-w-0 max-w-full py-0.5"
                title={`Hiring manager · ${reviewerName} · ${reviewerRole}`}
              >
                <span className="w-6 h-6 shrink-0 rounded-full bg-stone-800 text-white flex items-center justify-center text-[9px] font-semibold">
                  {initials(reviewerName)}
                </span>
                <span className="min-w-0 truncate text-[12px] leading-snug">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-stone-400 mr-1.5">HM</span>
                  <span className="font-medium text-stone-900">{reviewerName}</span>
                  <span className="text-stone-400 font-normal"> · {reviewerRole}</span>
                </span>
              </div>

              {/* Job ID — compact chip */}
              <span
                className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-teal-200/90 bg-teal-50/70 px-2.5 py-1.5"
                title={jobCode ? `Job ID ${jobCode}` : `Board ${serial}`}
              >
                <Briefcase size={12} className="shrink-0 text-teal-600" strokeWidth={2.25} />
                <span className="font-mono text-[11.5px] font-semibold tabular-nums tracking-wide text-teal-900 leading-snug whitespace-nowrap">
                  {jobCode || `BOARD-${serial}`}
                </span>
              </span>
            </div>
          </div>

          {interactive && canManageDesk ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => setManageOpen(true)}
              className="ml-auto shrink-0 h-8 px-3 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-brand-600 to-teal-600 hover:from-brand-700 hover:to-teal-700 inline-flex items-center justify-center gap-1.5 disabled:opacity-50 self-start"
            >
              <Settings2 size={13} strokeWidth={2.25} />
              Manage
            </button>
          ) : null}
        </div>

        {interactive ? (
          <div className="mt-2 flex items-center gap-2 min-w-0 rounded-lg border border-stone-200/90 bg-stone-50/70 px-2.5 py-1.5">
            <PresenceAvatar
              name={freelancer.name}
              email={freelancer.email}
              photo={freelancer.profilePicture}
              size={24}
            />
            <p className="min-w-0 flex-1 truncate text-[11px] leading-snug">
              <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-stone-400 mr-1.5">Submitted by</span>
              <span className="font-medium text-stone-900">{freelancer.name || freelancer.email || '—'}</span>
            </p>
            <PresenceBadge compact status={desk.status} lastLabel={lastLabel} />
            {archived && canManageDesk ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => onRestore?.(row._id)}
                className="h-7 px-2.5 rounded-lg text-[10px] font-semibold text-brand-800 border border-brand-200 bg-brand-50 hover:bg-brand-100 inline-flex items-center gap-1 disabled:opacity-50 shrink-0"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <ArchiveRestore size={12} strokeWidth={2.25} />}
                Restore
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <div
        ref={scroll.ref}
        className="overflow-x-auto overflow-y-hidden overscroll-x-contain cursor-grab active:cursor-grabbing select-none bg-stone-50/40 border-b border-stone-100 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onPointerDown={scroll.onPointerDown}
        onPointerMove={scroll.onPointerMove}
        onPointerUp={scroll.onPointerUp}
        onPointerCancel={scroll.onPointerUp}
      >
        <div className="flex w-max min-w-full items-stretch gap-2.5 p-3">
          {stages.map((stage, i) => {
            const kind = kinds[i];
            const isCurrent = kind === 'current';
            const dropKey = `${row._id}:${stage.id}`;
            const isOver = overKey === dropKey && dragId === row._id;
            const StageIcon = stage.icon;
            const canDrop = canEdit && !isCurrent && canAcceptMove(kind, canEdit) && !saving;

            return (
              <div
                key={stage.id}
                className={cx(
                  'flex-shrink-0 flex flex-col rounded-xl border bg-white transition-all duration-200 min-w-0',
                  'w-[216px] sm:w-[240px] md:w-[256px]',
                  isOver ? 'border-brand-400 ring-2 ring-brand-200/70 bg-brand-50/40 scale-[1.01]' : 'border-stone-200/80',
                  isCurrent && (stage.soft || 'bg-stone-50'),
                  (kind === 'locked' || kind === 'done') && !isCurrent && 'opacity-95'
                )}
                onDragOver={canDrop ? (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setOverKey(dropKey);
                } : undefined}
                onDragLeave={() => setOverKey((cur) => (cur === dropKey ? null : cur))}
                onDrop={canDrop ? (e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/handoff-id') || dragId;
                  setDragId(null);
                  setOverKey(null);
                  if (id === row._id) requestStageMove(stage.id, kind);
                } : undefined}
              >
                <div className={cx(
                  'px-2.5 py-1.5 border-b flex items-center gap-1.5 rounded-t-xl',
                  isCurrent ? (stage.soft || 'bg-stone-50') : 'bg-stone-50/90',
                  isCurrent ? (stage.border || 'border-stone-100') : 'border-stone-100'
                )}
                >
                  <span className={cx(
                    'w-6 h-6 rounded-md border bg-white flex items-center justify-center shrink-0',
                    isCurrent ? stage.border : 'border-stone-200',
                    isCurrent ? stage.text : 'text-stone-400'
                  )}
                  >
                    {(kind === 'done' || kind === 'locked')
                      ? <Lock size={11} strokeWidth={2.25} />
                      : (StageIcon ? <StageIcon size={12} strokeWidth={2.25} /> : null)}
                  </span>
                  <h3 className={cx(
                    'min-w-0 flex-1 font-semibold text-[11px] tracking-wide leading-snug break-words',
                    isCurrent ? stage.text : 'text-stone-600'
                  )}
                  >
                    {stage.label}
                  </h3>
                  {isCurrent ? (
                    <span className="ml-auto text-[8px] font-bold uppercase tracking-wide text-white bg-gradient-to-r from-brand-600 to-teal-600 px-1 py-0.5 rounded shrink-0">
                      Now
                    </span>
                  ) : (kind === 'locked' || kind === 'done') ? (
                    <span className="ml-auto text-[8px] font-bold uppercase tracking-wide text-stone-500 bg-stone-100 border border-stone-200 px-1 py-0.5 rounded shrink-0">
                      Locked
                    </span>
                  ) : null}
                </div>

                <div className="flex-1 p-2 min-h-[88px]">
                  {isCurrent ? (
                    <div
                      data-kanban-card
                      draggable={canEdit && !saving}
                      onDragStart={canEdit ? (e) => {
                        if (e.target.closest('button, [role="listbox"], textarea, input')) {
                          e.preventDefault();
                          return;
                        }
                        setDragId(row._id);
                        e.dataTransfer.setData('text/handoff-id', row._id);
                        e.dataTransfer.effectAllowed = 'move';
                      } : undefined}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverKey(null);
                      }}
                      className={canEdit ? 'cursor-grab active:cursor-grabbing' : undefined}
                    >
                      <CandidateCard
                        row={row}
                        stage={stage}
                        interactive={canEdit}
                        saving={saving}
                        dragging={dragId === row._id}
                      />
                    </div>
                  ) : (
                    <EmptyColumnSlot
                      stage={stage}
                      kind={kind}
                      interactive={canEdit}
                      disabled={saving}
                      onRequestMove={requestStageMove}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {interactive ? (
        <div className="border-t border-stone-100 bg-stone-50/40 px-4 sm:px-5 py-3.5 overflow-visible">
          <div className="flex flex-col gap-3">
            <p className="text-[12px] font-semibold text-stone-800 leading-none">Hiring review</p>
            {archived ? (
              <p className="text-[11px] text-stone-500 -mt-2">
                {canManageDesk ? 'Archived — restore to continue.' : 'Archived — ask an owner, admin, or HR manager to restore.'}
              </p>
            ) : null}

            <DeskPipelineExtras
              row={row}
              stageLabel={currentStage?.label || current}
              saving={saving}
              canManageDesk={canManageDesk}
              archived={archived}
              drafts={drafts}
              onDraft={onDraft}
              onSaveNote={onSaveNote}
              onSaveScorecard={onSaveScorecard}
              onDecideApproval={onDecideApproval}
              onScheduleInterview={onScheduleInterview}
            />
          </div>

          {canManageDesk ? (
          <HandoffManageModal
            open={manageOpen}
            onClose={() => setManageOpen(false)}
            row={row}
            stages={stages}
            saving={saving}
            reviewers={reviewers}
            canHardDelete={canHardDelete}
            onMove={async (_id, status) => {
              setManageOpen(false);
              requestStageMove(status);
              return false;
            }}
            onOpenAts={onOpenAts}
            onArchive={onArchive}
            onRestore={onRestore}
            onReassign={onReassign}
            onEditCandidate={onEditCandidate}
            onHardDelete={onHardDelete}
          />
          ) : null}

          <ConfirmationModal
            isOpen={Boolean(pendingMove)}
            onClose={() => {
              if (confirmLoading) return;
              setPendingMove(null);
              setMoveNote('');
            }}
            onConfirm={confirmPendingMove}
            isLoading={confirmLoading}
            type={isLockedPending || isTerminalTarget ? 'warning' : 'edit'}
            eyebrow="Pipeline stage"
            title={
              isLockedPending
                ? 'Stage is locked'
                : isTerminalTarget
                  ? `Move to ${pendingMove?.label}?`
                  : `Confirm move to ${pendingMove?.label}?`
            }
            message={
              isLockedPending
                ? `${pendingMove?.label} is locked. Unlock to move here from ${pendingMove?.fromLabel}. You can add an optional review note for this stage.`
                : `Move this candidate from ${pendingMove?.fromLabel} to ${pendingMove?.label}? This update is shared with the freelance recruiter.`
            }
            confirmText={isLockedPending ? 'Unlock & move' : 'Confirm move'}
            cancelText="Cancel"
          >
            <div className="space-y-1.5">
              <label htmlFor={`move-note-${row._id}`} className="label-ats">
                Note for {pendingMove?.label || 'this stage'}{' '}
                <span className="font-normal text-stone-400">(optional)</span>
              </label>
              <textarea
                id={`move-note-${row._id}`}
                value={moveNote}
                onChange={(e) => setMoveNote(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={`Saved against ${pendingMove?.label || 'this stage'} and visible to the recruiter…`}
                className="input-ats !h-auto min-h-[5.5rem] py-2.5 resize-y"
                disabled={confirmLoading}
              />
            </div>
          </ConfirmationModal>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Separate Kanban board per candidate — scrollable columns, drag card between stages.
 */
export default function FreelanceKanbanBoard({
  stages = [],
  rows = [],
  stageFilter = 'all',
  interactive = true,
  savingId = null,
  deskStatus,
  drafts = {},
  onDraft,
  onMove,
  onSaveNote,
  onOpenAts,
  onArchive,
  onRestore,
  selectedIds = [],
  onToggleSelect,
  reviewers = [],
  canHardDelete = false,
  onReassign,
  onEditCandidate,
  onHardDelete,
  canManageDesk = false,
  onSaveScorecard,
  onDecideApproval,
  onScheduleInterview,
}) {
  const [dragId, setDragId] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (interactive) return;
    bootstrapHiringReviewSeen(rows);
  }, [interactive, rows]);

  const sorted = useMemo(() => {
    const want = String(stageFilter || 'all').trim().toLowerCase();
    const list = want === 'all'
      ? [...rows]
      : rows.filter((row) => {
        const current = String(stageOf(row, stages) || row.boardStatus || row.status || '').trim().toLowerCase();
        if (current === want) return true;
        return current.includes(want) || want.includes(current.split(' / ')[0]);
      });
    return list.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.reviewedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.reviewedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [rows, stageFilter, stages]);

  useEffect(() => { setPage(1); }, [stageFilter, rows.length]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / BOARD_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * BOARD_PAGE_SIZE;
  const paged = sorted.slice(pageStart, pageStart + BOARD_PAGE_SIZE);
  const activeStageLabel = stageFilter !== 'all'
    ? (stages.find((s) => String(s.id).toLowerCase() === String(stageFilter).toLowerCase())?.label || stageFilter)
    : null;

  if (!sorted.length) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-12 text-center">
        <p className="text-sm font-semibold text-stone-700">
          {activeStageLabel ? `No candidates in ${activeStageLabel}` : 'No submissions in this stage'}
        </p>
        <p className="text-[12px] text-stone-400 mt-1">
          No submissions match this stage.
        </p>
      </div>
    );
  }

  return (
    <div className={cx('space-y-3', !interactive && 'space-y-2.5')}>
      {activeStageLabel ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50/70 px-3 py-2">
          <p className="text-[12px] font-semibold text-brand-900">
            {activeStageLabel}
            <span className="font-medium text-brand-700"> · {sorted.length} candidate{sorted.length === 1 ? '' : 's'}</span>
          </p>
        </div>
      ) : null}
      {paged.map((row, index) => (
        <CandidateBoardSection
          key={row._id || index}
          row={row}
          serial={pageStart + index + 1}
          stages={stages}
          interactive={interactive}
          saving={savingId === row._id}
          deskStatus={deskStatus}
          drafts={drafts}
          onDraft={onDraft}
          onMove={onMove}
          onSaveNote={onSaveNote}
          onOpenAts={onOpenAts}
          onArchive={onArchive}
          onRestore={onRestore}
          selected={selectedIds.includes(row._id)}
          onToggleSelect={onToggleSelect}
          reviewers={reviewers}
          canHardDelete={canHardDelete}
          canManageDesk={canManageDesk}
          onReassign={onReassign}
          onEditCandidate={onEditCandidate}
          onHardDelete={onHardDelete}
          onSaveScorecard={onSaveScorecard}
          onDecideApproval={onDecideApproval}
          onScheduleInterview={onScheduleInterview}
          dragId={dragId}
          setDragId={setDragId}
          overKey={overKey}
          setOverKey={setOverKey}
        />
      ))}

      <div className="rounded-2xl border border-stone-200/90 bg-white px-4 py-3.5 shadow-[var(--shadow-card)]">
        <DeskPager
          page={safePage}
          setPage={setPage}
          total={sorted.length}
          pageSize={BOARD_PAGE_SIZE}
          label="boards"
          hint="Newest first"
        />
      </div>
    </div>
  );
}
