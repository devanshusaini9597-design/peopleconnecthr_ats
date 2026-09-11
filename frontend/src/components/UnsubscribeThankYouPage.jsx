import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import PublicMarketingShell, {
  primaryBtnClassName,
  secondaryBtnClassName,
} from './PublicMarketingShell';

const UnsubscribeThankYouPage = () => {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');
  const errorMsg = error
    ? error === 'invalid'
      ? 'The email on this link is missing or invalid.'
      : error === 'invalid_link'
        ? 'This link is invalid or has expired. Please try again from a recent message.'
        : error === 'unavailable'
          ? 'Preference updates are temporarily unavailable. Please try again shortly.'
          : 'We could not update your preferences. Please try again.'
    : null;

  return (
    <PublicMarketingShell
      eyebrow={errorMsg ? 'Action needed' : 'Preferences updated'}
      title={errorMsg ? 'Unable to update preferences' : 'You are unsubscribed'}
      subtitle={
        errorMsg
          ? undefined
          : 'You will no longer receive marketing emails about open roles and hiring drives from Skillnix Recruitment.'
      }
      backTo="/unsubscribe"
      backLabel="Back to preferences"
    >
      {errorMsg ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 leading-relaxed">{errorMsg}</p>
          </div>
          <Link to="/unsubscribe" className={`${primaryBtnClassName} no-underline`}>
            Try again
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
            <CheckCircle2 className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700 leading-relaxed">
              Your preference is saved. You will not receive further marketing updates unless
              you choose to subscribe again.
            </p>
          </div>

          <div className="rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-4">
            <p className="text-sm font-semibold text-slate-900">Want updates again later?</p>
            <p className="mt-1 text-[13px] text-slate-600 leading-relaxed">
              You can rejoin our talent network anytime for curated roles and hiring drives.
            </p>
            <Link
              to="/subscribe"
              className={`${primaryBtnClassName} no-underline mt-4`}
            >
              Subscribe to job &amp; career updates
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <Link to="/unsubscribe" className={`${secondaryBtnClassName} no-underline`}>
            Manage another email
          </Link>
        </div>
      )}
    </PublicMarketingShell>
  );
};

export default UnsubscribeThankYouPage;
