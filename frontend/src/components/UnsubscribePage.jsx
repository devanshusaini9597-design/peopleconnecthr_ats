import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import BASE_API_URL from '../config';
import PublicMarketingShell, {
  FieldLabel,
  fieldClassName,
  dangerBtnClassName,
  primaryBtnClassName,
  secondaryBtnClassName,
} from './PublicMarketingShell';

const UnsubscribePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const e = searchParams.get('email');
    if (e && e.includes('@')) setEmail(e.trim());
  }, [searchParams]);

  const orgSlug = (searchParams.get('org') || searchParams.get('orgSlug') || '').trim();
  const orgId = (searchParams.get('orgId') || '').trim();
  const subscribeQs = [
    email.trim() ? `email=${encodeURIComponent(email.trim())}` : '',
    orgSlug ? `org=${encodeURIComponent(orgSlug)}` : '',
    orgId ? `orgId=${encodeURIComponent(orgId)}` : '',
  ]
    .filter(Boolean)
    .join('&');
  const subscribePath = subscribeQs ? `/subscribe?${subscribeQs}` : '/subscribe';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const emailTrim = (email || '').trim().toLowerCase();
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_API_URL}/api/public/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailTrim,
          ...(orgSlug ? { orgSlug } : {}),
          ...(orgId ? { orgId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        navigate('/unsubscribe/thank-you', { replace: true });
        return;
      }
      setError(data.message || 'We could not update your preferences. Please try again.');
    } catch {
      setError('Unable to connect. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicMarketingShell
      eyebrow="Email preferences"
      title="Manage your email preferences"
      subtitle="Stop marketing updates from Skillnix Recruitment, or keep receiving curated roles and hiring drives."
      backTo="/subscribe"
      backLabel="Back to subscribe"
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && (
          <div
            role="alert"
            className="bg-red-50 text-red-700 text-sm rounded-xl px-3.5 py-3 border border-red-100"
          >
            {error}
          </div>
        )}

        <div>
          <FieldLabel required>Email address</FieldLabel>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={fieldClassName}
            required
          />
          <p className="mt-2 text-[12px] text-slate-500 leading-relaxed">
            This only affects marketing updates (open roles and hiring drives). Transactional
            messages such as interview or offer email are separate.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className={dangerBtnClassName}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Updating preferences…
            </>
          ) : (
            'Unsubscribe from marketing updates'
          )}
        </button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-stone-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-[11px] font-medium uppercase tracking-wider text-stone-400">
              Or
            </span>
          </div>
        </div>

        <Link to={subscribePath} className={`${primaryBtnClassName} no-underline`}>
          Stay subscribed — get job updates
          <ArrowRight className="w-4 h-4" />
        </Link>

        <Link to={subscribePath} className={`${secondaryBtnClassName} no-underline`}>
          Subscribe with a different email
        </Link>
      </form>
    </PublicMarketingShell>
  );
};

export default UnsubscribePage;
