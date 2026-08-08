import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Loader2, Send, ArrowLeft, Clock, FileEdit,
} from 'lucide-react';
import { authenticatedFetch } from '../../utils/fetchUtils';
import EmptyState from '../ui/EmptyState';
import { STATUS_BADGE, actionBtn } from './assessmentsConstants';
import { InviteModal } from './InviteModal';
import { GradeModal } from './GradeModal';

export const AssessmentDetail = ({ assessment, onBack }) => {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [gradingInvite, setGradingInvite] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/assessments/invites?assessmentId=${assessment._id}`);
      const data = await res.json();
      if (data.success) setInvites(data.data || []);
    } finally {
      setLoading(false);
    }
  }, [assessment._id]);

  useEffect(() => { load(); }, [load]);

  const openGrade = async (invite) => {
    const res = await authenticatedFetch(`/api/assessments/invites/${invite._id}`);
    const data = await res.json();
    if (data.success) setGradingInvite(data.data);
  };

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
              <span className="inline-flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" /> {assessment.questions.length} questions</span>
              <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {assessment.durationMinutes} min</span>
              <span className="badge-neutral">{assessment.maxScore} pts max</span>
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setShowInvite(true)} className="btn-primary w-full sm:w-auto">
          <Send className="w-4 h-4" /> Invite Candidate
        </button>
      </div>

      <div className="table-shell-ats">
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-2">
            <Loader2 className="w-7 h-7 text-brand-600 animate-spin" />
            <p className="text-sm text-stone-500 font-medium">Loading invites…</p>
          </div>
        ) : invites.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            tone="sky"
            message="No invites sent yet"
            subMessage="Invite a candidate to take this assessment."
            action={
              <button type="button" onClick={() => setShowInvite(true)} className="btn-primary">
                <Send className="w-4 h-4" /> Invite Candidate
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-stone-100">
            {invites.map((inv) => (
              <div key={inv._id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-50/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(inv.candidateId?.name || 'N')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-stone-900 truncate">{inv.candidateId?.name}</div>
                    <div className="text-sm text-stone-500 truncate">{inv.candidateId?.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {inv.totalScore !== undefined && inv.totalScore !== null && (
                    <span className="text-sm font-semibold text-stone-700 tabular-nums">
                      {inv.totalScore}/{inv.maxScore || assessment.maxScore}
                    </span>
                  )}
                  {inv.proctoring?.flagged && (
                    <span className="badge-warning text-[10px]">Risk {inv.proctoring.riskScore}</span>
                  )}
                  {inv.proctoring?.riskScore > 0 && !inv.proctoring?.flagged && (
                    <span className="badge-neutral text-[10px]">Risk {inv.proctoring.riskScore}</span>
                  )}
                  <span className={STATUS_BADGE[inv.status] || 'badge-neutral'}>
                    {String(inv.status || '').replace('_', ' ')}
                  </span>
                  {(inv.status === 'submitted' || inv.status === 'graded') && (
                    <button
                      type="button"
                      onClick={() => openGrade(inv)}
                      className={`${actionBtn} text-stone-500 hover:text-brand-600 hover:border-brand-300`}
                      title="Review & grade"
                      aria-label="Review and grade"
                    >
                      <FileEdit size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
