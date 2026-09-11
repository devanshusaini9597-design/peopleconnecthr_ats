import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Mail,
  Megaphone,
  X,
} from 'lucide-react';

/**
 * Enterprise campaign / bulk-send results summary.
 * Shows sent vs failed counts and per-recipient failure reasons.
 */
export default function EmailCampaignResultModal({
  open,
  result,
  onClose,
  onViewReports,
}) {
  if (!open || !result) return null;

  const {
    title = 'Campaign complete',
    channel = 'transactional',
    total = 0,
    sent = 0,
    failed = 0,
    successRate,
    failures = [],
    successes = [],
  } = result;

  const rate =
    successRate ||
    (total > 0 ? `${((sent / total) * 100).toFixed(1)}%` : '0%');

  const allFailed = failed > 0 && sent === 0;
  const allOk = failed === 0 && sent > 0;

  const banner = allOk
    ? {
        wrap: 'bg-emerald-50 border-emerald-200',
        iconWrap: 'bg-emerald-100 text-emerald-700',
        title: 'All emails processed successfully',
        Icon: CheckCircle2,
      }
    : allFailed
      ? {
          wrap: 'bg-rose-50 border-rose-200',
          iconWrap: 'bg-rose-100 text-rose-700',
          title: 'No emails were delivered',
          Icon: XCircle,
        }
      : {
          wrap: 'bg-amber-50 border-amber-200',
          iconWrap: 'bg-amber-100 text-amber-700',
          title: 'Campaign finished with some failures',
          Icon: AlertTriangle,
        };

  const BannerIcon = banner.Icon;
  const ChannelIcon = channel === 'marketing' ? Megaphone : Mail;

  return (
    <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-stone-900/45 backdrop-blur-[1px]">
      <div
        className="absolute inset-0"
        onClick={onClose}
        onKeyDown={() => {}}
        role="presentation"
      />
      <div
        className="relative modal-panel-ats w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl animate-page-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-campaign-result-title"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

        <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              <ChannelIcon className="h-3.5 w-3.5 text-brand-600" />
              {channel === 'marketing' ? 'Marketing campaign' : 'Bulk email'}
            </div>
            <h2 id="email-campaign-result-title" className="mt-1 text-lg font-bold tracking-tight text-stone-900">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-stone-500 hover:bg-stone-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div className={`rounded-2xl border p-4 text-center ${banner.wrap}`}>
            <div className={`mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full ${banner.iconWrap}`}>
              <BannerIcon className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <p className="font-bold text-stone-900">{banner.title}</p>
            <p className="mt-1 text-sm text-stone-600">
              {sent} sent · {failed} failed · {total} total
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-3 py-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Total</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-stone-900">{total}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Sent</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">{sent}</p>
            </div>
            <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 px-3 py-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Failed</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-rose-800">{failed}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Success rate</p>
                <p className="text-sm text-stone-600">Overall campaign performance</p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-brand-700">{rate}</p>
            </div>
          </div>

          {failures.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-stone-900">
                Failed recipients ({failures.length})
              </h3>
              <div className="max-h-48 overflow-y-auto rounded-2xl border border-rose-200/80">
                <table className="min-w-full divide-y divide-rose-100 text-sm">
                  <thead className="bg-rose-50/80 text-left text-xs font-semibold uppercase tracking-wide text-rose-700">
                    <tr>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50 bg-white">
                    {failures.map((f) => (
                      <tr key={`${f.email}-${f.error || f.reason}`}>
                        <td className="px-3 py-2 align-top break-all font-medium text-stone-800">
                          {f.email || '—'}
                        </td>
                        <td className="px-3 py-2 align-top text-rose-700">
                          {f.displayMessage || f.error || f.reason || 'Unknown error'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {successes.length > 0 && successes.length <= 20 && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-stone-900">
                Sent successfully ({successes.length})
              </h3>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 px-3 py-2 text-xs text-stone-600">
                {successes.map((s) => (typeof s === 'string' ? s : s.email)).filter(Boolean).join(', ')}
              </div>
            </div>
          )}
          {successes.length > 20 && (
            <p className="text-xs text-stone-500">
              {successes.length} recipients accepted successfully.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3">
          {onViewReports && (
            <button type="button" className="btn-secondary" onClick={onViewReports}>
              View email reports
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
