import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArchiveRestore, Briefcase, Building2, CheckCircle2, Clock, GripVertical,
  Loader2, Mail, MapPin, Settings2, User, XCircle,
} from 'lucide-react';
import PresenceBadge, { lastSeenLabel } from '../ui/PresenceBadge';
import PresenceAvatar from '../ui/PresenceAvatar';
import { ReviewComposer, ReviewMemo } from '../ui/ReviewMemo';
import { formatRoleLabel } from '../organization/constants';
import DeskPager from './DeskPager';
import HandoffManageModal from './HandoffManageModal';

const BOARD_PAGE_SIZE = 3;

const LINEAR = ['submitted', 'reviewing', 'shortlisted', 'selection', 'joined'];

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
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

function formatPlaces(job) {
  if (!job) return 'Location not set';
  const parts = [];
  if (Array.isArray(job.locations) && job.locations.length) {
    parts.push(...job.locations.map((x) => String(x || '').trim()).filter(Boolean));
  }
  const single = String(job.location || '').trim();
  if (single && !parts.includes(single)) parts.unshift(single);
  if (!parts.length) return 'Location not set';
  return parts.join(', ');
}

function stageOf(row, stages) {
  return stages.some((s) => s.id === row.status) ? row.status : 'submitted';
}

function cellKind(current, stageId) {
  if (current === stageId) return 'current';
  if (current === 'rejected') {
    if (stageId === 'submitted') return 'done';
    if (stageId === 'rejected') return 'current';
    return 'skipped';
  }
  if (stageId === 'rejected') return 'skipped';
  const ci = LINEAR.indexOf(current);
  const si = LINEAR.indexOf(stageId);
  if (si >= 0 && ci >= 0 && si < ci) return 'done';
  return 'empty';
}

/** Lean card for the current stage column — identity only (actions live below the board). */
function CandidateCard({ row, stage, interactive, saving, desk, dragging }) {
  const candidate = row.candidateId || {};
  const name = candidate.name || 'Unnamed candidate';
  const job = row.jobId || {};
  const deskUser = row.freelancerId || {};

  const contact = candidate.contact || candidate.phone || '';
  const location = formatPlaces(job);

  return (
    <article
      className={cx(
        'bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden transition-shadow',
        dragging && 'opacity-50 ring-2 ring-brand-400',
        interactive && 'hover:border-brand-300 hover:shadow-md'
      )}
    >
      <div className={cx('h-1 w-full', stage.bar || 'bg-brand-500')} />
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {interactive ? (
            <span
              className="mt-1 text-stone-300 cursor-grab active:cursor-grabbing shrink-0"
              title="Drag to another stage"
              aria-hidden="true"
            >
              <GripVertical size={16} strokeWidth={2.25} />
            </span>
          ) : null}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-[12px] font-bold flex-shrink-0 shadow-sm shadow-brand-500/20">
            {initials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-stone-900 text-[14px] leading-snug break-words tracking-tight">
              {name}
            </h4>
            <span className={cx(
              'inline-flex mt-1.5 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em]',
              stage.chip || 'bg-stone-50 text-stone-700 border-stone-200'
            )}
            >
              {stage.label}
            </span>
          </div>
          {saving ? <Loader2 size={14} className="animate-spin text-brand-600 shrink-0 mt-1" /> : null}
        </div>

        <div className="space-y-2 text-[12px] text-stone-600 pl-0.5">
          <p className="flex items-start gap-2.5 min-w-0">
            <Briefcase size={14} className="shrink-0 text-brand-600 mt-0.5" strokeWidth={2.25} />
            <span className="font-medium text-stone-800 break-words leading-snug">{jobTitle(job)}</span>
          </p>
          {location && location !== 'Location not set' ? (
            <p className="flex items-start gap-2.5 min-w-0">
              <MapPin size={14} className="shrink-0 text-brand-600 mt-0.5" strokeWidth={2.25} />
              <span className="break-words leading-snug">{location}</span>
            </p>
          ) : null}
          {candidate.email ? (
            <p className="flex items-start gap-2.5 min-w-0">
              <Mail size={14} className="shrink-0 text-brand-600 mt-0.5" strokeWidth={2.25} />
              <span className="break-all leading-snug">{candidate.email}</span>
            </p>
          ) : null}
          {contact ? (
            <p className="flex items-center gap-2.5 min-w-0 tabular-nums">
              <User size={14} className="shrink-0 text-brand-600" strokeWidth={2.25} />
              <span className="truncate">{contact}</span>
            </p>
          ) : null}
          {interactive && (deskUser?.name || deskUser?.email) ? (
            <p className="flex items-center gap-2.5 min-w-0">
              <Building2 size={14} className="shrink-0 text-brand-600" strokeWidth={2.25} />
              <span className="truncate">{deskUser.name || deskUser.email}</span>
              {desk ? <PresenceBadge compact status={desk.status} /> : null}
            </p>
          ) : null}
          <p className="flex items-center gap-2.5 text-stone-400 tabular-nums">
            <Clock size={14} className="shrink-0" strokeWidth={2.25} />
            Updated {relativeTime(row.reviewedAt || row.updatedAt || row.createdAt)}
          </p>
        </div>
      </div>
    </article>
  );
}

function EmptyColumnSlot({ stage, kind, interactive, disabled, onMove }) {
  const Icon = stage.icon;

  if (kind === 'done') {
    return (
      <div className={cx(
        'h-full min-h-[148px] rounded-2xl border flex flex-col items-center justify-center gap-2.5 px-4 text-center',
        stage.border, stage.soft
      )}
      >
        <span className={cx(
          'w-11 h-11 rounded-2xl border bg-white flex items-center justify-center shadow-sm',
          stage.border, stage.text
        )}
        >
          <CheckCircle2 size={20} strokeWidth={2.25} />
        </span>
        <div>
          <p className={cx('text-[11px] font-bold uppercase tracking-wide', stage.text)}>Completed</p>
          <p className="text-[12px] text-stone-600 mt-0.5 font-medium">{stage.label}</p>
        </div>
      </div>
    );
  }

  if (!interactive) {
    return (
      <div className="h-full min-h-[148px] rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <span className="w-11 h-11 rounded-2xl border border-stone-200 bg-white text-stone-300 flex items-center justify-center">
          {kind === 'skipped'
            ? <XCircle size={18} strokeWidth={2} />
            : (Icon ? <Icon size={18} strokeWidth={2} /> : null)}
        </span>
        <p className="text-[11px] text-stone-400 font-medium">
          {kind === 'skipped' ? 'Not on this path' : 'Empty'}
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onMove?.(stage.id)}
      className={cx(
        'h-full min-h-[148px] w-full rounded-2xl border border-dashed flex flex-col items-center justify-center gap-2.5 px-4 text-center transition-all',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        kind === 'skipped'
          ? 'border-stone-200 bg-stone-50/80 hover:border-brand-300 hover:bg-white'
          : 'border-brand-200 bg-brand-50/40 hover:border-brand-400 hover:bg-brand-50/70 hover:shadow-sm'
      )}
    >
      <span className={cx(
        'w-11 h-11 rounded-2xl border bg-white flex items-center justify-center shadow-sm',
        stage.border || 'border-stone-200',
        stage.text || 'text-stone-400'
      )}
      >
        {Icon ? <Icon size={18} strokeWidth={2.25} /> : null}
      </span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">Place here</p>
        <p className="text-[12px] text-stone-500 mt-0.5 font-medium">{stage.label}</p>
      </div>
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
}) {
  const scroll = useBoardScroll();
  const current = stageOf(row, stages);
  const currentStage = stages.find((s) => s.id === current) || stages[0];
  const kinds = stages.map((s) => cellKind(current, s.id));
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

  return (
    <section className={cx(
      'group/board relative card-ats-bordered overflow-visible',
      'transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:shadow-stone-200/60 hover:border-transparent',
      'active:scale-[0.998]',
      archived && 'opacity-[0.96]'
    )}
    >
      <div className={cx(
        'absolute inset-x-0 top-0 h-1 rounded-t-2xl pointer-events-none transition-all duration-300 group-hover/board:h-1.5',
        archived
          ? 'bg-stone-400'
          : 'bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600'
      )}
      />
      <div
        className="absolute inset-0 opacity-0 group-hover/board:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0) 40%, rgba(0,0,0,0.025))' }}
      />

      <header className="relative border-b border-stone-100 px-4 sm:px-6 pt-5 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {interactive ? (
              <label className="mt-1.5 shrink-0 cursor-pointer" title="Select for bulk actions">
                <input
                  type="checkbox"
                  className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                  checked={Boolean(selected)}
                  onChange={() => onToggleSelect?.(row._id)}
                />
              </label>
            ) : null}
            <span className="w-8 h-8 shrink-0 rounded-xl bg-stone-900 text-white flex items-center justify-center text-sm font-bold tabular-nums shadow-sm">
              {serial}
            </span>
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-teal-700 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-brand-500/20">
              {initials(name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-brand-700 tracking-wide uppercase">
                {job.jobCode || `Board ${serial}`}
                <span className="text-stone-300 font-normal mx-1.5">·</span>
                <span className="normal-case tracking-normal text-stone-500 font-medium">
                  {jobTitle(job)}
                </span>
              </p>
              <h2 className="mt-1 font-bold text-stone-900 text-lg leading-snug break-words tracking-tight">
                {name}
              </h2>
              {candidate.email ? (
                <p className="mt-1 text-[12px] text-stone-500 truncate flex items-center gap-1.5">
                  <Mail size={13} className="text-brand-600 shrink-0" strokeWidth={2.25} />
                  {candidate.email}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-2.5 shrink-0 lg:pl-4">
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {row.slaBreached ? (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 inline-flex items-center gap-1">
                  <AlertTriangle size={11} /> SLA {row.agingDays}d
                </span>
              ) : null}
              {row.lastReassignment ? (
                <span
                  className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border border-violet-200 bg-violet-50 text-violet-800"
                  title={`From ${row.lastReassignment.fromName || 'previous'} → ${row.lastReassignment.toName || 'new'} · by ${row.lastReassignment.byName || 'teammate'}`}
                >
                  Ownership transferred
                </span>
              ) : null}
              {row.qualityFlags?.missing?.length ? (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border border-orange-200 bg-orange-50 text-orange-800">
                  Missing {row.qualityFlags.missing.join(', ')}
                </span>
              ) : null}
              {archived ? (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border border-stone-300 bg-stone-100 text-stone-600">
                  Archived
                </span>
              ) : null}
              <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border ${currentStage.chip}`}>
                {currentStage.label}
              </span>
            </div>
            <div className="flex flex-col gap-2 items-stretch lg:items-end text-[12px] text-stone-600 w-full lg:max-w-[min(100%,280px)] min-w-0">
              {job.clientName ? (
                <span className="inline-flex items-start gap-2 min-w-0 lg:flex-row-reverse lg:text-right">
                  <Building2 size={14} className="text-brand-600 shrink-0 mt-0.5" strokeWidth={2.25} />
                  <span className="font-medium text-stone-800 break-words leading-snug" title={job.clientName}>
                    {job.clientName}
                  </span>
                </span>
              ) : null}
              <span className="inline-flex items-start gap-2 min-w-0 lg:flex-row-reverse lg:text-right">
                <MapPin size={14} className="text-brand-600 shrink-0 mt-0.5" strokeWidth={2.25} />
                <span className="break-words leading-snug line-clamp-3" title={formatPlaces(job)}>
                  {formatPlaces(job)}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className={cx('mt-4 grid grid-cols-1 gap-3', interactive && 'sm:grid-cols-2')}>
          {interactive ? (
            <div className="rounded-xl bg-stone-50/90 border border-stone-200/80 px-3.5 py-3 flex items-center gap-3 min-w-0 transition-all duration-200 hover:border-brand-300 hover:bg-white hover:shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">External recruiter</p>
                <p className="text-sm font-semibold text-stone-900 truncate">
                  {freelancer.name || freelancer.email || '—'}
                </p>
                <PresenceBadge status={desk.status} lastLabel={lastLabel} />
              </div>
              <PresenceAvatar
                name={freelancer.name}
                email={freelancer.email}
                photo={freelancer.profilePicture}
                size={40}
              />
            </div>
          ) : null}
          <div className="rounded-xl bg-stone-50/90 border border-stone-200/80 px-3.5 py-3 flex items-center gap-3 min-w-0 transition-all duration-200 hover:border-brand-300 hover:bg-white hover:shadow-sm">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Internal reviewer</p>
              <p className="text-sm font-semibold text-stone-900 truncate">
                {spoc.name || spoc.email || 'Unassigned'}
              </p>
              <p className="text-[12px] text-stone-500 truncate">
                {formatRoleLabel(spoc.role) || 'Company reviewer'}
              </p>
              {row.lastReassignment ? (
                <p className="text-[11px] text-violet-700 mt-1 font-medium break-words" title={`By ${row.lastReassignment.byName || 'teammate'}`}>
                  Transferred from {row.lastReassignment.fromName || 'previous owner'}
                </p>
              ) : null}
            </div>
            <span className="w-10 h-10 shrink-0 rounded-xl bg-stone-900 text-white flex items-center justify-center text-xs font-bold shadow-sm">
              {initials(spoc.name || spoc.email || 'HM')}
            </span>
          </div>
        </div>
      </header>

      <div
        ref={scroll.ref}
        className="overflow-x-auto overscroll-x-contain scrollbar-thin cursor-grab active:cursor-grabbing select-none bg-stone-50/50 border-b border-stone-100"
        onPointerDown={scroll.onPointerDown}
        onPointerMove={scroll.onPointerMove}
        onPointerUp={scroll.onPointerUp}
        onPointerCancel={scroll.onPointerUp}
      >
        <div className="flex gap-3.5 p-4 w-max min-w-full items-stretch">
          {stages.map((stage, i) => {
            const kind = kinds[i];
            const isCurrent = kind === 'current';
            const dropKey = `${row._id}:${stage.id}`;
            const isOver = overKey === dropKey && dragId === row._id;
            const StageIcon = stage.icon;
            const canDrop = canEdit && !isCurrent && kind !== 'done' && !saving;

            return (
              <div
                key={stage.id}
                className={cx(
                  'w-[260px] sm:w-[280px] md:w-[300px] flex-shrink-0 flex flex-col rounded-2xl border bg-white transition-all duration-200',
                  isOver ? 'border-brand-400 ring-2 ring-brand-200/70 bg-brand-50/40 scale-[1.01]' : 'border-stone-200/80',
                  isCurrent && (stage.soft || 'bg-stone-50')
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
                  if (id === row._id) onMove?.(row._id, stage.id);
                  setDragId(null);
                  setOverKey(null);
                } : undefined}
              >
                <div className={cx(
                  'px-3.5 py-3 border-b flex items-center gap-2.5 rounded-t-2xl',
                  isCurrent ? (stage.soft || 'bg-stone-50') : 'bg-stone-50/90',
                  isCurrent ? (stage.border || 'border-stone-100') : 'border-stone-100'
                )}
                >
                  <span className={cx(
                    'w-8 h-8 rounded-xl border bg-white flex items-center justify-center shrink-0',
                    isCurrent ? stage.border : 'border-stone-200',
                    isCurrent ? stage.text : 'text-stone-400'
                  )}
                  >
                    {kind === 'done'
                      ? <CheckCircle2 size={15} strokeWidth={2.25} />
                      : (StageIcon ? <StageIcon size={15} strokeWidth={2.25} /> : null)}
                  </span>
                  <h3 className={cx(
                    'font-semibold text-[12px] tracking-wide truncate',
                    isCurrent ? stage.text : 'text-stone-600'
                  )}
                  >
                    {stage.label}
                  </h3>
                  {isCurrent ? (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-white bg-gradient-to-r from-brand-600 to-teal-600 px-1.5 py-0.5 rounded-md shrink-0">
                      Current
                    </span>
                  ) : null}
                </div>

                <div className="flex-1 p-3 min-h-[168px]">
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
                        desk={desk}
                        dragging={dragId === row._id}
                      />
                    </div>
                  ) : (
                    <EmptyColumnSlot
                      stage={stage}
                      kind={kind}
                      interactive={canEdit}
                      disabled={saving}
                      onMove={(status) => onMove?.(row._id, status)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 sm:px-6 py-5 border-t border-stone-100 bg-gradient-to-b from-stone-50/50 to-white">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-[13px] font-semibold text-stone-800">Desk review</p>
            <p className="text-[12px] text-stone-500 mt-0.5">
              {archived
                ? 'This submission is archived. Restore it to continue the review cycle.'
                : 'Add reviewer notes and manage stage, ownership, or records'}
            </p>
          </div>
        </div>

        {interactive ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(240px,300px)] gap-4 items-start">
            {archived ? (
              <ReviewMemo
                text={row.feedback}
                at={row.reviewedAt || row.archivedAt}
                emptyLabel="No reviewer notes on this archived submission"
              />
            ) : (
              <ReviewComposer
                value={drafts[row._id] ?? row.feedback ?? ''}
                savedValue={row.feedback}
                saving={saving}
                startCollapsed
                onChange={(value) => onDraft?.(row._id, value)}
                onSave={(text) => onSaveNote?.(row._id, row.status, text)}
                label="Reviewer notes"
                helper="Shared with the freelance recruiter on their pipeline"
                placeholder="Document decision rationale for the freelance recruiter…"
                saveLabel="Save notes"
                addLabel="+ Add reviewer notes"
              />
            )}

            <div className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm">
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 pointer-events-none" />
              <div className="px-4 pt-4 pb-3 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Current stage</p>
                  <p className={`mt-1.5 inline-flex text-[12px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border ${currentStage.chip}`}>
                    {currentStage.label}
                  </p>
                </div>
                <p className="text-[12px] text-stone-500 leading-snug">
                  Update stage, transfer ownership, archive, or open the ATS record from one place.
                </p>
                {archived ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onRestore?.(row._id)}
                    className="w-full h-11 px-4 rounded-xl text-[13px] font-semibold text-brand-800 border border-brand-200 bg-brand-50 hover:bg-brand-100 inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <ArchiveRestore size={15} strokeWidth={2.25} />}
                    Restore submission
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setManageOpen(true)}
                  className="w-full h-11 px-4 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-brand-600 to-teal-600 hover:from-brand-700 hover:to-teal-700 shadow-sm shadow-brand-500/20 inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                >
                  <Settings2 size={15} strokeWidth={2.25} />
                  Manage submission
                </button>
              </div>
            </div>
          </div>
        ) : (
          <ReviewMemo
            text={row.feedback}
            at={row.reviewedAt}
            emptyLabel="No reviewer notes from the hiring team yet"
          />
        )}

        <HandoffManageModal
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          row={row}
          stages={stages}
          saving={saving}
          reviewers={reviewers}
          canHardDelete={canHardDelete}
          onMove={onMove}
          onOpenAts={onOpenAts}
          onArchive={onArchive}
          onRestore={onRestore}
          onReassign={onReassign}
          onEditCandidate={onEditCandidate}
          onHardDelete={onHardDelete}
        />
      </div>
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
}) {
  const [dragId, setDragId] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const list = stageFilter === 'all'
      ? [...rows]
      : rows.filter((row) => stageOf(row, stages) === stageFilter);
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

  if (!sorted.length) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-12 text-center text-sm text-stone-400">
        No submissions in this stage
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-20 rounded-2xl border border-stone-200/90 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <p className="text-[13px] font-semibold text-stone-800">
            {sorted.length} submission board{sorted.length === 1 ? '' : 's'}
            <span className="font-medium text-stone-400"> · newest first · {BOARD_PAGE_SIZE} per page</span>
          </p>
          <p className="text-[12px] text-stone-500">
            {interactive
              ? 'Drag the candidate card across stages · scroll columns horizontally'
              : 'Scroll horizontally · read-only view'}
          </p>
        </div>
        <DeskPager
          page={safePage}
          setPage={setPage}
          total={sorted.length}
          pageSize={BOARD_PAGE_SIZE}
          label="boards"
        />
      </div>

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
          onReassign={onReassign}
          onEditCandidate={onEditCandidate}
          onHardDelete={onHardDelete}
          dragId={dragId}
          setDragId={setDragId}
          overKey={overKey}
          setOverKey={setOverKey}
        />
      ))}

      <div className="rounded-2xl border border-stone-200/90 bg-white px-4 py-3 shadow-[var(--shadow-card)]">
        <DeskPager
          page={safePage}
          setPage={setPage}
          total={sorted.length}
          pageSize={BOARD_PAGE_SIZE}
          label="boards"
        />
      </div>
    </div>
  );
}
