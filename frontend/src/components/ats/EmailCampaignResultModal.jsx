import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Mail,
  Megaphone,
  X,
  Info,
  Ban,
  UserX,
  AtSign,
  Settings2,
  ShieldAlert,
  SkipForward,
} from 'lucide-react';
import { FAILURE_REASON_META, buildFailureBreakdown } from '../../utils/emailSendReport';

const REASON_ICONS = {
  invalid_address: AtSign,
  mailbox_unavailable: UserX,
  unsubscribed: Ban,
  blocked: ShieldAlert,
  configuration: Settings2,
  provider_error: AlertTriangle,
  other: AlertTriangle,
};

/**
 * Enterprise delivery report after bulk / campaign send.
 * Stats are derived from the live provider response for this send action.
 */
export default function EmailCampaignResultModal({
  open,
  result,
  onClose,
  onViewReports,
}) {
  const [activeReason, setActiveReason] = useState('all');

  const report = useMemo(() => {
    if (!result) return null;
    const failures = Array.isArray(result.failures) ? result.failures : [];
    const breakdown =
      Array.isArray(result.failureBreakdown) && result.failureBreakdown.length
        ? result.failureBreakdown
        : buildFailureBreakdown(failures).rows;
    const sent = Number(result.sent) || 0;
    const failed = Number(result.failed) || failures.length;
    const skipped = Number(result.skipped) || 0;
    const attempted = Number(result.attempted) || sent + failed;
    const total = Number(result.total) || attempted + skipped;
    return {
      ...result,
      sent,
      failed,
      skipped,
      attempted,
      total,
      failures,
      failureBreakdown: breakdown,
      successRate:
        result.successRate ||
        (attempted > 0 ? `${((sent / attempted) * 100).toFixed(1)}%` : '0%'),
    };
  }, [result]);

  if (!open || !report) return null;

  const {
    title = 'Delivery report',
    channel = 'transactional',
    total = 0,
    attempted = 0,
    sent = 0,
    failed = 0,
    skipped = 0,
    failures = [],
    successes = [],
    failureBreakdown = [],
    successRate = '0%',
    completedAt,
  } = report;

  const allFailed = failed > 0 && sent === 0;
  const allOk = failed === 0 && sent > 0;
  const acceptanceRate = attempted > 0 ? Math.round((sent / attempted) * 100) : 0;

  const banner = allOk
    ? {
        wrap: 'bg-emerald-50/90 border-emerald-200/90',
        iconWrap: 'bg-emerald-100 text-emerald-700',
        title: 'Delivery accepted by the mail provider',
        subtitle: `${sent.toLocaleString()} recipient${sent === 1 ? '' : 's'} accepted for delivery.`,
        Icon: CheckCircle2,
      }
    : allFailed
      ? {
          wrap: 'bg-rose-50/90 border-rose-200/90',
          iconWrap: 'bg-rose-100 text-rose-700',
          title: 'No messages were accepted',
          subtitle: 'Review the failure reasons below and correct recipient or sender issues.',
          Icon: XCircle,
        }
      : {
          wrap: 'bg-amber-50/90 border-amber-200/90',
          iconWrap: 'bg-amber-100 text-amber-700',
          title: 'Partial delivery',
          subtitle: `${sent.toLocaleString()} accepted · ${failed.toLocaleString()} failed at send time.`,
          Icon: AlertTriangle,
        };

  const BannerIcon = banner.Icon;
  const ChannelIcon = channel === 'marketing' ? Megaphone : Mail;

  const filteredFailures =
    activeReason === 'all'
      ? failures
      : failures.filter((f) => {
          const code =
            f.reasonCode && FAILURE_REASON_META[f.reasonCode]
              ? f.reasonCode
              : buildFailureBreakdown([f]).rows[0]?.key;
          return code === activeReason;
        });

  const completedLabel = completedAt
    ? new Date(completedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <div className="fixed inset-0 z-[280] flex items-center justify-center p-3 sm:p-4 bg-stone-950/45 backdrop-blur-[2px]">
      <div
        className="absolute inset-0"
        onClick={onClose}
        onKeyDown={() => {}}
        role="presentation"
      />
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_28px_80px_-24px_rgba(28,25,23,0.45)] animate-page-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-campaign-result-title"
      >
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-600 via-teal-500 to-brand-700" />

        <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 sm:px-6 py-4 bg-gradient-to-br from-stone-50/80 via-white to-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
              <ChannelIcon className="h-3.5 w-3.5 text-brand-700" />
              {channel === 'marketing' ? 'Campaign delivery' : 'Outbound delivery'}
            </div>
            <h2
              id="email-campaign-result-title"
              className="mt-1 text-lg sm:text-xl font-semibold tracking-tight text-stone-900"
            >
              {title}
            </h2>
            {completedLabel ? (
              <p className="mt-1 text-xs text-stone-500">Completed {completedLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 border border-transparent hover:border-stone-200 transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[72vh] space-y-5 overflow-y-auto px-5 sm:px-6 py-5">
          <div className={`rounded-2xl border px-4 py-4 sm:px-5 ${banner.wrap}`}>
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${banner.iconWrap}`}
              >
                <BannerIcon className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-stone-900">{banner.title}</p>
                <p className="mt-0.5 text-sm text-stone-600">{banner.subtitle}</p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/70 border border-stone-200/60">
                  <div
                    className={`h-full rounded-full transition-all ${
                      allFailed ? 'bg-rose-500' : allOk ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${acceptanceRate}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] font-medium text-stone-500">
                  Acceptance rate {successRate} · based on this send action
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <StatCard label="Selected" value={total} tone="stone" />
            <StatCard label="Accepted" value={sent} tone="emerald" />
            <StatCard label="Failed" value={failed} tone="rose" />
            <StatCard label="Skipped" value={skipped} tone="amber" hint="No valid email" />
          </div>

          {failureBreakdown.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-stone-900">Failure analysis</h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Categorized from live provider responses for this send.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {failureBreakdown.map((row) => {
                  const Icon = REASON_ICONS[row.key] || AlertTriangle;
                  const active = activeReason === row.key;
                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => setActiveReason(active ? 'all' : row.key)}
                      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                        active
                          ? 'border-brand-400 bg-brand-50/70 shadow-sm'
                          : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/80'
                      }`}
                    >
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-stone-900">{row.label}</span>
                          <span className="text-sm font-bold tabular-nums text-stone-800">
                            {row.count}
                          </span>
                        </span>
                        <span className="block text-[11px] text-stone-500 mt-0.5">{row.short}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {skipped > 0 ? (
            <div className="flex gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/50 px-3.5 py-3 text-sm text-amber-950">
              <SkipForward className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={2.25} />
              <p className="text-xs leading-relaxed">
                <span className="font-semibold">{skipped.toLocaleString()} recipient{skipped === 1 ? '' : 's'} skipped</span>
                {' '}before send because no valid email address was on file.
              </p>
            </div>
          ) : null}

          <div className="flex gap-2.5 rounded-xl border border-sky-200/80 bg-sky-50/50 px-3.5 py-3 text-left text-sm text-sky-950">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" strokeWidth={2.25} />
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold text-sky-900">How to read these numbers</p>
              <p className="text-xs leading-relaxed text-sky-900/85">
                <strong>Accepted</strong> means the provider took the message for delivery.
                <strong> Failed</strong> means it was rejected immediately (invalid address, missing mailbox,
                unsubscribe, or provider error) — reasons are listed below.
                Inbox delivery, hard bounces, and opens update later in Email Reports after provider sync.
              </p>
            </div>
          </div>

          {failures.length > 0 && (
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-stone-900">
                  Failed recipients
                  {activeReason !== 'all'
                    ? ` · ${FAILURE_REASON_META[activeReason]?.label || 'Filtered'}`
                    : ''}{' '}
                  ({filteredFailures.length})
                </h3>
                {activeReason !== 'all' ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-700 hover:underline"
                    onClick={() => setActiveReason('all')}
                  >
                    Show all
                  </button>
                ) : null}
              </div>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-rose-200/70">
                <table className="min-w-full divide-y divide-rose-100 text-sm">
                  <thead className="sticky top-0 bg-rose-50/95 text-left text-[10px] font-semibold uppercase tracking-wider text-rose-700 backdrop-blur-sm">
                    <tr>
                      <th className="px-3 py-2.5">Recipient</th>
                      <th className="px-3 py-2.5">Category</th>
                      <th className="px-3 py-2.5">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50 bg-white">
                    {filteredFailures.map((f, idx) => {
                      const code =
                        (f.reasonCode && FAILURE_REASON_META[f.reasonCode] && f.reasonCode) ||
                        buildFailureBreakdown([f]).rows[0]?.key ||
                        'other';
                      return (
                        <tr key={`${f.email}-${idx}`}>
                          <td className="px-3 py-2.5 align-top break-all font-medium text-stone-800">
                            {f.email || '—'}
                          </td>
                          <td className="px-3 py-2.5 align-top text-xs text-stone-600 whitespace-nowrap">
                            {FAILURE_REASON_META[code]?.label || 'Other'}
                          </td>
                          <td className="px-3 py-2.5 align-top text-rose-700 text-xs leading-snug">
                            {f.displayMessage || f.error || f.reason || 'Unknown error'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {successes.length > 0 && successes.length <= 12 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-stone-900">
                Accepted ({successes.length})
              </h3>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2.5 text-xs text-stone-600 leading-relaxed">
                {successes
                  .map((s) => (typeof s === 'string' ? s : s.email))
                  .filter(Boolean)
                  .join(', ')}
              </div>
            </section>
          )}
          {successes.length > 12 && (
            <p className="text-xs text-stone-500">
              {successes.length.toLocaleString()} recipients accepted by the provider for this send.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 bg-stone-50/70 px-5 sm:px-6 py-3.5">
          {onViewReports && (
            <button type="button" className="btn-secondary" onClick={onViewReports}>
              Open Email Reports
            </button>
          )}
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = 'stone', hint }) {
  const tones = {
    stone: 'border-stone-200 bg-stone-50/80 text-stone-900',
    emerald: 'border-emerald-200/90 bg-emerald-50/60 text-emerald-900',
    rose: 'border-rose-200/90 bg-rose-50/60 text-rose-900',
    amber: 'border-amber-200/90 bg-amber-50/60 text-amber-950',
  };
  const labelTone = {
    stone: 'text-stone-500',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    amber: 'text-amber-800',
  };
  return (
    <div className={`rounded-xl border px-3 py-3 text-center ${tones[tone]}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${labelTone[tone]}`}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {Number(value || 0).toLocaleString()}
      </p>
      {hint ? <p className="mt-0.5 text-[10px] text-stone-500">{hint}</p> : null}
    </div>
  );
}
