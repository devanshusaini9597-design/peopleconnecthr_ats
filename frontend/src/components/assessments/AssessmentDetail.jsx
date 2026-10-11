import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Loader2, Send, ArrowLeft, Clock, FileEdit, Link2, RefreshCw, Archive, Pencil, Copy, Trash2,
} from 'lucide-react';
import { authenticatedFetch } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import EmptyState from '../ui/EmptyState';
import PremiumSelect from '../ui/PremiumSelect';
import PresenceAvatar from '../ui/PresenceAvatar';
import useTableDragScroll from '../../hooks/useTableDragScroll';
import { guardTableCopy } from '../../utils/tableCopyGuard';
import { STATUS_BADGE, actionBtn } from './assessmentsConstants';
import { InviteModal } from './InviteModal';
import { GradeModal } from './GradeModal';

const PIPELINE = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Not started' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'submitted', label: 'To grade' },
  { key: 'graded', label: 'Graded' },
  { key: 'expired', label: 'Expired' },
];

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
    const timer = setInterval(() => load(true), 20000);
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
      toast?.success?.(`Published version ${data.data.version}. New attempts use this freeze.`);
      onUpdated?.(data.data);
    } catch (err) {
      toast?.error?.(err?.message || 'Could not publish');
    } finally {
      setPublishing(false);
    }
  };

  const decide = async (invite, decision) => {
    const reason = window.prompt(decision === 'reject' ? 'Reason for rejection (required for audit)' : 'Optional reason') || '';
    if (decision === 'reject' && !reason.trim()) {
      toast?.error?.('A reason is required to reject');
      return;
    }
    const res = await authenticatedFetch(`/api/assessments/invites/${invite._id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      toast?.error?.(data.message || 'Could not record decision');
      return;
    }
    toast?.success?.('Decision saved');
    load(true);
    loadRanking();
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

  const counts = PIPELINE.reduce((acc, item) => {
    acc[item.key] = item.key === 'all' ? invites.length : invites.filter((row) => row.status === item.key).length;
    return acc;
  }, {});
  const visible = statusFilter === 'all' ? invites : invites.filter((row) => row.status === statusFilter);
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

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
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
            <button type="button" onClick={publish} className="btn-secondary" disabled={publishing}>
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
          <button type="button" onClick={toggleArchive} className="btn-secondary" disabled={archiving}>
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

      {archived ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          This test is archived. Existing links stay as they are. Restore it before sending new invites.
        </p>
      ) : null}

      <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm relative">
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 pointer-events-none" />
        <div className="p-3 sm:p-5 space-y-3">
          <div className="flex overflow-x-auto scrollbar-hide gap-1">
            {PIPELINE.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatusFilter(item.key)}
                className={`flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap
                  ${statusFilter === item.key
                    ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200/70'
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}
              >
                {item.label}
                <span className="text-[11px] font-bold tabular-nums text-stone-400">{counts[item.key] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

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
            message={invites.length === 0 ? 'No invites sent yet' : 'Nothing in this stage'}
            subMessage={invites.length === 0 ? 'Invite a candidate to take this assessment.' : 'Pick another stage, or invite someone new.'}
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
                  {['Candidate', 'Score', 'Risk', 'Status', 'Actions'].map((label) => (
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
                      {inv.proctoring?.flagged ? (
                        <span className="badge-warning text-[10px]">Risk {inv.proctoring.riskScore}</span>
                      ) : inv.proctoring?.riskScore > 0 ? (
                        <span className="badge-neutral text-[10px]">Risk {inv.proctoring.riskScore}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3.5 py-3 text-sm border border-stone-200 align-middle whitespace-nowrap">
                      <span className={STATUS_BADGE[inv.status] || 'badge-neutral'}>
                        {String(inv.status || '').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-sm border border-stone-200 align-middle whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => copyLink(inv)} className={actionBtn} title="Copy assessment link" aria-label="Copy assessment link">
                          <Link2 size={14} />
                        </button>
                        {canInvite && inv.status !== 'submitted' && inv.status !== 'graded' && (
                          <button type="button" onClick={() => resend(inv)} disabled={resendingId === inv._id} className={actionBtn} title="Send a fresh 72-hour link">
                            <RefreshCw size={14} className={resendingId === inv._id ? 'animate-spin' : ''} />
                          </button>
                        )}
                        {canInvite && ['pending', 'expired'].includes(inv.status) && (
                          <button type="button" onClick={() => revoke(inv)} className="text-xs font-semibold text-red-600 px-2">Revoke</button>
                        )}
                        {canGrade && (inv.status === 'submitted' || inv.status === 'graded') && (
                          <button type="button" onClick={() => openGrade(inv)} className={actionBtn} title="Review & grade">
                            <FileEdit size={14} />
                          </button>
                        )}
                        {canDecide && (inv.status === 'submitted' || inv.status === 'graded') && inv.scoringStatus !== 'pending_review' && (
                          <div className="w-32">
                            <PremiumSelect
                              compact
                              variant="list"
                              value={inv.decision || 'none'}
                              onChange={(v) => { if (v && v !== 'none') decide(inv, v); }}
                              options={[
                                { value: 'none', label: 'Decision' },
                                { value: 'shortlist', label: 'Shortlist' },
                                { value: 'advance', label: 'Advance' },
                                { value: 'reject', label: 'Reject' },
                              ]}
                              placeholder="Decision"
                            />
                          </div>
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
        <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 pointer-events-none" />
          <div className="p-4 sm:p-5">
            <h3 className="section-title-ats">Ranking (same published version)</h3>
            <div className="space-y-2">
              {ranking[0].ranking.slice(0, 20).map((row) => (
                <div key={row._id} className="flex items-center justify-between text-sm rounded-xl border border-stone-100 bg-stone-50/70 px-3 py-2">
                  <span className="font-semibold text-stone-800">#{row.rank} {row.candidateId?.name}</span>
                  <span className="tabular-nums text-stone-600">
                    {row.totalScore}/{row.maxScore}
                    {row.skillBreakdown?.length ? ` · ${row.skillBreakdown.map((s) => `${s.skill} ${s.percent}%`).join(', ')}` : ''}
                    {row.passFail === 'pending' ? ' · review pending' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {audit.length ? (
        <section className="rounded-xl border border-stone-200/90 bg-white shadow-sm relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 pointer-events-none" />
          <div className="p-4 sm:p-5">
            <h3 className="section-title-ats">Audit</h3>
            <div className="space-y-1.5 text-xs text-stone-600">
              {audit.slice(0, 15).map((row) => (
                <p key={row._id} className="rounded-lg bg-stone-50/80 px-3 py-1.5">
                  {new Date(row.timestamp).toLocaleString()} · {row.action} · {row.userId?.name || 'system'}
                  {row.details?.message ? ` · ${row.details.message}` : ''}
                </p>
              ))}
            </div>
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
    </div>
  );
};
