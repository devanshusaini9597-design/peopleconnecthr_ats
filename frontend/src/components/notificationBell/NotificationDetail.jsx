import React, { useState } from 'react';
import {
  ArrowLeft, Check, Clock, Calendar, Phone, Mail, Eye, Users, Share2, UserPlus, UserX, Briefcase, Download, Loader2, FileText,
} from 'lucide-react';
import {
  notifKindLabel, notifHeadline, timeAgo, dueLabel, dueTone, formatNotifDate,
  isFreelanceReview, reviewStageFromNotif, reviewBodyFromNotif, notifSnippet,
} from './notificationBellHelpers';
import { reportShareMeta } from './reportShareUtils';
import { ReviewMemo } from '../ui/ReviewMemo';
import PresenceAvatar from '../ui/PresenceAvatar';

function MetaRow({ label, children }) {
  if (!children) return null;
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 py-2.5 border-b border-stone-100 last:border-0 text-[13px]">
      <dt className="text-stone-500 font-medium">{label}</dt>
      <dd className="text-stone-900 min-w-0 break-words text-right sm:text-left">{children}</dd>
    </div>
  );
}

export default function NotificationDetail({
  selectedNotif,
  processingAction,
  onBack,
  onAccept,
  onDecline,
  onViewTeam,
  onViewCandidate,
  onDismiss,
  onDownloadReport,
  copyPhone,
  isFreelancer = false,
}) {
  const kind = notifKindLabel(selectedNotif);
  const headline = notifHeadline(selectedNotif);
  const due = dueLabel(selectedNotif);
  const isInviteFamily = ['invitation', 'invitation_accepted', 'invitation_declined'].includes(selectedNotif.type);
  const isCallback = ['callback_reminder', 'callback_today', 'callback_overdue'].includes(selectedNotif.type);
  const isJob = selectedNotif.type === 'job_opening';
  const isFreelanceSub = selectedNotif.type === 'freelancer_submission';
  const isReportShared = selectedNotif.type === 'report_shared';
  const pendingInvite = selectedNotif.type === 'invitation' && selectedNotif.status === 'pending' && selectedNotif.actionRequired;
  const snippet = notifSnippet(selectedNotif);
  const reportMeta = isReportShared ? reportShareMeta(selectedNotif) : null;
  const [downloading, setDownloading] = useState(false);

  const subtitle = isJob
    ? null
    : selectedNotif.candidatePosition
      || (isInviteFamily ? (selectedNotif.senderName ? `From ${selectedNotif.senderName}` : null) : null)
      || (isReportShared ? null : null)
      || (isFreelanceSub ? (selectedNotif.senderName ? `Submitted by ${selectedNotif.senderName}` : 'Freelance recruiter') : null);

  const jobParts = isJob
    ? String(selectedNotif.message || '').split(' · ').map((s) => s.trim()).filter(Boolean)
    : [];

  const handleDownload = async () => {
    if (!onDownloadReport || downloading) return;
    setDownloading(true);
    try {
      await onDownloadReport(selectedNotif);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-4 pt-3 pb-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 hover:text-brand-800"
        >
          <ArrowLeft size={13} />
          Inbox
        </button>
      </div>

      <div className="px-4 pt-4 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-700/80">{kind}</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h4 className="text-[15px] font-semibold text-stone-900 leading-snug tracking-tight break-words">
            {headline}
          </h4>
          {due && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 whitespace-nowrap mt-0.5 ${dueTone(selectedNotif)}`}>
              {due}
            </span>
          )}
        </div>
        {subtitle ? <p className="text-[12px] text-stone-500 mt-1">{subtitle}</p> : null}
      </div>

      {isReportShared ? (
        <div className="mx-4 rounded-xl border border-stone-200 bg-gradient-to-b from-stone-50/80 to-white overflow-hidden">
          <div className="px-3.5 py-3 flex items-center gap-3 border-b border-stone-100">
            <PresenceAvatar
              name={selectedNotif.senderName}
              email={selectedNotif.relatedEmail}
              size={40}
              ringClass="ring-white"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-stone-900 truncate">
                {selectedNotif.senderName || 'Teammate'}
              </p>
              <p className="text-[11px] text-stone-500 truncate">
                Shared a {reportMeta.formatLabel} report with you
              </p>
            </div>
            <span className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase tracking-wide ring-1 ring-emerald-100">
              <FileText size={11} />
              {reportMeta.formatLabel}
            </span>
          </div>
          <dl className="px-3.5">
            <MetaRow label="Report">{reportMeta.reportLabel}</MetaRow>
            {reportMeta.periodLabel ? <MetaRow label="Period">{reportMeta.periodLabel}</MetaRow> : null}
            <MetaRow label="Received">
              <span className="inline-flex items-center gap-1.5 text-stone-500">
                <Clock size={12} className="text-stone-400" />
                {timeAgo(selectedNotif.createdAt)}
              </span>
            </MetaRow>
            {selectedNotif.relatedEmail ? (
              <MetaRow label="From">
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={12} className="text-stone-400" />
                  {selectedNotif.relatedEmail}
                </span>
              </MetaRow>
            ) : null}
          </dl>
          {reportMeta.note ? (
            <div className="mx-3.5 mb-3.5 mt-1 rounded-lg bg-amber-50/80 border border-amber-100 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800/80 mb-1">Note</p>
              <p className="text-[13px] text-stone-800 leading-relaxed whitespace-pre-wrap">{reportMeta.note}</p>
            </div>
          ) : (
            <div className="h-2" />
          )}
        </div>
      ) : (
        <dl className="mx-4 rounded-lg border border-stone-200 bg-white px-3.5">
          {isJob && jobParts[0] ? <MetaRow label="Role">{jobParts[0]}</MetaRow> : null}
          {isJob && jobParts[1] ? <MetaRow label="Location">{jobParts[1]}</MetaRow> : null}
          {isJob && jobParts[2] ? <MetaRow label="Client">{jobParts[2]}</MetaRow> : null}
          {selectedNotif.relatedEmail && (
            <MetaRow label="From">
              <span className="inline-flex items-center gap-1.5 justify-end sm:justify-start">
                <Mail size={12} className="text-stone-400" />
                {selectedNotif.relatedEmail}
              </span>
            </MetaRow>
          )}
          {isFreelanceSub && selectedNotif.senderName && (
            <MetaRow label="Recruiter">{selectedNotif.senderName}</MetaRow>
          )}
          {selectedNotif.candidateContact && (
            <MetaRow label="Phone">
              <span className="inline-flex items-center gap-2 justify-end sm:justify-start">
                <Phone size={12} className="text-stone-400" />
                <span className="font-medium tabular-nums">{selectedNotif.candidateContact}</span>
                <button
                  type="button"
                  onClick={() => copyPhone(selectedNotif.candidateContact)}
                  className="text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                >
                  Copy
                </button>
              </span>
            </MetaRow>
          )}
          {selectedNotif.callBackDate && (
            <MetaRow label="Callback">
              <span className="inline-flex items-center gap-1.5 justify-end sm:justify-start">
                <Calendar size={12} className="text-stone-400" />
                {formatNotifDate(selectedNotif.callBackDate)}
              </span>
            </MetaRow>
          )}
          {selectedNotif.senderName && (isJob || isCallback) ? (
            <MetaRow label="From">{selectedNotif.senderName}</MetaRow>
          ) : null}
          <MetaRow label="Received">
            <span className="inline-flex items-center gap-1.5 justify-end sm:justify-start text-stone-500">
              <Clock size={12} className="text-stone-400" />
              {timeAgo(selectedNotif.createdAt)}
            </span>
          </MetaRow>
        </dl>
      )}

      {isFreelanceSub && isFreelanceReview(selectedNotif) ? (
        <div className="px-4 pt-4 space-y-2.5">
          {reviewStageFromNotif(selectedNotif) ? (
            <p className="text-[12px] text-stone-500">
              Moved to{' '}
              <span className="font-semibold text-stone-800">{reviewStageFromNotif(selectedNotif)}</span>
            </p>
          ) : null}
          <ReviewMemo
            text={reviewBodyFromNotif(selectedNotif)}
            at={selectedNotif.createdAt}
            emptyLabel="Stage updated. Open the pipeline board for the full handoff."
          />
        </div>
      ) : isCallback || isJob || isReportShared ? null : selectedNotif.message ? (
        <p className="px-4 pt-4 text-[13px] text-stone-600 leading-relaxed">
          {selectedNotif.message}
        </p>
      ) : null}

      {!isJob && !isCallback && !isReportShared && snippet && snippet !== headline && !selectedNotif.message ? (
        <p className="px-4 pt-3 text-[12px] text-stone-500">{snippet}</p>
      ) : null}

      <div className="mt-auto px-4 py-4 flex flex-col gap-2">
        {pendingInvite && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onAccept(selectedNotif)}
              disabled={!!processingAction}
              className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-brand-600 text-white text-[12px] font-semibold hover:bg-brand-700 disabled:opacity-50"
            >
              <UserPlus size={13} />
              Accept
            </button>
            <button
              type="button"
              onClick={() => onDecline(selectedNotif)}
              disabled={!!processingAction}
              className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-brand-200 bg-white text-brand-800 text-[12px] font-semibold hover:bg-brand-50 disabled:opacity-50"
            >
              <UserX size={13} />
              Decline
            </button>
          </div>
        )}

        {isInviteFamily && (
          <button
            type="button"
            onClick={onViewTeam}
            className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-brand-600 text-white text-[12px] font-semibold hover:bg-brand-700"
          >
            <Users size={13} />
            Open team
          </button>
        )}

        {selectedNotif.type === 'share_request' && (
          <button
            type="button"
            onClick={onViewCandidate}
            className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-brand-600 text-white text-[12px] font-semibold hover:bg-brand-700"
          >
            <Share2 size={13} />
            View shared candidates
          </button>
        )}

        {isReportShared && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-brand-600 text-white text-[12px] font-semibold hover:bg-brand-700 disabled:opacity-50"
          >
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {downloading ? 'Preparing…' : `Download ${reportMeta.formatLabel}`}
          </button>
        )}

        {isFreelanceSub && (
          <button
            type="button"
            onClick={onViewCandidate}
            className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-brand-600 text-white text-[12px] font-semibold hover:bg-brand-700"
          >
            <Eye size={13} />
            {isFreelancer ? 'Open pipeline' : 'Review submission'}
          </button>
        )}

        {isJob && (
          <button
            type="button"
            onClick={onViewCandidate}
            className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-brand-600 text-white text-[12px] font-semibold hover:bg-brand-700"
          >
            <Briefcase size={13} />
            Open Jobs
          </button>
        )}

        {isCallback && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onViewCandidate}
              className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-brand-600 text-white text-[12px] font-semibold hover:bg-brand-700"
            >
              <Eye size={13} />
              Open in ATS
            </button>
            {selectedNotif.candidateContact ? (
              <a
                href={`tel:${selectedNotif.candidateContact}`}
                className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-brand-200 bg-white text-brand-800 text-[12px] font-semibold hover:bg-brand-50"
              >
                <Phone size={13} />
                Call
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onDismiss(selectedNotif._id)}
                className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-brand-200 bg-white text-brand-800 text-[12px] font-semibold hover:bg-brand-50"
              >
                <Check size={13} />
                Done
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => onDismiss(selectedNotif._id)}
          className="inline-flex items-center justify-center h-9 text-[12px] font-medium text-stone-500 hover:text-stone-800"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
