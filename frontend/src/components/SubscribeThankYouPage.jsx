import React from 'react';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Bell,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import PublicMarketingShell, {
  primaryBtnClassName,
  premiumBtnClassName,
  secondaryBtnClassName,
  COMPANY_SITE,
} from './PublicMarketingShell';

const ERROR_COPY = {
  invalid: {
    title: 'We could not verify this request',
    body: 'The email on this link is missing or invalid. Please use Subscribe from your latest message, or enter your email on the subscribe page.',
  },
  invalid_link: {
    title: 'This link is no longer valid',
    body: 'Subscription links expire for security. Open your most recent email and select Subscribe again, or use the form below.',
  },
  unavailable: {
    title: 'Subscription is temporarily unavailable',
    body: 'Our mailing service is being updated. Please try again shortly. Your preference has not been saved yet.',
  },
  failed: {
    title: 'We could not complete your subscription',
    body: 'Something went wrong while saving your preference. Please try again. If this continues, reply to the email you received and our team will assist.',
  },
};

export default function SubscribeThankYouPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const error = searchParams.get('error');
  const status = searchParams.get('status') || location.state?.status || '';
  const prefillEmail = String(location.state?.email || searchParams.get('email') || '').trim();
  const reactivatePath = prefillEmail
    ? `/subscribe/reactivate?email=${encodeURIComponent(prefillEmail)}`
    : '/subscribe/reactivate';
  const err = error ? ERROR_COPY[error] || ERROR_COPY.failed : null;
  const pending = !err && status === 'pending';
  const zohoReactivate = !err && status === 'zoho_reactivate';
  const consentOnly = !err && status === 'consent_saved';
  const needsAttention = pending || zohoReactivate || consentOnly;

  const title = err
    ? err.title
    : pending
      ? 'Confirm your email to finish'
      : zohoReactivate
        ? 'One more step to reactivate'
        : consentOnly
          ? 'Your preference is saved'
          : 'You are subscribed';

  const subtitle = err
    ? undefined
    : pending
      ? 'Please check your inbox for a short confirmation message, then select Confirm to activate job and career updates.'
      : zohoReactivate
        ? 'You previously opted out of marketing email. To receive updates again, please complete the short reactivation step below.'
        : consentOnly
          ? 'We have recorded your request. Activation on our mailing list may take a short time.'
          : 'You will receive marketing updates on open roles, hiring drives, and career opportunities from Skillnix Recruitment.';

  return (
    <PublicMarketingShell
      eyebrow={err ? 'Action needed' : needsAttention ? 'Almost there' : 'Confirmed'}
      title={title}
      subtitle={subtitle}
      backTo="/subscribe"
      backLabel="Back to subscribe"
    >
      {err ? (
        <div className="space-y-6">
          <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/90 px-4 py-3.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 leading-relaxed">{err.body}</p>
          </div>
          <Link to="/subscribe" className={`${primaryBtnClassName} no-underline`}>
            Subscribe with email
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${
              needsAttention
                ? 'border-amber-100 bg-amber-50/90'
                : 'border-emerald-100 bg-emerald-50/90'
            }`}
          >
            <CheckCircle2
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                needsAttention ? 'text-amber-600' : 'text-emerald-600'
              }`}
            />
            <div className="text-sm text-slate-700 leading-relaxed space-y-2">
              {pending ? (
                <p>
                  We received your request. After you confirm the message in your inbox,
                  marketing updates will resume for this address.
                </p>
              ) : zohoReactivate ? (
                <>
                  <p>
                    Your preference is saved with Skillnix. Because this address previously
                    unsubscribed from marketing mail, our mailing platform requires one
                    additional confirmation before it will send campaign updates again.
                  </p>
                  <p className="text-slate-600">
                    This is a privacy requirement — we cannot mark you subscribed on the
                    mailing list until that step is completed.
                  </p>
                </>
              ) : consentOnly ? (
                <>
                  <p>
                    Your subscription preference is saved with Skillnix. Delivery on our
                    mailing platform can take a little longer to fully activate.
                  </p>
                  <p className="text-slate-600">
                    If you do not receive updates soon, reply to any recent message from our
                    team and we will help finish activation.
                  </p>
                </>
              ) : (
                <p>
                  Your preference is saved. You can unsubscribe from any marketing email at
                  any time.
                </p>
              )}
            </div>
          </div>

          {zohoReactivate ? (
            <Link to={reactivatePath} className={`${primaryBtnClassName} no-underline`}>
              Complete reactivation
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : null}

          {consentOnly && !zohoReactivate ? (
            <Link to="/subscribe" className={`${primaryBtnClassName} no-underline`}>
              Try subscribe again
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : null}

          <ul className="space-y-3">
            {[
              {
                Icon: Briefcase,
                title: 'Open roles and hiring drives',
                text: 'Curated opportunities matched to how we work with talent.',
              },
              {
                Icon: Bell,
                title: 'Career updates only',
                text: 'Marketing communications — separate from interview or offer email.',
              },
              {
                Icon: ShieldCheck,
                title: 'You stay in control',
                text: 'Unsubscribe or manage preferences from any marketing message.',
              },
            ].map(({ Icon, title: itemTitle, text }) => (
              <li key={itemTitle} className="flex gap-3 items-start">
                <span className="mt-0.5 h-9 w-9 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-700 shrink-0">
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{itemTitle}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{text}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="pt-1 flex flex-col sm:flex-row gap-2.5">
            <a
              href={COMPANY_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className={`${premiumBtnClassName} no-underline sm:flex-1`}
            >
              Visit Skillnix
              <ExternalLink className="w-4 h-4 opacity-90" />
            </a>
            <Link
              to="/unsubscribe"
              className={`${secondaryBtnClassName} no-underline sm:flex-1`}
            >
              Manage preferences
            </Link>
          </div>
        </div>
      )}
    </PublicMarketingShell>
  );
}
