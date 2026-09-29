import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  Search,
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
 * Enterprise delivery report after single / bulk / campaign send.
 * Stats are derived from the live ZeptoMail or Zoho Campaigns response.
 */
export default function EmailCampaignResultModal({
  open,
  result,
  onClose,
  onViewReports,
}) {
  const [listTab, setListTab] = useState('failed');
  const [activeReason, setActiveReason] = useState('all');
  const [query, setQuery] = useState('');

  const report = useMemo(() => {
    if (!result) return null;
    const failures = Array.isArray(result.failures) ? result.failures : [];
    const successes = Array.isArray(result.successes) ? result.successes : [];
    const breakdown =
      Array.isArray(result.failureBreakdown) && result.failureBreakdown.length
        ? result.failureBreakdown
        : buildFailureBreakdown(failures).rows;
    const sent = Number(result.sent) || successes.length || 0;
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
      successes,
      failureBreakdown: breakdown,
      successRate:
        result.successRate ||
        (attempted > 0 ? `${((sent / attempted) * 100).toFixed(1)}%` : '0%'),
    };
  }, [result]);

  // Prefer Failed tab when there are failures; otherwise Accepted
  useEffect(() => {
    if (!report) return;
    setListTab(report.failed > 0 ? 'failed' : 'accepted');
    setActiveReason('all');
    setQuery('');
  }, [report?.completedAt, report?.sent, report?.failed]);

  if (!open || !report) return null;

  const {
    title = 'Delivery report',
    channel = 'transactional',
    provider = '',
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
  const providerLabel =
    provider || (channel === 'marketing' ? 'Zoho Campaigns' : 'ZeptoMail');

  const banner = allOk
    ? {
        wrap: 'bg-emerald-50/90 border-emerald-200/90',
        iconWrap: 'bg-emerald-100 text-emerald-700',
        title: 'All messages accepted',
        subtitle: `${sent.toLocaleString()} of ${attempted.toLocaleString()} accepted by ${providerLabel}.`,
        Icon: CheckCircle2,
      }
    : allFailed
      ? {
          wrap: 'bg-rose-50/90 border-rose-200/90',
          iconWrap: 'bg-rose-100 text-rose-700',
          title: 'No messages were accepted',
          subtitle: `${failed.toLocaleString()} failed at send time. Review reasons below.`,
          Icon: XCircle,
        }
      : {
          wrap: 'bg-amber-50/90 border-amber-200/90',
          iconWrap: 'bg-amber-100 text-amber-700',
          title: 'Partial delivery',
          subtitle: `${sent.toLocaleString()} accepted · ${failed.toLocaleString()} failed via ${providerLabel}.`,
          Icon: AlertTriangle,
        };

  const BannerIcon = banner.Icon;
  const ChannelIcon = channel === 'marketing' ? Megaphone : Mail;

  const q = query.trim().toLowerCase();
  const filteredFailures = failures.filter((f) => {
    const code =
      f.reasonCode && FAILURE_REASON_META[f.reasonCode]
        ? f.reasonCode
        : buildFailureBreakdown([f]).rows[0]?.key;
    if (activeReason !== 'all' && code !== activeReason) return false;
    if (!q) return true;
    const hay = `${f.email || ''} ${f.displayMessage || ''} ${f.error || ''}`.toLowerCase();
    return hay.includes(q);
  });

  const filteredSuccesses = successes.filter((s) => {
    const email = typeof s === 'string' ? s : s?.email || '';
    if (!q) return true;
    return email.toLowerCase().includes(q);
  });

  const completedLabel = completedAt
    ? new Date(completedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  const modal = (
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-950/50 backdrop-blur-[2px]">
      <div
        className="absolute inset-0"
        onClick={onClose}
        onKeyDown={() => {}}
        role="presentation"
      />
      <div
        className="relative w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden rounded-none sm:rounded-2xl border-0 sm:border border-stone-200/90 bg-white shadow-none sm:shadow-[0_28px_80px_-24px_rgba(28,25,23,0.45)] animate-page-enter flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-campaign-result-title"
      >
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-600 via-teal-500 to-brand-700" />

        <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-br from-stone-50/80 via-white to-white flex-shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
              <span className="inline-flex items-center gap-1.5">
                <ChannelIcon className="h-3.5 w-3.5 text-brand-700" />
                {channel === 'marketing' ? 'Campaign' : 'Transactional'}
              </span>
              <span className="text-stone-300">·</span>
              <span className="normal-case tracking-normal font-medium text-stone-500">{providerLabel}</span>
            </div>
            <h2
              id="email-campaign-result-title"
              className="mt-1 text-base sm:text-xl font-semibold tracking-tight text-stone-900"
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
            className="rounded-xl p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 border border-transparent hover:border-stone-200 transition flex-shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
          <div className={`rounded-2xl border px-3.5 py-3.5 sm:px-5 sm:py-4 ${banner.wrap}`}>
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ${banner.iconWrap}`}
              >
                <BannerIcon className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-stone-900 text-sm sm:text-base">{banner.title}</p>
                <p className="mt-0.5 text-xs sm:text-sm text-stone-600">{banner.subtitle}</p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/70 border border-stone-200/60">
                  <div
                    className={`h-full rounded-full transition-all ${
                      allFailed ? 'bg-rose-500' : allOk ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${acceptanceRate}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] font-medium text-stone-500">
                  {sent.toLocaleString()} accepted · {failed.toLocaleString()} failed · {successRate} acceptance
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
            <StatCard label="Selected" value={total} tone="stone" />
            <StatCard label="Accepted" value={sent} tone="emerald" />
            <StatCard label="Failed" value={failed} tone="rose" />
            <StatCard label="Skipped" value={skipped} tone="amber" hint="No email on file" />
          </div>

          {failureBreakdown.length > 0 ? (
            <section className="space-y-2.5">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">Why messages failed</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  From live {providerLabel} responses for this send.
                </p>
              </div>
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-2">
                {failureBreakdown.map((row) => {
                  const Icon = REASON_ICONS[row.key] || AlertTriangle;
                  const active = activeReason === row.key && listTab === 'failed';
                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => {
                        setListTab('failed');
                        setActiveReason(active ? 'all' : row.key);
                      }}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 sm:px-3.5 sm:py-3 text-left transition ${
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
                <span className="font-semibold">
                  {skipped.toLocaleString()} recipient{skipped === 1 ? '' : 's'} skipped
                </span>{' '}
                before send — no valid email address on file.
              </p>
            </div>
          ) : null}

          <div className="flex gap-2.5 rounded-xl border border-sky-200/80 bg-sky-50/50 px-3.5 py-3 text-left text-sm text-sky-950">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" strokeWidth={2.25} />
            <p className="text-xs leading-relaxed text-sky-900/85">
              <strong>Accepted</strong> = {providerLabel} took the message.
              <strong> Failed</strong> = rejected immediately (invalid email, bounce/mailbox missing, unsubscribe, or provider error).
              Later inbox delivery and hard bounces appear in Email Reports after sync.
            </p>
          </div>

          {(successes.length > 0 || failures.length > 0) && (
            <section className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="inline-flex p-1 rounded-lg bg-stone-100 border border-stone-200/80 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setListTab('accepted')}
                    className={`flex-1 sm:flex-none px-3 py-2 text-sm font-medium rounded-md transition ${
                      listTab === 'accepted'
                        ? 'bg-white text-emerald-800 shadow-sm border border-stone-200/90'
                        : 'text-stone-600'
                    }`}
                  >
                    Accepted ({sent.toLocaleString()})
                  </button>
                  <button
                    type="button"
                    onClick={() => setListTab('failed')}
                    className={`flex-1 sm:flex-none px-3 py-2 text-sm font-medium rounded-md transition ${
                      listTab === 'failed'
                        ? 'bg-white text-rose-800 shadow-sm border border-stone-200/90'
                        : 'text-stone-600'
                    }`}
                  >
                    Failed ({failed.toLocaleString()})
                  </button>
                </div>
                <div className="relative flex-1 min-w-0">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={listTab === 'failed' ? 'Search failed recipients…' : 'Search accepted recipients…'}
                    className="input-ats input-ats-icon w-full !py-2 text-sm"
                  />
                </div>
              </div>

              {listTab === 'failed' ? (
                failures.length === 0 ? (
                  <p className="text-sm text-stone-500 py-6 text-center rounded-xl border border-dashed border-stone-200">
                    No failures for this send.
                  </p>
                ) : (
                  <div className="max-h-56 sm:max-h-64 overflow-auto rounded-xl border border-rose-200/70 -mx-0">
                    <table className="min-w-[28rem] w-full divide-y divide-rose-100 text-sm">
                      <thead className="sticky top-0 bg-rose-50/95 text-left text-[10px] font-semibold uppercase tracking-wider text-rose-700 backdrop-blur-sm">
                        <tr>
                          <th className="px-3 py-2.5">Recipient</th>
                          <th className="px-3 py-2.5">Category</th>
                          <th className="px-3 py-2.5">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50 bg-white">
                        {filteredFailures.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-3 py-6 text-center text-stone-500 text-sm">
                              No recipients match this filter.
                            </td>
                          </tr>
                        ) : (
                          filteredFailures.map((f, idx) => {
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
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )
              ) : successes.length === 0 ? (
                <p className="text-sm text-stone-500 py-6 text-center rounded-xl border border-dashed border-stone-200">
                  No accepted recipients for this send.
                </p>
              ) : (
                <div className="max-h-56 sm:max-h-64 overflow-auto rounded-xl border border-emerald-200/70">
                  <ul className="divide-y divide-emerald-50 bg-white">
                    {filteredSuccesses.length === 0 ? (
                      <li className="px-3 py-6 text-center text-stone-500 text-sm">
                        No recipients match this search.
                      </li>
                    ) : (
                      filteredSuccesses.map((s, idx) => {
                        const email = typeof s === 'string' ? s : s?.email || '—';
                        return (
                          <li
                            key={`${email}-${idx}`}
                            className="px-3 py-2.5 text-sm font-medium text-stone-800 break-all flex items-center gap-2"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            {email}
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-end gap-2 border-t border-stone-100 bg-stone-50/70 px-4 sm:px-6 py-3 sm:py-3.5 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {onViewReports && (
            <button type="button" className="btn-secondary w-full sm:w-auto justify-center" onClick={onViewReports}>
              Open Email Reports
            </button>
          )}
          <button type="button" className="btn-primary w-full sm:w-auto justify-center" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
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
    <div className={`rounded-xl border px-2.5 sm:px-3 py-2.5 sm:py-3 text-center ${tones[tone]}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${labelTone[tone]}`}>
        {label}
      </p>
      <p className="mt-1 text-xl sm:text-2xl font-semibold tabular-nums tracking-tight">
        {Number(value || 0).toLocaleString()}
      </p>
      {hint ? <p className="mt-0.5 text-[10px] text-stone-500 hidden sm:block">{hint}</p> : null}
    </div>
  );
}
