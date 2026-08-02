import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Copy, Loader2, Gift, Lock } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import FeatureGate from './FeatureGate';

const REWARD_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  paid: 'Paid',
  ineligible: 'Ineligible'
};

const REWARD_BADGE = {
  pending: 'badge-warning',
  approved: 'badge-brand',
  paid: 'badge-success',
  ineligible: 'badge-neutral'
};

const UpgradeFallback = () => (
  <div className="page-shell-ats animate-page-enter">
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center card-ats-bordered border-amber-200/80 bg-amber-50/40 p-8 sm:p-10 animate-slide-up relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 ring-4 ring-amber-100/60">
          <Lock className="w-7 h-7 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 tracking-tight">Referrals are a Professional feature</h2>
        <p className="text-stone-500 mt-2 text-sm leading-relaxed">
          Upgrade to Professional to track referral codes, candidate links, and reward status.
        </p>
        <a href="/billing" className="btn-primary inline-flex mt-6 w-full sm:w-auto">View Plans</a>
      </div>
    </div>
  </div>
);

export default function ReferralsPage() {
  const toast = useToast();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/referrals');
      const data = await readApiJson(res);
      if (data.success) setReferrals(data.data || []);
    } catch {
      toast.error('Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const createCode = async () => {
    setCreating(true);
    try {
      const res = await authenticatedFetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Referral code created');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (code) => {
    const link = `${window.location.origin}/careers?ref=${code}`;
    navigator.clipboard.writeText(link).then(() => toast.success('Link copied'));
  };

  const updateReward = async (id, rewardStatus) => {
    try {
      const res = await authenticatedFetch(`/api/referrals/${id}/reward`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardStatus })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <FeatureGate feature="referrals.program" fallback={<UpgradeFallback />}>
      <div className="page-shell-ats animate-page-enter pb-32 sm:pb-28">
        <PageHeader
          title="Referrals"
          subtitle="Track referral codes, candidate links, and reward status."
          icon={Users}
          gradientTitle
        >
          <button type="button" onClick={createCode} disabled={creating} className="btn-primary w-full sm:w-auto">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            New referral code
          </button>
        </PageHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            <p className="text-sm text-stone-500">Loading referrals…</p>
          </div>
        ) : referrals.length === 0 ? (
          <div className="card-ats-bordered relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <EmptyState
              icon={Gift}
              message="No referrals yet"
              subMessage="Create a code and share it with employees."
              tone="brand"
              action={
                <button type="button" onClick={createCode} disabled={creating} className="btn-primary">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create first code
                </button>
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="md:hidden space-y-3">
              {referrals.map((r) => (
                <div key={r._id} className="card-ats-bordered p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-stone-900">{r.code}</p>
                      <p className="text-sm text-stone-500 mt-0.5">{r.referrerName || '—'}</p>
                    </div>
                    <span className={REWARD_BADGE[r.rewardStatus] || 'badge-neutral'}>
                      {REWARD_LABELS[r.rewardStatus] || r.rewardStatus}
                    </span>
                  </div>
                  <p className="text-sm text-stone-600">
                    <span className="text-stone-400 text-xs uppercase font-semibold">Candidate: </span>
                    {r.candidateName || r.candidateEmail || '—'}
                  </p>
                  <div className="flex flex-col gap-2 pt-1">
                    <select
                      value={r.rewardStatus}
                      onChange={(e) => updateReward(r._id, e.target.value)}
                      className="select-ats text-sm"
                    >
                      {Object.entries(REWARD_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => copyLink(r.code)}
                      className="btn-secondary text-sm w-full"
                    >
                      <Copy className="w-4 h-4" /> Copy link
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block table-shell-ats overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-stone-500 text-left border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Code</th>
                    <th className="px-4 py-3 font-semibold">Referrer</th>
                    <th className="px-4 py-3 font-semibold">Candidate</th>
                    <th className="px-4 py-3 font-semibold">Reward</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r._id} className="border-t border-stone-100 hover:bg-stone-50/50 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-semibold text-stone-900">{r.code}</td>
                      <td className="px-4 py-3.5 text-stone-700">{r.referrerName || '—'}</td>
                      <td className="px-4 py-3.5 text-stone-700">{r.candidateName || r.candidateEmail || '—'}</td>
                      <td className="px-4 py-3.5">
                        <select
                          value={r.rewardStatus}
                          onChange={(e) => updateReward(r._id, e.target.value)}
                          className="select-ats text-sm !w-auto min-w-[120px]"
                        >
                          {Object.entries(REWARD_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => copyLink(r.code)}
                          className="btn-ghost text-sm inline-flex items-center gap-1.5 text-brand-700"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy link
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </FeatureGate>
  );
}
