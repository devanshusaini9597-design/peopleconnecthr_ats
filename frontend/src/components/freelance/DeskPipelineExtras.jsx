import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar, CheckCircle2, ClipboardList, History, Loader2,
  MessageSquareText, Pencil, XCircle,
} from 'lucide-react';
import Modal from '../ui/Modal';
import {
  pickCleanStageNote,
  resolveStageNotesHistory,
  stageBadgeTone,
} from './stageNoteUtils';

const CRITERIA = ['Skills fit', 'Experience', 'Communication', 'Culture fit'];
const RECS = [
  { value: 'strong_hire', label: 'Strong hire' },
  { value: 'hire', label: 'Hire' },
  { value: 'hold', label: 'Hold' },
  { value: 'no_hire', label: 'No hire' },
];

function relativeTime(value) {
  if (!value) return '';
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function pickStageScorecard(row, stageLabel) {
  const list = Array.isArray(row.stageScorecards) ? row.stageScorecards : [];
  const want = String(stageLabel || '').trim().toLowerCase();
  const hit = list.find((s) => String(s.stage || '').toLowerCase() === want);
  if (hit) return hit;
  // Legacy single scorecard fallback
  if (row.scorecard?.recommendation || row.scorecard?.scores?.length) return row.scorecard;
  return {};
}

/**
 * Hiring-review actions as enterprise modals (backdrop click does not dismiss).
 * Notes + scorecards are stage-wise — full history in Notes, edit current stage.
 */
export default function DeskPipelineExtras({
  row,
  stageLabel = '',
  saving = false,
  canManageDesk = false,
  archived = false,
  drafts = {},
  onDraft,
  onSaveNote,
  onSaveScorecard,
  onDecideApproval,
  onScheduleInterview,
}) {
  const [panel, setPanel] = useState(null); // notes | scorecard | audit
  const existing = pickStageScorecard(row, stageLabel);
  const [recommendation, setRecommendation] = useState(existing.recommendation || 'hire');
  const [summary, setSummary] = useState(existing.summary || '');
  const [scores, setScores] = useState(() => {
    const map = Object.fromEntries((existing.scores || []).map((s) => [s.criterion, s.score]));
    return CRITERIA.map((c) => ({ criterion: c, score: map[c] || 3 }));
  });
  const [busy, setBusy] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [auditVisible, setAuditVisible] = useState(5);
  const stageNote = pickCleanStageNote(row, stageLabel);
  const noteDraft = drafts[row._id] ?? stageNote;
  const notesHistory = useMemo(
    () => resolveStageNotesHistory(row, stageLabel),
    [row.stageNotes, row.feedback, row.reviewedAt, row.updatedAt, stageLabel]
  );
  const priorHistory = useMemo(() => {
    const want = String(stageLabel || '').trim().toLowerCase();
    return notesHistory.filter((n) => String(n.stage || '').toLowerCase() !== want);
  }, [notesHistory, stageLabel]);
  const currentHistoryEntry = useMemo(() => {
    const want = String(stageLabel || '').trim().toLowerCase();
    return notesHistory.find((n) => String(n.stage || '').toLowerCase() === want) || null;
  }, [notesHistory, stageLabel]);

  useEffect(() => {
    if (panel !== 'scorecard') return;
    const next = pickStageScorecard(row, stageLabel);
    setRecommendation(next.recommendation || 'hire');
    setSummary(next.summary || '');
    const map = Object.fromEntries((next.scores || []).map((s) => [s.criterion, s.score]));
    setScores(CRITERIA.map((c) => ({ criterion: c, score: map[c] || 3 })));
  }, [panel, row._id, stageLabel, row.stageScorecards, row.scorecard]);

  useEffect(() => {
    if (panel !== 'notes') {
      setEditingNotes(false);
      return;
    }
    const clean = pickCleanStageNote(row, stageLabel);
    if (drafts[row._id] === undefined) onDraft?.(row._id, clean);
    // Open editor only when there is nothing to show yet
    setEditingNotes(!clean);
  }, [panel, row._id, stageLabel, row.stageNotes, row.feedback]);

  useEffect(() => {
    if (panel === 'audit') setAuditVisible(5);
  }, [panel, row._id]);

  const history = useMemo(() => {
    const list = Array.isArray(row.history) ? [...row.history] : [];
    return list.reverse().slice(0, 80);
  }, [row.history]);
  const visibleAudit = history.slice(0, auditVisible);
  const auditHasMore = auditVisible < history.length;

  const approval = row.approval || {};
  const pending = approval.status === 'pending';
  const hasNotes = Boolean(stageNote) || notesHistory.length > 0;
  const hasScore = Boolean(existing.recommendation || existing.scores?.length);

  const closeNotes = () => {
    setEditingNotes(false);
    setPanel(null);
  };

  const startEditNotes = () => {
    onDraft?.(row._id, pickCleanStageNote(row, stageLabel));
    setEditingNotes(true);
  };

  const saveScore = async () => {
    setBusy(true);
    try {
      await onSaveScorecard?.(row._id, {
        stage: stageLabel,
        recommendation,
        scores,
        summary,
      });
      setPanel(null);
    } finally {
      setBusy(false);
    }
  };

  const saveNotes = async () => {
    setBusy(true);
    try {
      const ok = await onSaveNote?.(
        row._id,
        stageLabel || row._submissionStatus || row.status,
        String(noteDraft || '').trim()
      );
      if (ok !== false) {
        setEditingNotes(false);
        setPanel(null);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {pending ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-amber-950 font-medium min-w-0 flex-1">
            Approval pending → <span className="font-semibold">{approval.targetAtsStage || approval.targetStage}</span>
            {approval.requestedByName ? ` · by ${approval.requestedByName}` : ''}
          </p>
          {canManageDesk ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={saving || busy}
                onClick={() => onDecideApproval?.(row._id, 'approve')}
                className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 inline-flex items-center gap-1 disabled:opacity-50"
              >
                <CheckCircle2 size={12} /> Approve
              </button>
              <button
                type="button"
                disabled={saving || busy}
                onClick={() => onDecideApproval?.(row._id, 'reject')}
                className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-stone-700 border border-stone-200 bg-white hover:bg-stone-50 inline-flex items-center gap-1 disabled:opacity-50"
              >
                <XCircle size={12} /> Reject
              </button>
            </div>
          ) : (
            <span className="text-[10px] font-semibold text-amber-800">Waiting for owner / manager</span>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {!archived ? (
          <button
            type="button"
            onClick={() => setPanel('notes')}
            className="h-8 px-2.5 rounded-lg border border-stone-200 bg-white text-[11px] font-semibold text-stone-700 hover:border-brand-300 hover:bg-brand-50/40 inline-flex items-center gap-1.5 shadow-sm"
          >
            <MessageSquareText size={13} className="text-brand-600" />
            Notes
            {hasNotes ? <span className="text-stone-400 font-medium">· saved</span> : null}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setPanel('scorecard')}
          className="h-8 px-2.5 rounded-lg border border-stone-200 bg-white text-[11px] font-semibold text-stone-700 hover:border-brand-300 hover:bg-brand-50/40 inline-flex items-center gap-1.5 shadow-sm"
        >
          <ClipboardList size={13} className="text-brand-600" />
          Scorecard
          {hasScore ? (
            <span className="text-stone-400 font-medium">· {String(existing.recommendation || '').replace('_', ' ')}</span>
          ) : null}
        </button>
        {row.applicationId ? (
          <button
            type="button"
            onClick={() => onScheduleInterview?.(row)}
            className="h-8 px-2.5 rounded-lg border border-stone-200 bg-white text-[11px] font-semibold text-stone-700 hover:border-brand-300 hover:bg-brand-50/40 inline-flex items-center gap-1.5 shadow-sm"
          >
            <Calendar size={13} className="text-brand-600" />
            Interview
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setPanel('audit')}
          className="h-8 px-2.5 rounded-lg border border-stone-200 bg-white text-[11px] font-semibold text-stone-700 hover:border-brand-300 hover:bg-brand-50/40 inline-flex items-center gap-1.5 shadow-sm"
        >
          <History size={13} className="text-brand-600" />
          Audit
          <span className="text-stone-400 tabular-nums">{history.length}</span>
        </button>
      </div>

      <Modal
        open={panel === 'notes'}
        onClose={closeNotes}
        closeOnBackdrop={false}
        title="Stage notes"
        description="Current stage is editable. Earlier stages stay as history."
        icon={MessageSquareText}
        size="md"
        footer={(
          editingNotes ? (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  onDraft?.(row._id, stageNote);
                  setEditingNotes(false);
                  if (!stageNote) closeNotes();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || saving || !String(noteDraft || '').trim()}
                onClick={saveNotes}
              >
                {busy || saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Save notes
              </button>
            </>
          ) : (
            <button type="button" className="btn-secondary" onClick={closeNotes}>Close</button>
          )
        )}
      >
        <div className="space-y-4">
          {/* Current stage — view or edit */}
          <section className="rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/80 via-white to-white p-3.5 shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span
                  className={`inline-flex items-center h-6 px-2.5 rounded-full border text-[10px] font-bold uppercase tracking-[0.06em] ${stageBadgeTone(stageLabel || 'Current')}`}
                >
                  {stageLabel || 'Current'}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-teal-700/80">
                  Current stage
                </span>
              </div>
              {!editingNotes ? (
                <button
                  type="button"
                  onClick={startEditNotes}
                  className="shrink-0 h-8 w-8 rounded-lg border border-teal-200 bg-white text-teal-700 hover:bg-teal-50 hover:border-teal-300 inline-flex items-center justify-center shadow-sm"
                  title="Edit current stage review"
                  aria-label="Edit current stage review"
                >
                  <Pencil size={14} strokeWidth={2.25} />
                </button>
              ) : null}
            </div>

            {editingNotes ? (
              <div className="space-y-1.5">
                <textarea
                  value={noteDraft}
                  onChange={(e) => onDraft?.(row._id, e.target.value)}
                  rows={5}
                  maxLength={4000}
                  autoFocus
                  placeholder={`Review for ${stageLabel || 'this stage'}…`}
                  className="textarea-ats !min-h-[120px] !bg-white"
                />
                <p className="text-[11px] text-stone-400 tabular-nums text-right">
                  {String(noteDraft || '').length}/4000
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-stone-800 whitespace-pre-wrap break-words leading-relaxed min-h-[3rem]">
                {stageNote || (
                  <span className="text-stone-400 italic">No review for this stage yet — click the pencil to add one.</span>
                )}
              </p>
            )}

            {!editingNotes && currentHistoryEntry?.updatedAt ? (
              <p className="mt-2 text-[10.5px] text-stone-400 tabular-nums">
                {relativeTime(currentHistoryEntry.updatedAt)}
              </p>
            ) : null}
          </section>

          {/* Prior stages — history with badges */}
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <History size={13} className="text-stone-400" strokeWidth={2.25} />
              <p className="text-[11px] font-semibold text-stone-600 tracking-wide">Stage history</p>
            </div>
            {priorHistory.length ? (
              <ul className="space-y-2.5 max-h-56 overflow-y-auto pr-0.5">
                {priorHistory.map((entry, idx) => (
                  <li
                    key={`${entry.stage}-${entry.updatedAt || idx}`}
                    className="rounded-xl border border-stone-200/90 bg-stone-50/90 px-3.5 py-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`inline-flex items-center h-6 px-2.5 rounded-full border text-[10px] font-bold uppercase tracking-[0.06em] ${stageBadgeTone(entry.stage)}`}
                      >
                        {entry.stage || 'Stage'}
                      </span>
                      <span className="text-[10px] text-stone-400 tabular-nums shrink-0">
                        {relativeTime(entry.updatedAt)}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-stone-700 whitespace-pre-wrap break-words leading-relaxed">
                      {entry.note}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50 px-3.5 py-4 text-[12px] text-stone-400 text-center">
                Earlier stage reviews will appear here as the candidate moves through the pipeline.
              </p>
            )}
          </section>
        </div>
      </Modal>

      <Modal
        open={panel === 'scorecard'}
        onClose={() => setPanel(null)}
        closeOnBackdrop={false}
        title="Stage scorecard"
        description={`Structured ratings for ${stageLabel || 'current stage'}.`}
        icon={ClipboardList}
        size="md"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setPanel(null)}>Cancel</button>
            <button type="button" className="btn-primary" disabled={busy} onClick={saveScore}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              Save scorecard
            </button>
          </>
        )}
      >
        <div className="space-y-3">
          <span className="inline-flex items-center h-6 px-2 rounded-md border border-brand-200 bg-brand-50 text-[10px] font-bold uppercase tracking-wide text-brand-800">
            Stage · {stageLabel || 'Current'}
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            {scores.map((rowScore, idx) => (
              <label key={rowScore.criterion} className="rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2.5">
                <span className="text-[11px] font-semibold text-stone-800">{rowScore.criterion}</span>
                <select
                  className="mt-1.5 w-full h-9 rounded-lg border border-stone-200 bg-white text-[13px] px-2 font-semibold"
                  value={rowScore.score}
                  onChange={(e) => {
                    const next = [...scores];
                    next[idx] = { ...next[idx], score: Number(e.target.value) };
                    setScores(next);
                  }}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n} / 5</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div>
            <p className="text-[11px] font-semibold text-stone-600 mb-1.5">Recommendation</p>
            <div className="flex flex-wrap gap-1.5">
              {RECS.map((rec) => (
                <button
                  key={rec.value}
                  type="button"
                  onClick={() => setRecommendation(rec.value)}
                  className={`h-8 px-2.5 rounded-lg text-[11px] font-semibold border ${
                    recommendation === rec.value
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-stone-700 border-stone-200 hover:border-brand-300'
                  }`}
                >
                  {rec.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Short rationale for this stage…"
            className="textarea-ats !min-h-[88px]"
          />
        </div>
      </Modal>

      <Modal
        open={panel === 'audit'}
        onClose={() => setPanel(null)}
        closeOnBackdrop={false}
        title="Audit trail"
        description="Who moved this handoff and when. Close with the X button only."
        icon={History}
        size="md"
        footer={(
          <button type="button" className="btn-secondary" onClick={() => setPanel(null)}>Close</button>
        )}
      >
        {history.length === 0 ? (
          <p className="text-[13px] text-stone-400 py-6 text-center">No audit events yet.</p>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-2">
              {visibleAudit.map((ev, i) => (
                <li
                  key={`${ev.at}-${i}`}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 flex items-start gap-3"
                >
                  <span className="text-[11px] text-stone-400 tabular-nums shrink-0 w-14 pt-0.5">
                    {relativeTime(ev.at)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-stone-800 capitalize">
                      {String(ev.action || '').replace(/_/g, ' ')}
                    </p>
                    <p className="text-[12px] text-stone-500 mt-0.5">
                      {ev.byName || 'System'}
                      {ev.meta?.status || ev.meta?.atsStage
                        ? ` → ${ev.meta.atsStage || ev.meta.status}`
                        : ''}
                      {ev.meta?.stage ? ` · ${ev.meta.stage}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {auditHasMore ? (
              <button
                type="button"
                onClick={() => setAuditVisible((n) => n + 10)}
                className="w-full h-9 rounded-xl border border-stone-200 bg-stone-50 text-[12px] font-semibold text-stone-700 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-800 transition-colors"
              >
                {auditVisible <= 5 ? 'View history' : 'View more'}
                <span className="ml-1.5 text-stone-400 font-medium tabular-nums">
                  (+{Math.min(10, history.length - auditVisible)} of {history.length - auditVisible} left)
                </span>
              </button>
            ) : history.length > 5 ? (
              <p className="text-center text-[11px] text-stone-400 tabular-nums">
                Showing all {history.length} events
              </p>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}
