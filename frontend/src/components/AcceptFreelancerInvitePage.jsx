import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle, AlertCircle, Eye, EyeOff, Loader2, User, Lock, Mail, Shield,
} from 'lucide-react';
import API_URL from '../config';
import { clearClientAuthStorage } from '../utils/authUtils';

const AcceptFreelancerInvitePage = () => {
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
        const invite = data.invite || {
          email: data.data?.email || '',
          role: data.data?.role || '',
          organization: { name: data.data?.orgName || '' },
          inviter: { name: data.data?.inviterName || 'A teammate' },
        };
        if (!invite.email) {
          throw new Error('Invite is missing an email address. Ask your contact to resend the link.');
        }
        setInviteData(invite);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    verifyInvite();
  }, [token]);

  const orgName = inviteData?.organization?.name || 'Skillnix Recruitment';
  const inviterName = inviteData?.inviter?.name || 'A teammate';
  const inviteEmail = inviteData?.email || '';
  const signInUrl = `/login?email=${encodeURIComponent(inviteEmail)}`;

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

      try {
        await fetch(`${API_URL}/api/logout`, {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
        });
      } catch {
        /* still continue to sign-in */
      }
      clearClientAuthStorage();
      localStorage.removeItem('ats_token');

      setSuccess(true);
      setTimeout(() => {
        navigate(`${signInUrl}&activated=1`, { replace: true });
      }, 1400);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stage = (children) => (
    <div className="relative min-h-screen overflow-hidden bg-[#0b1020] text-white flex flex-col">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[28rem] w-[42rem] rounded-full bg-indigo-600/35 blur-[140px]" />
        <div className="absolute bottom-[-8rem] left-[-6rem] h-[22rem] w-[22rem] rounded-full bg-violet-700/30 blur-[120px]" />
        <div className="absolute bottom-[-4rem] right-[-4rem] h-[20rem] w-[20rem] rounded-full bg-teal-500/20 blur-[110px]" />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-4 px-5 sm:px-8 py-5">
        <img
          src="/skillnix-logo-email.png"
          alt="Skillnix"
          className="h-8 sm:h-9 w-auto object-contain mix-blend-screen"
        />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-wide text-indigo-100">
          <Shield className="h-3 w-3" />
          Secure invitation
        </span>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6 sm:py-10">
        {children}
      </main>

      <footer className="relative z-10 px-5 pb-5 text-center text-[11px] text-white/35">
        © {new Date().getFullYear()} Skillnix Recruitment · Partner workspace
      </footer>
    </div>
  );

  const card = (inner) => (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-[480px]"
    >
      <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-indigo-300/50 via-white/10 to-teal-300/30 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.65)]">
        <div className="rounded-2xl overflow-hidden bg-white text-stone-900">
          {inner}
        </div>
      </div>
    </motion.div>
  );

  if (loading) {
    return stage(
      card(
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-stone-500">
          <Loader2 className="h-8 w-8 text-indigo-700 animate-spin" />
          <p className="text-sm font-medium">Validating invitation…</p>
        </div>
      )
    );
  }

  if (error && !inviteData) {
    return stage(
      card(
        <div className="p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Invitation unavailable</h1>
          <p className="text-sm text-stone-500 mt-2 leading-relaxed">{error}</p>
          <Link to="/login" className="btn-cta-primary mt-6 w-full !py-3">
            Return to sign in
          </Link>
        </div>
      )
    );
  }

  return stage(
    card(
      <>
        <div className="relative bg-[#1e1b4b] px-6 sm:px-7 pt-6 pb-5 text-white overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true">
            <div className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-violet-500/50 blur-3xl" />
            <div className="absolute -bottom-10 -left-8 h-32 w-32 rounded-full bg-teal-400/30 blur-2xl" />
          </div>
          <div className="relative">
            <h1 className="text-[1.45rem] font-semibold tracking-tight leading-snug">
              Activate account
            </h1>
            <p className="mt-1.5 text-sm text-indigo-100/80">
              {inviterName} · {orgName}
            </p>
          </div>
        </div>

        <div className="px-6 sm:px-7 py-6">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="ok"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-6"
                role="status"
              >
                <div className="mx-auto h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <h2 className="text-lg font-semibold tracking-tight">Account ready</h2>
                <p className="text-sm text-stone-500 mt-2">Redirecting to sign in…</p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
                onSubmit={handleSubmit}
              >
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-red-800">{error}</span>
                  </div>
                )}

                <div>
                  <label className="label-ats">Email</label>
                  <div className="relative rounded-xl auth-input-glow">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                    <input
                      type="email"
                      readOnly
                      tabIndex={-1}
                      value={inviteEmail}
                      className="input-ats !pl-10 !bg-stone-50 cursor-default"
                      aria-readonly="true"
                    />
                  </div>
                </div>

                <div>
                  <label className="label-ats">Name</label>
                  <div className="relative rounded-xl auth-input-glow">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                    <input
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="input-ats !pl-10 font-semibold uppercase tracking-wide"
                      placeholder="Your name"
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div>
                  <label className="label-ats">Password</label>
                  <div className="relative rounded-xl auth-input-glow">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="input-ats !pl-10 !pr-11"
                      placeholder="Minimum 8 characters"
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
                          className={`h-1 flex-1 rounded-full ${
                            strength >= level
                              ? strength <= 2
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                              : 'bg-stone-200'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="label-ats">Confirm password</label>
                  <div className="relative rounded-xl auth-input-glow">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                    <input
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="input-ats !pl-10"
                      placeholder="Re-enter password"
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer pt-0.5">
                  <input
                    id="agreed"
                    name="agreed"
                    type="checkbox"
                    required
                    checked={formData.agreed}
                    onChange={handleChange}
                    className="mt-0.5 h-4 w-4 rounded border-stone-300 text-indigo-700 focus:ring-indigo-600"
                  />
                  <span className="text-xs text-stone-600 leading-relaxed">
                    I agree to the Terms of Service and Privacy Policy.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-cta-primary w-full !py-3.5 disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Activate access'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {!success && (
            <p className="mt-5 text-center text-xs text-stone-500">
              <Link to={signInUrl} className="font-semibold text-indigo-800 hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </>
    )
  );
};

export default AcceptFreelancerInvitePage;
