import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Copy, Loader2, Gift, RefreshCw, Link2, Check, Share2, UserRound
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import PremiumSelect from './ui/PremiumSelect';
import FeatureGate from './FeatureGate';
import UpgradeFeatureFallback from './ui/UpgradeFeatureFallback';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';

const REF_TOUR_KEY = 'skillnix_tour_referrals_v1';
const REF_TOUR_STEPS = [
  {
    title: 'Employee Referrals',
    body: 'Create a code, copy the ready-made share link, and send it. Applicants are tagged to that referrer automatically.',
  },
  {
    target: '[data-tour="ref-create"]',
    title: 'New referral code',
    body: 'Creates a code and copies the share link for you — ready to paste in WhatsApp, email, or Slack.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="ref-catalog"]',
    title: 'Referral board',
    body: 'Pick a referral to preview its share link, update reward status, or copy again.',
    placement: 'top',
  },
  {
    target: '[data-tour="ref-share"]',
    title: 'Share link',
    body: 'The full careers link is built for you. One click copies it — you never type a URL.',
    placement: 'left',
  },
];

const REWARD_OPTIONS = Object.entries({
  pending: 'Pending',
  approved: 'Approved',
  paid: 'Paid',
  ineligible: 'Ineligible'
}).map(([value, label]) => ({ value, label, icon: Gift }));

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

function referralLink(code) {
  return `${window.location.origin}/careers?ref=${code}`;
}

/** Premium single-line share field — truncates cleanly, one-click copy */
function ShareLinkField({ code, onCopied, size = 'md' }) {
  const [copied, setCopied] = useState(false);
  const link = referralLink(code);
  const compact = size === 'sm';

  const handleCopy = async (e) => {
    e?.stopPropagation?.();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      onCopied?.(code);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* toast handled by parent if needed */
    }
  };

  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-sm shadow-stone-900/[0.03] ${
        compact ? 'h-9' : 'h-11'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 px-3 bg-gradient-to-r from-stone-50/90 to-white">
        <Link2 className={`text-brand-600 shrink-0 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
        <p
          className={`min-w-0 flex-1 truncate font-mono text-stone-600 ${
            compact ? 'text-[11px]' : 'text-[12px]'
          }`}
          title={link}
        >
          {link}
        </p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className={`shrink-0 inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 font-semibold transition-colors border-l border-stone-200/90 ${
          copied
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-brand-600 text-white hover:bg-brand-700'
        } ${compact ? 'text-[11px]' : 'text-xs'}`}
        aria-label="Copy share link"
      >
        {copied ? (
          <>
            <Check className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            <span className="hidden sm:inline">Copied</span>
          </>
        ) : (
          <>
            <Copy className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            <span className="hidden sm:inline">Copy</span>
          </>
        )}
      </button>
    </div>
  );
}

export default function ReferralsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(REF_TOUR_KEY);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const selected = referrals.find((r) => r._id === selectedId) || referrals[0] || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/referrals');
      const data = await readApiJson(res);
      if (data.success) {
        const list = data.data || [];
        setReferrals(list);
        setSelectedId((prev) => {
          if (prev && list.some((r) => r._id === prev)) return prev;
          return list[0]?._id || null;
        });
      }
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
      const created = data.data;
      const code = created?.code;
      if (code) {
        try {
          await navigator.clipboard.writeText(referralLink(code));
          toast.success('Share link ready — paste it anywhere to send.');
        } catch {
          toast.success('Referral code created');
        }
      } else {
        toast.success('Referral code created');
      }
      if (created?._id) setSelectedId(created._id);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const onLinkCopied = () => {
    toast.success('Share link copied — paste in WhatsApp, email, or Slack');
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
      setReferrals((prev) => prev.map((r) => (r._id === id ? { ...r, rewardStatus } : r)));
      toast.success('Reward updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <FeatureGate
      feature="referrals.program"
      fallback={(
        <UpgradeFeatureFallback
          title="Referrals are a Professional feature"
          description="Upgrade to Professional to track referral codes, candidate links, and reward status."
        />
      )}
    >
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          title={t('pages.referrals.title')}
          subtitle="Create a code, copy the ready-made share link, and track rewards."
          icon={Gift}
          gradientTitle
        >
          <button type="button" onClick={load} className="btn-secondary w-full sm:w-auto" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            data-tour="ref-create"
            onClick={createCode}
            disabled={creating}
            className="btn-primary w-full sm:w-auto"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            New referral code
          </button>
        </PageHeader>

        <div className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
          One click creates a code and copies a share link. Send it to an employee — when someone applies, the referral is tracked. No coding needed.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-7 min-w-0 space-y-4">
            {loading ? (
              <div className="card-ats-bordered relative overflow-hidden p-5 space-y-3">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 skeleton-ats rounded-xl" />
                ))}
              </div>
            ) : referrals.length === 0 ? (
              <div data-tour="ref-catalog" className="card-ats-bordered relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <EmptyState
                  icon={Gift}
                  message="No referrals yet"
                  subMessage="Create a code — we build and copy the share link for you."
                  tone="brand"
                  action={
                    <button type="button" onClick={createCode} disabled={creating} className="btn-primary w-full sm:w-auto">
                      {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Create first code
                    </button>
                  }
                />
              </div>
            ) : (
              <section
                data-tour="ref-catalog"
                className="card-ats-bordered relative overflow-hidden flex flex-col"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <div className="relative px-4 sm:px-5 py-3.5 border-b border-stone-100 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-[15px] font-bold text-stone-900 tracking-tight">
                    <Gift className="w-4 h-4 text-brand-600 shrink-0" />
                    Referral codes
                    <span className="text-xs font-semibold text-stone-400">{referrals.length}</span>
                  </h2>
                  <span className="text-[11px] text-stone-400 hidden sm:inline">Select one to share</span>
                </div>

                <div className="relative divide-y divide-stone-100">
                  {referrals.map((r) => {
                    const active = selected?._id === r._id;
                    return (
                      <div
                        key={r._id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedId(r._id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedId(r._id);
                          }
                        }}
                        className={`w-full text-left p-4 sm:px-5 sm:py-4 transition-colors cursor-pointer ${
                          active
                            ? 'bg-brand-50/50 ring-1 ring-inset ring-brand-200/70'
                            : 'hover:bg-stone-50/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0 flex items-start gap-3">
                            <span className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                              active
                                ? 'bg-brand-600 text-white border-brand-600'
                                : 'bg-brand-50 text-brand-700 border-brand-100'
                            }`}>
                              <Gift className="w-4 h-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block font-mono text-sm font-bold text-stone-900 tracking-wide">{r.code}</span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-stone-500">
                                <UserRound className="w-3 h-3 shrink-0" />
                                <span className="truncate">{r.referrerName || 'Referrer pending'}</span>
                              </span>
                            </span>
                          </div>
                          <span className={`${REWARD_BADGE[r.rewardStatus] || 'badge-neutral'} shrink-0`}>
                            {REWARD_LABELS[r.rewardStatus] || r.rewardStatus}
                          </span>
                        </div>

                        <div className="pl-0 sm:pl-12 space-y-2.5" onClick={(e) => e.stopPropagation()}>
                          <p className="text-[12px] text-stone-500">
                            Candidate:{' '}
                            <span className="font-medium text-stone-700">
                              {r.candidateName || r.candidateEmail || 'Waiting for apply…'}
                            </span>
                          </p>
                          <div className="max-w-xs">
                            <PremiumSelect
                              value={r.rewardStatus}
                              onChange={(v) => updateReward(r._id, v)}
                              options={REWARD_OPTIONS}
                              icon={Gift}
                              compact
                            />
                          </div>
                          {active && (
                            <ShareLinkField code={r.code} onCopied={onLinkCopied} size="sm" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <aside className="lg:col-span-5 min-w-0 lg:sticky lg:top-4 space-y-4">
            <div
              data-tour="ref-share"
              className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-4 min-h-[14rem]"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-[15px] font-bold text-stone-900 tracking-tight">
                    <Share2 className="w-4 h-4 text-brand-600 shrink-0" />
                    Share link
                  </h2>
                  <p className="text-[12px] text-stone-500 mt-1 leading-relaxed">
                    Built automatically from the selected code. Copy and send — nothing to type.
                  </p>
                </div>
              </div>

              {selected ? (
                <div className="relative space-y-3">
                  <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 via-white to-teal-50/40 p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400">Code</span>
                      <span className="font-mono text-sm font-bold text-brand-800 bg-white/80 px-2 py-0.5 rounded-lg border border-brand-100">
                        {selected.code}
                      </span>
                    </div>
                    <ShareLinkField code={selected.code} onCopied={onLinkCopied} />
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed px-0.5">
                    Recipients open your careers page. If they apply, this referral is attached automatically.
                  </p>
                </div>
              ) : (
                <div className="relative flex-1 rounded-2xl border border-dashed border-stone-200 bg-stone-50/60 p-6 flex flex-col items-center justify-center text-center gap-2 min-h-[10rem]">
                  <div className="w-11 h-11 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-stone-700">No link yet</p>
                  <p className="text-[12px] text-stone-400 max-w-[16rem] leading-relaxed">
                    Create a referral code and your share link appears here, ready to copy.
                  </p>
                </div>
              )}
            </div>

            <div data-tour="ref-how" className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-3">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
              <h2 className="relative text-[15px] font-bold text-stone-900 tracking-tight">How it works</h2>
              <ol className="relative space-y-2.5 text-[13px] text-stone-600 leading-relaxed">
                <li className="flex gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center text-[11px] font-bold shrink-0">1</span>
                  <span>Create a referral code.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center text-[11px] font-bold shrink-0">2</span>
                  <span>Copy the share link (we build it for you).</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center text-[11px] font-bold shrink-0">3</span>
                  <span>When someone applies, update the reward.</span>
                </li>
              </ol>
            </div>

            <div className="card-ats-bordered relative overflow-hidden p-4 sm:p-5 flex flex-col gap-3">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
              <h2 className="relative text-[15px] font-bold text-stone-900 tracking-tight">Reward statuses</h2>
              <ul className="relative space-y-2 text-[13px] text-stone-600">
                <li className="flex items-center gap-2">
                  <span className="badge-warning">Pending</span>
                  <span>Waiting on hire / review</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="badge-brand">Approved</span>
                  <span>Ready to pay</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="badge-success">Paid</span>
                  <span>Reward completed</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="badge-neutral">Ineligible</span>
                  <span>Does not qualify</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>

        <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of Referrals" />
        <ProductTour
          open={tourOpen}
          onClose={() => setTourOpen(false)}
          steps={REF_TOUR_STEPS}
          storageKey={REF_TOUR_KEY}
        />
      </div>
    </FeatureGate>
  );
}
