import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Loader2, Eye } from 'lucide-react';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import EmptyState from './ui/EmptyState';
import PremiumSelect from './ui/PremiumSelect';

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_TONE = {
  submitted: 'bg-sky-50 text-sky-700 border-sky-200',
  reviewing: 'bg-amber-50 text-amber-800 border-amber-200',
  shortlisted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

export default function FreelanceSubmissionsPanel() {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

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

  const updateStatus = async (id, status) => {
    setSavingId(id);
    try {
      const res = await authenticatedFetch(`/api/freelancer/submissions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Update failed');
      setRows((prev) => prev.map((row) => (row._id === id ? { ...row, status } : row)));
      toast.success('Submission updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="card-ats-bordered relative overflow-hidden p-4 sm:p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-brand-500 to-teal-500" />
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Send className="w-4 h-4 text-indigo-600 shrink-0" />
            Freelance submissions
          </h2>
          <p className="text-[12px] text-stone-500 mt-0.5">
            Candidates handed to you by freelance recruiters. You get an in-app alert and an email on your login address.
          </p>
        </div>
        <span className="text-[11px] font-semibold tabular-nums text-stone-400 shrink-0">{rows.length}</span>
      </div>

      {loading ? (
        <div className="h-24 skeleton-ats rounded-xl" />
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          icon={Send}
          tone="violet"
          message="No freelance submissions yet"
          subMessage="When a freelancer submits a candidate against an open mandate, it lands here for the SPOC."
        />
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400">
                <th className="py-2 pr-3 font-semibold">Candidate</th>
                <th className="py-2 pr-3 font-semibold">Mandate</th>
                <th className="py-2 pr-3 font-semibold">Freelancer</th>
                <th className="py-2 pr-3 font-semibold">SPOC</th>
                <th className="py-2 font-semibold">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row._id}>
                  <td className="py-2.5 pr-3 min-w-0">
                    <p className="font-semibold text-stone-800 truncate">{row.candidateId?.name || '—'}</p>
                    <p className="text-[11px] text-stone-400 truncate">{row.candidateId?.email || row.note || ''}</p>
                    {row.candidateId?.name && (
                      <button
                        type="button"
                        onClick={() => navigate(`/ats?q=${encodeURIComponent(row.candidateId.name)}`)}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                      >
                        <Eye size={11} />
                        Open in ATS
                      </button>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-stone-600 truncate">{row.jobId?.title || row.jobId?.role || '—'}</td>
                  <td className="py-2.5 pr-3 text-stone-600 truncate">{row.freelancerId?.name || row.freelancerId?.email || '—'}</td>
                  <td className="py-2.5 pr-3 text-stone-600 truncate">{row.spocUserId?.name || row.spocUserId?.email || '—'}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2 min-w-[160px]">
                      {savingId === row._id ? (
                        <Loader2 size={14} className="animate-spin text-indigo-600" />
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_TONE[row.status] || STATUS_TONE.submitted}`}>
                          {row.status}
                        </span>
                      )}
                      <PremiumSelect
                        value={row.status}
                        onChange={(v) => updateStatus(row._id, v)}
                        options={STATUS_OPTIONS}
                        compact
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
