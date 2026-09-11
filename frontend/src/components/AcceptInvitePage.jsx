import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle, AlertCircle, Eye, EyeOff, Loader2, Building2, User, Lock, Mail, Shield,
} from 'lucide-react';
import API_URL from '../config';
import { formatRoleLabel } from './organization/constants';

const AcceptInvitePage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inviteData, setInviteData] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: '',
    agreed: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided.');
      setLoading(false);
      return;
    }

    const verifyInvite = async () => {
      try {
        const res = await fetch(`${API_URL}/api/onboarding/invite/${token}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || 'Invalid or expired invitation link');
        }

        // Prefer `invite` (current), fall back to legacy `data`
        const invite = data.invite || {
          email: data.data?.email || '',
          role: data.data?.role || '',
          organization: { name: data.data?.orgName || '' },
          inviter: { name: data.data?.inviterName || 'A teammate' },
        };
        if (!invite.email) {
          throw new Error('Invite is missing an email address. Ask your admin to resend the link.');
        }
        if (invite.role === 'freelancer') {
          navigate(`/accept-freelancer-invite?token=${encodeURIComponent(token)}`, { replace: true });
          return;
        }
        setInviteData(invite);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    verifyInvite();
  }, [token, navigate]);

  const roleLabel = useMemo(() => formatRoleLabel(inviteData?.role), [inviteData?.role]);

  const orgName = inviteData?.organization?.name || 'the organization';
  const inviterName = inviteData?.inviter?.name || 'a teammate';
  const inviteEmail = inviteData?.email || '';

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let next = type === 'checkbox' ? checked : value;
    if (name === 'name' && typeof next === 'string') {
      next = next.replace(/^\s+/, '').replace(/\s{2,}/g, ' ').toUpperCase();
    }
    setFormData((prev) => ({ ...prev, [name]: next }));
  };

  const getPasswordStrength = (pwd) => {
    let score = 0;
    if (pwd.length > 7) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = getPasswordStrength(formData.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!formData.agreed) {
      setError('You must agree to the Terms of Service');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/onboarding/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          token,
          name: formData.name,
          password: formData.password,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to accept invitation');

      localStorage.removeItem('token');
      localStorage.removeItem('ats_token');
      localStorage.setItem('isLoggedIn', 'true');

      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1600);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const shell = (children) => (
    <div className="min-h-screen relative overflow-hidden bg-stone-100 flex flex-col justify-center py-10 sm:py-14 px-4">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(13,148,136,0.12),_transparent_55%),linear-gradient(180deg,#f5f5f4_0%,#ffffff_45%,#f0fdfa_100%)]"
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md mx-auto">{children}</div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-stone-500">
        <Loader2 className="h-9 w-9 text-brand-600 animate-spin" />
        <p className="text-sm font-medium">Verifying invitation…</p>
      </div>
    );
  }

  if (error && !inviteData) {
    return shell(
      <div className="rounded-2xl border border-stone-200/80 bg-white shadow-xl shadow-stone-900/10 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="p-8 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-red-50 ring-1 ring-red-100 flex items-center justify-center mb-5">
            <AlertCircle className="h-7 w-7 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Invalid invitation</h2>
          <p className="text-sm text-stone-500 mt-2 leading-relaxed">{error}</p>
          <Link to="/login" className="btn-primary mt-6 w-full justify-center">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return shell(
      <div className="rounded-2xl border border-stone-200/80 bg-white shadow-xl shadow-stone-900/10 overflow-hidden animate-fade-in">
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="p-8 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center mb-5">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Welcome aboard</h2>
          <p className="text-sm text-stone-500 mt-2">
            Your account for <span className="font-semibold text-stone-800">{inviteEmail}</span> is ready.
          </p>
          <p className="text-xs text-brand-700 font-semibold mt-3">Opening your workspace…</p>
        </div>
      </div>
    );
  }

  return shell(
    <>
      <div className="text-center mb-6">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-teal-600 shadow-md shadow-brand-500/30 mb-4">
          <Building2 className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-2xl sm:text-[1.65rem] font-bold text-stone-900 tracking-tight">
          Join {orgName}
        </h1>
        <p className="mt-2 text-sm text-stone-500 leading-relaxed max-w-sm mx-auto">
          <span className="font-semibold text-stone-700">{inviterName}</span>
          {' '}invited you as{' '}
          <span className="inline-flex items-center gap-1 font-semibold text-brand-800">
            <Shield size={12} className="inline" />
            {roleLabel}
          </span>
        </p>
      </div>

      <div className="rounded-2xl border border-stone-200/80 bg-white shadow-xl shadow-stone-900/10 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="px-5 sm:px-7 py-3.5 border-b border-stone-100 bg-gradient-to-r from-stone-50/90 via-white to-teal-50/25">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">Secure join</p>
          <p className="text-xs text-stone-500 mt-0.5">
            You will sign in with the invited email below — do not create a new organization.
          </p>
        </div>

        <form className="p-5 sm:p-7 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-red-800">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">
              Work email <span className="text-stone-400 font-medium">(read only)</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-600 pointer-events-none" />
              <input
                type="email"
                readOnly
                tabIndex={-1}
                value={inviteEmail}
                className="w-full pl-10 pr-3 py-3 rounded-xl border border-brand-200 bg-brand-50/40 text-sm font-semibold text-stone-800 outline-none cursor-default select-all"
                aria-readonly="true"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-stone-500">
              Login stays tied to this address after you join.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Full name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
              <input
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-3 rounded-xl border border-stone-200 bg-white text-sm font-semibold uppercase tracking-wide text-stone-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all"
                placeholder="YOUR FULL NAME"
                autoComplete="name"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-10 pr-11 py-3 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all"
                placeholder="Min. 8 characters"
                minLength={8}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {formData.password && (
              <div className="mt-2 flex items-center gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      strength >= level
                        ? strength <= 2
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                        : 'bg-stone-200'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Confirm password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
              <input
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-3 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all"
                placeholder="Repeat password"
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input
              id="agreed"
              name="agreed"
              type="checkbox"
              required
              checked={formData.agreed}
              onChange={handleChange}
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-xs text-stone-600 leading-relaxed">
              I agree to the Terms of Service and Privacy Policy, and will use{' '}
              <span className="font-semibold text-stone-800">{inviteEmail}</span> to sign in.
            </span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full justify-center py-3 text-sm disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Accept invitation & join'}
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-[11px] text-stone-400">
        Already have access?{' '}
        <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800">
          Sign in
        </Link>
      </p>
    </>
  );
};

export default AcceptInvitePage;
