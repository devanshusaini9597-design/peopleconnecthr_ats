import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Loader2, Send, ArrowLeft, Clock, FileEdit, Link2, RefreshCw, Archive, Pencil, Copy, Trash2,
  Inbox, BadgeCheck, Layers, UserCheck, Flag, UserMinus,
} from 'lucide-react';
import { authenticatedFetch } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import EmptyState from '../ui/EmptyState';
import ConfirmationModal from '../ConfirmationModal';
import PresenceAvatar from '../ui/PresenceAvatar';
import PipelineStageSummary from '../ui/PipelineStageSummary';
import useTableDragScroll from '../../hooks/useTableDragScroll';
import { guardTableCopy } from '../../utils/tableCopyGuard';
import { STATUS_BADGE, actionBtn } from './assessmentsConstants';
import { InviteModal } from './InviteModal';
import { GradeModal } from './GradeModal';

const PIPELINE = [
  { id: 'all', label: 'All invitations', icon: Layers },
  { id: 'pending', label: 'Not started', icon: Inbox },
  { id: 'joined', label: 'Joined', icon: BadgeCheck },
  { id: 'in_progress', label: 'In progress', icon: Clock },
  { id: 'submitted', label: 'Pending review', icon: FileEdit },
  { id: 'graded', label: 'Graded', icon: UserCheck },
  { id: 'expired', label: 'Expired', icon: Flag },
];

function inviteStage(row) {
  if (row.status === 'pending' && row.openedAt) return 'joined';
  return row.status || 'pending';
}

function statusLabel(row) {
  const stage = inviteStage(row);
  if (stage === 'joined') return 'joined';
  return String(row.status || '').replace('_', ' ');
}

const DECISION_STYLE = {
  shortlist: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  advance: 'border-brand-200 bg-brand-50 text-brand-800',
  reject: 'border-rose-200 bg-rose-50 text-rose-800',
};

const DECISION_LABEL = {
  shortlist: 'Shortlisted',
  advance: 'Advanced',
  reject: 'Rejected',
};

const AUDIT_COPY = {
  'assessment.published': { title: 'Version published', tone: 'brand' },
  'assessment.invited': { title: 'Invitation sent', tone: 'brand' },
  'assessment.submitted': { title: 'Candidate submitted', tone: 'emerald' },
  'assessment.graded': { title: 'Evaluation recorded', tone: 'emerald' },
  'assessment.decision': { title: 'Hiring decision', tone: 'violet' },
  'assessment.revoked': { title: 'Invitation revoked', tone: 'amber' },
  'assessment.invite_removed': { title: 'Candidate removed', tone: 'rose' },
};

const AUDIT_TONE = {
  brand: 'bg-brand-50 text-brand-800 border-brand-100',
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-100',
  violet: 'bg-violet-50 text-violet-800 border-violet-100',
  amber: 'bg-amber-50 text-amber-800 border-amber-100',
  rose: 'bg-rose-50 text-rose-800 border-rose-100',
};

export const AssessmentDetail = ({ assessment, onBack, onEdit, onUpdated, access, onDelete, onDuplicate }) => {
  const toast = useToast();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [gradingInvite, setGradingInvite] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [resendingId, setResendingId] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [ranking, setRanking] = useState([]);
  const [audit, setAudit] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [decisionReason, setDecisionReason] = useState('');
  const {
    tableScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
  } = useTableDragScroll();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/assessments/invites?assessmentId=${assessment._id}`);
      const data = await res.json();
      if (data.success) setInvites(data.data || []);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [assessment._id]);

  const loadRanking = useCallback(async () => {
    const res = await authenticatedFetch(`/api/assessments/results?assessmentId=${assessment._id}`);
    const data = await res.json();
    if (data.success) setRanking(data.data || []);
    const auditRes = await authenticatedFetch(`/api/assessments/${assessment._id}/audit`);
    const auditData = await auditRes.json();
    if (auditData.success) setAudit(auditData.data || []);
  }, [assessment._id]);

  useEffect(() => {
    load();
    loadRanking();
    const timer = setInterval(() => {
      load(true);
      loadRanking();
    }, 4000);
    return () => clearInterval(timer);
  }, [load, loadRanking]);

  const copyLink = async (invite) => {
    if (!invite?.token) {
      toast?.error?.('This invite has no link yet');
      return;
    }
    const url = `${window.location.origin}/assessment/${invite.token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast?.success?.('Assessment link copied');
    } catch {
      toast?.error?.('Could not copy the link');
    }
  };

  const openGrade = async (invite) => {
    const res = await authenticatedFetch(`/api/assessments/invites/${invite._id}`);
    const data = await res.json();
    if (data.success) setGradingInvite(data.data);
  };

  const resend = async (invite) => {
    setResendingId(invite._id);
    try {
      const res = await authenticatedFetch(`/api/assessments/invites/${invite._id}/resend`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Could not resend the link');
        return;
      }
      toast?.success?.(data.data?.emailSent ? 'A fresh link was emailed' : 'Link refreshed, but the email did not send');
      load(true);
    } catch (err) {
      toast?.error?.(err?.message || 'Could not resend the link');
    } finally {
      setResendingId('');
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const res = await authenticatedFetch(`/api/assessments/${assessment._id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Could not publish');
        return;
      }
      toast?.success?.(`Published version ${data.data.version}. New attempts will use this version.`);
      onUpdated?.(data.data);
    } catch (err) {
      toast?.error?.(err?.message || 'Could not publish');
    } finally {
      setPublishing(false);
    }
  };

  const decide = async (invite, decision, reason) => {
    if (decision === 'reject' && !String(reason || '').trim()) {
      toast?.error?.('A reason is required to reject');
      return false;
    }
    const res = await authenticatedFetch(`/api/assessments/invites/${invite._id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason: reason || '' }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      toast?.error?.(data.message || 'Could not record decision');
      return false;
    }
    toast?.success?.('Decision saved. The candidate has been notified by email.');
    load(true);
    loadRanking();
    return true;
  };

  const revoke = async (invite) => {
    const res = await authenticatedFetch(`/api/assessments/invites/${invite._id}/revoke`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      toast?.error?.(data.message || 'Could not revoke');
      return;
    }
    toast?.success?.('Invitation revoked');
    load(true);
  };

  const removeCandidate = async (invite) => {
    const res = await authenticatedFetch(`/api/assessments/invites/${invite._id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      toast?.error?.(data.message || 'Could not remove this candidate');
      return;
    }
    toast?.success?.(`${invite.candidateId?.name || 'Candidate'} was removed from this assessment`);
    load(true);
    loadRanking();
  };

  const toggleArchive = async () => {
    setArchiving(true);
    try {
      const res = await authenticatedFetch(`/api/assessments/${assessment._id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: assessment.isActive === false }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast?.error?.(data.message || 'Could not update the assessment');
        return;
      }
      toast?.success?.(assessment.isActive === false ? 'Assessment restored' : 'Assessment archived');
      onUpdated?.(data.data);
    } catch (err) {
      toast?.error?.(err?.message || 'Could not update the assessment');
    } finally {
      setArchiving(false);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    if (confirm.kind === 'decision' && confirm.decision === 'reject' && !decisionReason.trim()) {
      toast?.error?.('A reason is required to reject');
      return;
    }
    setConfirmBusy(true);
    try {
      if (confirm.kind === 'revoke') await revoke(confirm.invite);
      if (confirm.kind === 'resend') await resend(confirm.invite);
      if (confirm.kind === 'remove') await removeCandidate(confirm.invite);
      if (confirm.kind === 'archive') await toggleArchive();
      if (confirm.kind === 'publish') await publish();
      if (confirm.kind === 'decision') {
        const ok = await decide(confirm.invite, confirm.decision, decisionReason);
        if (!ok) return;
      }
      setConfirm(null);
      setDecisionReason('');
    } finally {
      setConfirmBusy(false);
    }
  };

  const counts = PIPELINE.reduce((acc, item) => {
    acc[item.id] = item.id === 'all' ? invites.length : invites.filter((row) => inviteStage(row) === item.id).length;
    return acc;
  }, {});
  const visible = statusFilter === 'all' ? invites : invites.filter((row) => inviteStage(row) === statusFilter);
  const archived = assessment.isActive === false;
  const canEdit = access?.edit !== false && typeof onEdit === 'function';
  const canInvite = access?.invite !== false;
  const canGrade = access?.grade !== false;
  const canArchive = access?.archive !== false;
  const canPublish = access?.publish !== false;
  const canDecide = access?.decide === true;
  const canDuplicate = typeof onDuplicate === 'function';
  const canRemove = typeof onDelete === 'function';

  return (
    <div className="space-y-6 animate-page-enter">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to assessments
      </button>

      <div className="rounded-2xl border border-stone-200/90 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <div className="icon-box-ats !w-12 !h-12">
            <ClipboardList strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight" style={{ letterSpacing: '-0.025em' }}>
              {assessment.title}
            </h2>
            <p className="text-sm text-stone-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" /> {assessment.questions?.length || 0} questions</span>
              <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {assessment.durationMinutes} min</span>
              <span className="badge-neutral">{assessment.maxScore} pts max</span>
              <span className={STATUS_BADGE[assessment.status] || 'badge-neutral'}>{assessment.status || 'draft'}{assessment.version ? ` v${assessment.version}` : ''}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {canPublish && assessment.status !== 'archived' ? (
            <button type="button" onClick={() => setConfirm({ kind: 'publish' })} className="btn-secondary" disabled={publishing}>
              {publishing ? 'Publishing…' : 'Publish version'}
            </button>
          ) : null}
          {canEdit ? (
          <button type="button" onClick={() => onEdit(assessment)} className="btn-secondary">
            <Pencil className="w-4 h-4" /> Edit
          </button>
          ) : null}
          {canDuplicate ? (
          <button type="button" onClick={() => onDuplicate(assessment)} className="btn-secondary">
            <Copy className="w-4 h-4" /> Duplicate
          </button>
          ) : null}
          {canRemove ? (
          <button type="button" onClick={() => onDelete(assessment)} className="btn-secondary text-red-600 hover:border-red-200">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
          ) : null}
          {canArchive ? (
          <button type="button" onClick={() => setConfirm({ kind: 'archive' })} className="btn-secondary" disabled={archiving}>
            <Archive className="w-4 h-4" /> {archived ? 'Restore' : 'Archive'}
          </button>
          ) : null}
          {canInvite ? (
          <button type="button" onClick={() => setShowInvite(true)} className="btn-primary" disabled={archived} title={archived ? 'Restore to send more invites' : 'Send another invite anytime'}>
            <Send className="w-4 h-4" /> Invite
          </button>
          ) : null}
        </div>
        </div>
      </div>

      {archived ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          This test is archived. Existing links stay as they are. Restore it before sending new invites.
        </p>
      ) : null}

      <PipelineStageSummary
        stages={PIPELINE}
        getCount={(stage) => counts[stage.id] || 0}
        stageFilter={statusFilter}
        setStageFilter={setStatusFilter}
        total={invites.length}
        hint="Live invitation pipeline — updates when a candidate opens the link"
        countLabel="invitations"
        toggleOff={false}
      />

      <div className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)] overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-2">
            <Loader2 className="w-7 h-7 text-brand-600 animate-spin" />
            <p className="text-sm text-stone-500 font-medium">Loading invites…</p>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            tone="sky"
            message={invites.length === 0 ? 'No invitations sent' : 'No candidates in this stage'}
            subMessage={invites.length === 0 ? 'Invite a candidate to complete this assessment.' : 'Select another stage, or invite an additional candidate.'}
            action={invites.length === 0 ? (
              <button type="button" onClick={() => setShowInvite(true)} className="btn-primary" disabled={archived}>
                <Send className="w-4 h-4" /> Invite Candidate
              </button>
            ) : (
              <button type="button" onClick={() => setStatusFilter('all')} className="btn-secondary">Show all</button>
            )}
          />
        ) : (
          <div
            ref={tableScrollRef}
            className="cand-table-scroll overflow-x-auto select-none"
            onCopy={guardTableCopy}
            onMouseDown={onTableDragScrollStart}
            onMouseMove={onTableDragScrollMove}
            onMouseUp={onTableDragScrollEnd}
            onMouseLeave={onTableDragScrollEnd}
          >
            <table className="cand-table-drag w-full text-left border-collapse min-w-[880px] select-none border border-stone-200">
              <thead>
                <tr className="bg-stone-100">
                  {['Candidate', 'Score', 'Risk', 'Status', 'Activity', 'Actions'].map((label) => (
                    <th
                      key={label}
                      className={`px-3.5 py-3.5 text-[10px] font-bold text-stone-600 uppercase tracking-wider whitespace-nowrap border border-stone-200 bg-stone-100 ${label === 'Actions' ? 'text-right' : ''}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((inv, rowIndex) => (
                  <tr key={inv._id} className={`transition-colors ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'} hover:bg-brand-50/50`}>
                    <td className="px-3.5 py-3 text-sm border border-stone-200 align-middle min-w-[200px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PresenceAvatar name={inv.candidateId?.name} email={inv.candidateId?.email} size={32} />
                        <div className="min-w-0">
                          <p className="font-semibold text-stone-900 truncate">{inv.candidateId?.name}</p>
                          <p className="text-xs text-stone-500 truncate">{inv.candidateId?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-sm border border-stone-200 align-middle tabular-nums font-semibold text-stone-800 whitespace-nowrap">
                      {inv.totalScore !== undefined && inv.totalScore !== null
                        ? `${inv.totalScore}/${inv.maxScore || assessment.maxScore}`
                        : '—'}
                    </td>
                    <td className="px-3.5 py-3 text-sm border border-stone-200 align-middle whitespace-nowrap">
                      {inv.proctoring?.flagged || inv.proctoring?.riskScore > 0 || inv.proctoring?.tabSwitchCount ? (
                        <span className={`${inv.proctoring?.flagged ? 'badge-danger' : 'badge-warning'} text-[10px]`}>
                          Risk {inv.proctoring.riskScore || 0}
                          {inv.proctoring?.tabSwitchCount ? ` · ${inv.proctoring.tabSwitchCount} tab` : ''}
                        </span>
                      ) : inv.proctoring?.snapshotCount ? (
                        <span className="badge-neutral text-[10px]">{inv.proctoring.snapshotCount} webcam</span>
                      ) : '—'}
                    </td>
                    <td className="px-3.5 py-3 text-sm border border-stone-200 align-middle whitespace-nowrap">
                      <span className={inviteStage(inv) === 'joined' ? 'badge-brand' : (STATUS_BADGE[inv.status] || 'badge-neutral')}>
                        {statusLabel(inv)}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-xs text-stone-500 border border-stone-200 align-middle whitespace-nowrap">
                      {inv.submittedAt
                        ? `Submitted ${new Date(inv.submittedAt).toLocaleString()}`
                        : inv.startedAt
                          ? `Started ${new Date(inv.startedAt).toLocaleString()}`
                          : inv.openedAt
                            ? `Joined ${new Date(inv.openedAt).toLocaleString()}`
                            : 'Waiting'}
                    </td>
                    <td className="px-3.5 py-3 text-sm border border-stone-200 align-middle whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => copyLink(inv)} className={actionBtn} title="Copy assessment link" aria-label="Copy assessment link">
                          <Link2 size={14} />
                        </button>
                        {canInvite && inv.status !== 'submitted' && inv.status !== 'graded' && (
                          <button type="button" onClick={() => setConfirm({ kind: 'resend', invite: inv })} disabled={resendingId === inv._id} className={actionBtn} title="Send a fresh 72-hour link">
                            <RefreshCw size={14} className={resendingId === inv._id ? 'animate-spin' : ''} />
                          </button>
                        )}
                        {canInvite && ['pending', 'expired', 'in_progress'].includes(inv.status) && (
                          <button type="button" onClick={() => setConfirm({ kind: 'revoke', invite: inv })} className="text-xs font-semibold text-red-600 px-2">Revoke</button>
                        )}
                        {canInvite ? (
                          <button
                            type="button"
                            onClick={() => setConfirm({ kind: 'remove', invite: inv })}
                            className={actionBtn}
                            title="Remove candidate from this assessment"
                            aria-label="Remove candidate"
                          >
                            <UserMinus size={14} />
                          </button>
                        ) : null}
                        {canGrade && (inv.status === 'submitted' || inv.status === 'graded') && (
                          <button type="button" onClick={() => openGrade(inv)} className={actionBtn} title="Review & grade">
                            <FileEdit size={14} />
                          </button>
                        )}
                        {canDecide && (inv.status === 'submitted' || inv.status === 'graded') && inv.scoringStatus !== 'pending_review' && (
                          inv.decision && inv.decision !== 'none' ? (
                            <button
                              type="button"
                              onClick={() => { setDecisionReason(inv.decisionReason || ''); setConfirm({ kind: 'decision', invite: inv, decision: inv.decision }); }}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${DECISION_STYLE[inv.decision] || 'badge-neutral'}`}
                              title="Change hiring decision"
                            >
                              {DECISION_LABEL[inv.decision] || inv.decision}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setDecisionReason(''); setConfirm({ kind: 'pick-decision', invite: inv }); }}
                              className="btn-secondary !text-[11px] !py-1 !px-2.5"
                            >
                              Record decision
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ranking[0]?.ranking?.length ? (
        <section className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)] overflow-hidden">
          <div className="h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="p-4 sm:p-5">
            <h3 className="text-sm font-bold text-stone-900 tracking-tight">Ranking</h3>
            <p className="text-xs text-stone-500 mt-0.5">Candidates on the same published version, ordered by score.</p>
            <div className="mt-3 space-y-2">
              {ranking[0].ranking.slice(0, 20).map((row) => (
                <div key={row._id} className="flex items-center justify-between gap-3 text-sm rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2.5">
                  <span className="font-semibold text-stone-800 min-w-0 truncate">
                    <span className="tabular-nums text-stone-400 mr-2">#{row.rank}</span>
                    {row.candidateId?.name}
                  </span>
                  <span className="tabular-nums text-stone-600 text-xs font-semibold whitespace-nowrap">
                    {row.totalScore}/{row.maxScore}
                    {row.skillBreakdown?.length ? ` · ${row.skillBreakdown.map((s) => `${s.skill} ${s.percent}%`).join(', ')}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {audit.length ? (
        <section className="rounded-2xl border border-stone-200/90 bg-white shadow-[var(--shadow-card)] overflow-hidden">
          <div className="h-[3px] bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="p-4 sm:p-5">
            <h3 className="text-sm font-bold text-stone-900 tracking-tight">Activity log</h3>
            <p className="text-xs text-stone-500 mt-0.5">Invitations, submissions, evaluations, and hiring decisions for this assessment.</p>
            <ol className="mt-3 space-y-2">
              {audit.slice(0, 20).map((row) => {
                const meta = AUDIT_COPY[row.action] || { title: String(row.action || 'Event').replace(/^assessment\./, '').replace(/_/g, ' '), tone: 'brand' };
                const extra = row.details?.message || row.message;
                return (
                  <li key={row._id} className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5">
                    <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${AUDIT_TONE[meta.tone] || AUDIT_TONE.brand}`}>
                      {meta.title}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-stone-700">
                        {row.userId?.name || 'System'}
                        {extra ? ` · ${extra}` : ''}
                      </p>
                      <p className="text-[11px] text-stone-400 mt-0.5 tabular-nums">
                        {row.timestamp ? new Date(row.timestamp).toLocaleString() : ''}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      ) : null}

      <InviteModal assessment={assessment} open={showInvite} onClose={() => setShowInvite(false)} onSent={load} />
      <GradeModal
        invite={gradingInvite}
        open={!!gradingInvite}
        onClose={() => setGradingInvite(null)}
        onGraded={load}
      />
      <ConfirmationModal
        isOpen={!!confirm}
        onClose={() => { if (!confirmBusy) { setConfirm(null); setDecisionReason(''); } }}
        onConfirm={runConfirm}
        isLoading={confirmBusy || archiving || publishing || Boolean(resendingId)}
        type={confirm?.kind === 'remove' || confirm?.kind === 'revoke' ? 'delete' : confirm?.kind === 'decision' && confirm?.decision === 'reject' ? 'danger' : confirm?.kind === 'archive' ? 'warning' : 'share'}
        title={
          confirm?.kind === 'revoke' ? `Revoke ${confirm.invite?.candidateId?.name || 'this invitation'}?`
            : confirm?.kind === 'resend' ? `Resend the assessment link?`
            : confirm?.kind === 'remove' ? `Remove ${confirm.invite?.candidateId?.name || 'this candidate'}?`
            : confirm?.kind === 'archive' ? (archived ? 'Restore this assessment?' : 'Archive this assessment?')
            : confirm?.kind === 'publish' ? 'Publish this version?'
            : confirm?.kind === 'pick-decision' ? `Record a hiring decision for ${confirm.invite?.candidateId?.name || 'this candidate'}?`
            : confirm?.kind === 'decision' ? `${confirm.decision === 'reject' ? 'Reject' : confirm.decision === 'advance' ? 'Advance' : 'Shortlist'} ${confirm.invite?.candidateId?.name || 'this candidate'}?`
            : 'Confirm'
        }
        message={
          confirm?.kind === 'revoke' ? 'The current link will stop working immediately. You can send a new invitation later.'
            : confirm?.kind === 'resend' ? `A fresh 72-hour link will be emailed to ${confirm.invite?.candidateId?.email || 'the candidate'}.`
            : confirm?.kind === 'remove' ? 'This removes the candidate from this assessment, including any submission, grade, and integrity data. This cannot be undone.'
            : confirm?.kind === 'archive' ? (archived ? 'Restored assessments can receive new invitations.' : 'Existing links stay valid. Restore before sending new invitations.')
            : confirm?.kind === 'publish' ? 'New attempts will use this version. Candidates already in progress keep the version they started.'
            : confirm?.kind === 'pick-decision' ? 'Shortlist, advance, or reject. The candidate is notified by email, and the application pipeline is updated when a job is linked.'
            : confirm?.kind === 'decision' ? `This records a ${confirm.decision} decision. The candidate will receive an email, and a linked application will move in the pipeline.`
            : ''
        }
        confirmText={
          confirm?.kind === 'revoke' ? 'Revoke'
            : confirm?.kind === 'resend' ? 'Send link'
            : confirm?.kind === 'remove' ? 'Remove'
            : confirm?.kind === 'archive' ? (archived ? 'Restore' : 'Archive')
            : confirm?.kind === 'publish' ? 'Publish'
            : confirm?.kind === 'pick-decision' ? 'Continue'
            : confirm?.kind === 'decision' ? 'Save decision'
            : 'Confirm'
        }
        showConfirm={confirm?.kind !== 'pick-decision'}
        showCancel
      >
        {confirm?.kind === 'pick-decision' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: 'shortlist', label: 'Shortlist', hint: 'Keep in process' },
              { id: 'advance', label: 'Advance', hint: 'Move to next stage' },
              { id: 'reject', label: 'Reject', hint: 'Close this attempt' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setConfirm({ kind: 'decision', invite: confirm.invite, decision: opt.id })}
                className={`rounded-xl border px-3 py-3 text-left ${DECISION_STYLE[opt.id]}`}
              >
                <p className="text-sm font-bold">{opt.label}</p>
                <p className="text-[11px] opacity-80 mt-0.5">{opt.hint}</p>
              </button>
            ))}
          </div>
        ) : null}
        {confirm?.kind === 'decision' ? (
          <div>
            <label className="label-ats">{confirm.decision === 'reject' ? 'Reason (required)' : 'Note (optional)'}</label>
            <textarea
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              rows={3}
              className="textarea-ats"
              placeholder={confirm.decision === 'reject' ? 'Record the reason for the audit trail' : 'Add a note for the hiring record'}
            />
          </div>
        ) : null}
      </ConfirmationModal>
    </div>
  );
};
