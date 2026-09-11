import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Loader2, ArrowRight, Inbox, Search, CheckCircle2, XCircle } from 'lucide-react';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import EmptyState from './ui/EmptyState';

/**
 * Compact enterprise strip on Jobs — full review happens on /freelance-review.
 */
export default function FreelanceSubmissionsPanel() {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/freelancer/submissions');
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load submissions');
      setRows(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { submitted: 0, reviewing: 0, shortlisted: 0, rejected: 0 };
    for (const row of rows) {
      if (c[row.status] !== undefined) c[row.status] += 1;
    }
    return c;
  }, [rows]);

  const awaiting = counts.submitted + counts.reviewing;

  return (
    <section className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 mb-4">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-brand-500 to-teal-500" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Send className="w-4 h-4 text-indigo-600 shrink-0" />
            Freelance desk handoffs
          </h2>
          <p className="text-[12px] text-stone-500 mt-0.5">
            Review external submissions here. Status updates sync to the freelancer pipeline and your Applications board.
          </p>
        </div>
        <button type="button" onClick={() => navigate('/freelance-review')} className="btn-primary shrink-0">
          Open review center <ArrowRight size={14} />
        </button>
      </div>

      {loading ? (
        <div className="h-16 skeleton-ats rounded-xl mt-4" />
      ) : rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            compact
            icon={Send}
            tone="violet"
            message="No freelance submissions yet"
            subMessage="Handoffs from freelance recruiters appear in the review center for the assigned SPOC."
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Awaiting / reviewing', value: awaiting, icon: Inbox, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
            { label: 'Submitted', value: counts.submitted, icon: Inbox, tone: 'text-sky-700 bg-sky-50 border-sky-200' },
            { label: 'Shortlisted', value: counts.shortlisted, icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            { label: 'Rejected', value: counts.rejected, icon: XCircle, tone: 'text-red-700 bg-red-50 border-red-200' },
          ].map((kpi) => (
            <button
              key={kpi.label}
              type="button"
              onClick={() => navigate('/freelance-review')}
              className={`rounded-xl border px-3 py-2.5 text-left ${kpi.tone}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 flex items-center gap-1">
                <kpi.icon size={11} /> {kpi.label}
              </p>
              <p className="text-lg font-bold tabular-nums mt-0.5">{kpi.value}</p>
            </button>
          ))}
          {awaiting > 0 && (
            <p className="col-span-2 sm:col-span-4 text-[11px] text-stone-500 flex items-center gap-1.5 mt-1">
              <Loader2 size={11} className="text-amber-600" />
              {awaiting} handoff{awaiting === 1 ? '' : 's'} need SPOC action — open the review center to update status.
              <Search size={11} className="opacity-0" />
            </p>
          )}
        </div>
      )}
    </section>
  );
}
