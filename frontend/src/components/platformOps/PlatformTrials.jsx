import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import { useAuth } from '../../context/AuthContext';
import { relativeTime } from './opsConstants';

const TABS = [
  { id: 'pending_approval', label: 'Pending' },
  { id: 'active', label: 'Approved' },
  { id: 'rejected', label: 'Declined' },
];

export default function PlatformTrials() {
  const toast = useToast();
  const { user } = useAuth();
  const [status, setStatus] = useState('pending_approval');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);

  const load = useCallback(async (nextStatus = status) => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/onboarding/trial-requests?status=${encodeURIComponent(nextStatus)}`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load trial requests');
      setRows(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      toast.error(err.message || 'Could not load trial requests');
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => { load(status); }, [status, load]);

  const act = async (id, action) => {
    setActingId(id);
    try {
      const res = await authenticatedFetch(`/api/onboarding/trial-requests/${id}/${action}`, { method: 'POST' });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Could not ${action}`);
      toast.success(action === 'approve' ? `Approved ${data.email}` : `Declined ${data.email}`);
      await load(status);
    } catch (err) {
      toast.error(err.message || `Could not ${action} this request`);
    } finally {
      setActingId('');
      setRejectTarget(null);
    }
  };

  if (!user?.isPlatformOperator) return null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-400/90">Pipeline</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Trial requests</h1>
        <p className="mt-1 text-sm text-stone-400">Approve buyers from Start free trial so they can sign in.</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatus(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              status === tab.id ? 'bg-white text-stone-900 border-white' : 'border-stone-700 text-stone-300 hover:bg-stone-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-stone-800 overflow-hidden bg-stone-950">
        {loading ? (
          <div className="py-16 flex justify-center text-stone-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-stone-500">Nothing in this queue.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-[0.14em] text-stone-500 bg-stone-900/80">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Buyer</th>
                <th className="text-left px-4 py-3 font-semibold">Company</th>
                <th className="text-left px-4 py-3 font-semibold">Phone</th>
                <th className="text-left px-4 py-3 font-semibold">Submitted</th>
                {status === 'pending_approval' ? <th className="text-right px-4 py-3 font-semibold">Review</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{row.name || '—'}</p>
                    <p className="text-xs text-stone-500">{row.email}</p>
                  </td>
                  <td className="px-4 py-3 text-stone-300">{row.companyName || '—'}</td>
                  <td className="px-4 py-3 text-stone-300">{row.phone || '—'}</td>
                  <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{relativeTime(row.createdAt)}</td>
                  {status === 'pending_approval' ? (
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button type="button" disabled={actingId === row.id} onClick={() => act(row.id, 'approve')} className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white">
                          {actingId === row.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve
                        </button>
                        <button type="button" disabled={actingId === row.id} onClick={() => setRejectTarget(row)} className="rounded-lg border border-stone-700 px-3 py-1.5 text-xs font-semibold text-stone-200">
                          <X size={12} /> Decline
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <ConfirmationModal
        isOpen={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        onConfirm={() => rejectTarget && act(rejectTarget.id, 'reject')}
        title="Decline this trial request?"
        message={rejectTarget ? `${rejectTarget.name || rejectTarget.email} will not be able to sign in.` : ''}
        confirmText="Decline request"
        type="danger"
      />
    </div>
  );
}
