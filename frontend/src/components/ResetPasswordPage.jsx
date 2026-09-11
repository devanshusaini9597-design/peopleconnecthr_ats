import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, Shield, CheckCircle2,
} from 'lucide-react';
import BASE_API_URL from '../config';
import { PASSWORD_RULES } from './profileSettings/profileConstants';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [isVerifying, setIsVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const signInUrl = email
    ? `/login?email=${encodeURIComponent(email)}`
    : '/login';

  useEffect(() => {
    if (!token) {
      setIsVerifying(false);
      setError('No reset token provided. Request a new password reset link.');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`${BASE_API_URL}/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (data.success) {
          setIsValid(true);
          setEmail(data.email || '');
        } else {
          setError(data.message || 'Invalid or expired reset link');
        }
      } catch {
        setError('Could not verify this reset link. Try again.');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');

    const failed = PASSWORD_RULES.find((rule) => !rule.test(newPassword));
    if (failed) {
      setError(failed.label);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch(`${BASE_API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => navigate(signInUrl, { replace: true }), 1600);
      } else {
        setError(data.message || 'Failed to reset password');
      }
    } catch {
      setError('Failed to reset password. Please try again.');
    } finally {
      setIsResetting(false);
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
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[28rem] w-[42rem] rounded-full bg-teal-600/25 blur-[140px]" />
        <div className="absolute bottom-[-8rem] left-[-6rem] h-[22rem] w-[22rem] rounded-full bg-brand-700/30 blur-[120px]" />
        <div className="absolute bottom-[-4rem] right-[-4rem] h-[20rem] w-[20rem] rounded-full bg-teal-500/20 blur-[110px]" />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-4 px-5 sm:px-8 py-5">
        <img
          src="/skillnix-logo-email.png"
          alt="Skillnix"
          className="h-8 sm:h-9 w-auto object-contain mix-blend-screen"
        />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-wide text-teal-100">
          <Shield className="h-3 w-3" />
          Secure reset
        </span>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6 sm:py-10">
        {children}
      </main>

      <footer className="relative z-10 px-5 pb-5 text-center text-[11px] text-white/35">
        © {new Date().getFullYear()} Skillnix Recruitment
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
      <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-teal-300/50 via-white/10 to-brand-400/30 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.65)]">
        <div className="rounded-2xl overflow-hidden bg-white text-stone-900">
          {inner}
        </div>
      </div>
    </motion.div>
  );

  if (isVerifying) {
    return stage(
      card(
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-stone-500">
          <Loader2 className="h-8 w-8 text-brand-700 animate-spin" />
          <p className="text-sm font-medium">Verifying reset link…</p>
        </div>
      )
    );
  }

  if (success) {
    return stage(
      card(
        <div className="p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Password updated</h1>
          <p className="text-sm text-stone-500 mt-2">Redirecting to sign in…</p>
        </div>
      )
    );
  }

  if (!isValid) {
    return stage(
      card(
        <div className="p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Link unavailable</h1>
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
        <div className="relative bg-[#0f3d38] px-6 sm:px-7 pt-6 pb-5 text-white overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true">
            <div className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-teal-400/50 blur-3xl" />
            <div className="absolute -bottom-10 -left-8 h-32 w-32 rounded-full bg-brand-500/30 blur-2xl" />
          </div>
          <div className="relative">
            <h1 className="text-[1.45rem] font-semibold tracking-tight leading-snug">
              Set a new password
            </h1>
            <p className="mt-1.5 text-sm text-teal-50/80 truncate">
              {email || 'Your Skillnix account'}
            </p>
          </div>
        </div>

        <div className="px-6 sm:px-7 py-6">
          <AnimatePresence mode="wait">
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
              onSubmit={handleReset}
            >
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-red-800">{error}</span>
                </div>
              )}

              <div>
                <label className="label-ats" htmlFor="new-password">New password</label>
                <div className="relative rounded-xl auth-input-glow">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-ats !pl-10 !pr-11"
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    required
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
              </div>

              <div>
                <label className="label-ats" htmlFor="confirm-password">Confirm password</label>
                <div className="relative rounded-xl auth-input-glow">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-ats !pl-10 !pr-11"
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && (
                  <p className={`text-xs mt-1.5 flex items-center gap-1 font-medium ${
                    newPassword === confirmPassword ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {newPassword === confirmPassword
                      ? <><CheckCircle2 size={12} /> Passwords match</>
                      : <><AlertCircle size={12} /> Passwords do not match</>}
                  </p>
                )}
              </div>

              <ul className="rounded-xl border border-stone-100 bg-stone-50/80 px-3.5 py-3 space-y-1.5">
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(newPassword);
                  return (
                    <li key={rule.id} className="flex items-center gap-2 text-[12px]">
                      <CheckCircle2 size={13} className={ok ? 'text-emerald-500' : 'text-stone-300'} />
                      <span className={ok ? 'text-stone-800 font-medium' : 'text-stone-500'}>{rule.label}</span>
                    </li>
                  );
                })}
              </ul>

              <button
                type="submit"
                disabled={isResetting || !newPassword || !confirmPassword}
                className="btn-cta-primary w-full !py-3.5 disabled:opacity-60"
              >
                {isResetting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Update password'}
              </button>
            </motion.form>
          </AnimatePresence>

          <p className="mt-5 text-center text-xs text-stone-500">
            <Link to={signInUrl} className="font-semibold text-brand-800 hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </>
    )
  );
};

export default ResetPasswordPage;
