import React from 'react';
import { Check, X, Loader2, Phone, Download } from 'lucide-react';
import {
  NotifTypeIcon, notifKindLabel, notifHeadline, notifSnippet, timeAgo, dueLabel, dueTone, notifIconTone,
  isCallbackNotif, liveDaysRemaining,
} from './notificationBellHelpers';
import { reportShareMeta } from './reportShareUtils';

export default function NotificationListItem({
  notif,
  processingAction,
  onClick,
  onAccept,
  onDecline,
  onDownloadReport,
}) {
  const busy = processingAction === notif._id + '_accept' || processingAction === notif._id + '_decline';
  const due = dueLabel(notif);
  const headline = notifHeadline(notif);
  const kind = notifKindLabel(notif);
  const snippet = notifSnippet(notif);
  const pendingInvite = notif.type === 'invitation' && notif.actionRequired && notif.status === 'pending';
  const unread = !notif.isRead;
  const callback = isCallbackNotif(notif);
  const reportShare = notif.type === 'report_shared';
  const days = liveDaysRemaining(notif);
  const reportMeta = reportShare ? reportShareMeta(notif) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={`w-full text-left px-3.5 sm:px-4 py-3 transition-colors group cursor-pointer ${
        unread
          ? reportShare
            ? 'bg-emerald-50/50 hover:bg-emerald-50/80 ring-1 ring-inset ring-emerald-100/80'
            : 'bg-brand-50/35 hover:bg-brand-50/55'
          : 'bg-white hover:bg-stone-50'
      }`}
    >
      <div className="flex gap-3 min-w-0">
        <div className="relative mt-0.5 flex-shrink-0">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${notifIconTone(notif.type, notif.priority, days)}`}>
            <NotifTypeIcon type={notif.type} priority={notif.priority} daysRemaining={days} />
          </span>
          {unread ? (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white" />
          ) : null}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-[10px] font-bold uppercase tracking-[0.08em] truncate ${
              reportShare ? 'text-emerald-700/80' : 'text-stone-400'
            }`}>
              {kind}
            </p>
            <span className="text-[11px] text-stone-400 tabular-nums whitespace-nowrap font-medium">
              {timeAgo(notif.createdAt)}
            </span>
          </div>
          <div className="mt-0.5 flex items-start justify-between gap-2">
            <p className={`text-[13px] leading-5 line-clamp-2 min-w-0 ${unread ? 'font-semibold text-stone-900' : 'font-medium text-stone-700'}`}>
              {headline}
            </p>
            {due ? (
              <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ring-1 whitespace-nowrap ${dueTone(notif)}`}>
                {due}
              </span>
            ) : null}
          </div>
          {snippet && snippet !== headline ? (
            <p className="mt-1 text-[12px] text-stone-500 leading-relaxed line-clamp-1">{snippet}</p>
          ) : null}
          {callback && notif.candidateContact ? (
            <a
              href={`tel:${notif.candidateContact}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
            >
              <Phone size={11} />
              Call
            </a>
          ) : null}

          {reportShare ? (
            <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onDownloadReport?.(notif)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
              >
                <Download size={11} />
                Download {reportMeta?.formatLabel || 'PDF'}
              </button>
            </div>
          ) : null}

          {pendingInvite && (
            <div className="flex items-center gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onAccept(notif)}
                disabled={busy}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-brand-600 text-white text-[11px] font-semibold hover:bg-brand-700 disabled:opacity-50"
              >
                {processingAction === notif._id + '_accept' ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                Accept
              </button>
              <button
                type="button"
                onClick={() => onDecline(notif)}
                disabled={busy}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-stone-200 bg-white text-stone-700 text-[11px] font-semibold hover:bg-stone-50 disabled:opacity-50"
              >
                {processingAction === notif._id + '_decline' ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                Decline
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
