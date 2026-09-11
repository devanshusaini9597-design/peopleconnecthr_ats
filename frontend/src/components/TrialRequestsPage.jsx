import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, UserPlus, X } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import ConfirmationModal from './ConfirmationModal';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'pending_approval', label: 'Pending' },
  { id: 'active', label: 'Approved' },
  { id: 'rejected', label: 'Declined' },
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

export default function TrialRequestsPage() {
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

  if (!user?.isPlatformOperator) {
    return (
      <div className="page-ats">
        <EmptyState
          tone="amber"
          message="Sales team only"
          subMessage="Trial requests are reviewed by the People Connect HR sales team."
        />
      </div>
    );
  }

  return (
    <div className="page-ats space-y-5">
      <PageHeader
        icon={UserPlus}
        title="Trial requests"
        subtitle="Buyers submit details on Start free trial. Contact them, then approve so they can sign in."
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatus(tab.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
              status === tab.id
                ? 'bg-brand-50 text-brand-800 border-brand-200'
                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="card-ats-bordered overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-stone-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            compact
            tone="brand"
            message={status === 'pending_approval' ? 'No pending requests' : 'Nothing here yet'}
            subMessage="New trial submissions from the sign-up page land in Pending."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-stone-400 border-b border-stone-100">
                  <th className="px-4 py-3 font-semibold">Buyer</th>
                  <th className="px-4 py-3 font-semibold">Company</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  {status === 'pending_approval' && <th className="px-4 py-3 font-semibold text-right">Review</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-stone-50 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-stone-900">{row.name || '—'}</p>
                      <p className="text-xs text-stone-500">{row.email}</p>
                    </td>
                    <td className="px-4 py-3 text-stone-700">{row.companyName || '—'}</td>
                    <td className="px-4 py-3 text-stone-700">{row.phone || '—'}</td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{relativeTime(row.createdAt)}</td>
                    {status === 'pending_approval' && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={actingId === row.id}
                            onClick={() => act(row.id, 'approve')}
                            className="btn-primary !py-1.5 !px-3 text-xs"
                          >
                            {actingId === row.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={actingId === row.id}
                            onClick={() => setRejectTarget(row)}
                            className="btn-secondary !py-1.5 !px-3 text-xs"
                          >
                            <X size={12} />
                            Decline
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
