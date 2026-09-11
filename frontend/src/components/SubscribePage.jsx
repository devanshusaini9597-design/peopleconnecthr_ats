import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import BASE_API_URL from '../config';
import PublicMarketingShell, {
  FieldLabel,
  fieldClassName,
  primaryBtnClassName,
} from './PublicMarketingShell';

const SubscribePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const prefill = searchParams.get('email');
    if (prefill && prefill.includes('@')) setEmail(prefill.trim());
  }, [searchParams]);

  const orgSlug = (searchParams.get('org') || searchParams.get('orgSlug') || '').trim();
  const orgId = (searchParams.get('orgId') || '').trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trim = (s) => (s || '').trim();
    const eTrim = trim(email).toLowerCase();
    if (!eTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eTrim)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_API_URL}/api/public/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: eTrim,
          firstName: trim(firstName),
          lastName: trim(lastName),
          ...(orgSlug ? { orgSlug } : {}),
          ...(orgId ? { orgId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const qs = new URLSearchParams();
        if (data.status && data.status !== 'ok') qs.set('status', data.status);
        navigate(`/subscribe/thank-you${qs.toString() ? `?${qs}` : ''}`, {
          replace: true,
          state: {
            signupFormUrl: data.signupFormUrl || '',
            zohoEnrolled: Boolean(data.zohoEnrolled),
            status: data.status || 'ok',
            email: eTrim,
          },
        });
        return;
      }
      setError(data.message || 'Subscription failed. Please try again.');
    } catch {
      setError('Unable to connect. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicMarketingShell
      eyebrow="Job & career updates"
      title="Subscribe to open roles"
      subtitle="Hiring drives, curated positions, and career opportunities from Skillnix Recruitment."
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error ? (
          <div
            role="alert"
            className="bg-red-50 text-red-700 text-sm rounded-lg px-3.5 py-3 border border-red-100"
          >
            {error}
          </div>
        ) : null}

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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel>First name</FieldLabel>
            <input
              type="text"
              name="firstName"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Optional"
              className={fieldClassName}
            />
          </div>
          <div>
            <FieldLabel>Last name</FieldLabel>
            <input
              type="text"
              name="lastName"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Optional"
              className={fieldClassName}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className={primaryBtnClassName}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Subscribing…
            </>
          ) : (
            <>
              Subscribe <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <div className="pt-1 border-t border-stone-100 space-y-3">
          <p className="text-[12px] text-slate-500 leading-relaxed text-center">
            Marketing emails only — separate from interview or offer messages.
            Unsubscribe anytime.
          </p>
          <p className="text-[12px] text-center text-slate-500">
            Already subscribed?{' '}
            <Link
              to="/unsubscribe"
              className="text-teal-800 font-medium underline underline-offset-2 hover:text-teal-950"
            >
              Manage preferences
            </Link>
          </p>
        </div>
      </form>
    </PublicMarketingShell>
  );
};

export default SubscribePage;
