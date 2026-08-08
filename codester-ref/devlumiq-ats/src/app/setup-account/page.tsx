'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle2, XCircle, Loader2, ArrowRight, UserCheck } from 'lucide-react';
import Logo from '@/components/Logo';
import { useToast } from '@/components/ui/Toast';

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Contains a number', test: (p: string) => /\d/.test(p) },
  { label: 'Contains uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
];

interface InviteInfo {
  name: string;
  email: string;
  orgName: string | null;
}

function SetupAccountForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const token = searchParams.get('token') ?? '';

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [tokenError, setTokenError] = useState('');
  const [loadingInvite, setLoadingInvite] = useState(true);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!token) {
      setTokenError('No invitation token found. Please use the link from your invitation email.');
      setLoadingInvite(false);
      return;
    }

    const load = async () => {
      try {
        const res = await fetch(`/api/auth/setup-account?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setTokenError(data?.error ?? 'This invitation link is invalid or has expired.');
        } else {
          setInvite(data);
        }
      } catch {
        setTokenError('Something went wrong. Please try again.');
      } finally {
        setLoadingInvite(false);
      }
    };
    load();
  }, [token]);

  const allRulesMet = PASSWORD_RULES.every((r) => r.test(password));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!allRulesMet) { setFormError('Password does not meet the requirements.'); return; }
    if (password !== confirm) { setFormError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/setup-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data?.error ?? 'Setup failed. Please try again.');
        return;
      }
      // Store session info for client-side state
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userEmail', data?.user?.email ?? '');
      localStorage.setItem('userName', data?.user?.name ?? '');
      toast.success('Account ready!', 'Welcome to the team. Taking you to your dashboard…');
      router.push('/dashboard');
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-x-hidden w-full">
      {/* Left branding panel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 xl:p-16 bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(13,148,136,0.15),transparent)]" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-brand-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />

        <div className="relative flex items-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <Logo className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-xl text-white">Devlumiq ATS</span>
          </Link>
        </div>

        <div className="relative max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-teal-500/20 border border-brand-500/30 flex items-center justify-center mb-6">
            <UserCheck className="w-8 h-8 text-brand-400" />
          </div>
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight">
            You've been<br />
            <span className="text-gradient">invited!</span>
          </h1>
          <p className="text-stone-400 mt-4 text-lg leading-relaxed">
            {invite
              ? `You're joining ${invite.orgName ?? 'your organisation'} on Devlumiq ATS. Set your password to get started.`
              : 'Set up your account to access the platform.'}
          </p>
        </div>

        <div className="relative text-stone-600 text-sm">
          © {new Date().getFullYear()} Devlumiq ATS
        </div>
      </motion.div>

      {/* Right form panel */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 bg-stone-50 min-w-0"
      >
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center">
                <Logo className="w-5 h-5 text-white" />
              </div>
              <span className="font-extrabold text-xl text-stone-900">Devlumiq ATS</span>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl p-8 sm:p-10 bg-white shadow-[var(--shadow-elevated)] border border-stone-200/80"
          >
            {loadingInvite ? (
              <div className="text-center py-8">
                <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto mb-4" />
                <p className="text-stone-500 font-medium">Loading your invitation…</p>
              </div>
            ) : tokenError ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-6">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-extrabold text-stone-900 mb-2">Invitation expired</h2>
                <p className="text-stone-500 text-sm mb-6">{tokenError}</p>
                <p className="text-sm text-stone-500">
                  Contact your administrator to send a new invitation.
                </p>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-50 to-teal-50 border border-brand-100 flex items-center justify-center mb-6">
                  <UserCheck className="w-7 h-7 text-brand-600" />
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mb-1">
                  Welcome, {invite?.name?.split(' ')[0]}!
                </h2>
                <p className="text-stone-500 mb-1 font-medium text-sm">
                  Setting up account for <span className="text-stone-700 font-semibold">{invite?.email}</span>
                </p>
                {invite?.orgName && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-xs font-semibold text-brand-700 mb-6 mt-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 inline-block" />
                    {invite.orgName}
                  </div>
                )}

                {formError && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 mb-5">
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-red-700">{formError}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-2">Choose a password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full pl-11 pr-12 py-3.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none font-medium text-stone-900 transition-all placeholder:text-stone-400"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {password.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {PASSWORD_RULES.map((rule) => (
                          <div key={rule.label} className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${rule.test(password) ? 'bg-emerald-100' : 'bg-stone-100'}`}>
                              {rule.test(password)
                                ? <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                : <div className="w-1.5 h-1.5 rounded-full bg-stone-400" />}
                            </div>
                            <span className={`text-xs font-medium ${rule.test(password) ? 'text-emerald-700' : 'text-stone-500'}`}>
                              {rule.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-2">Confirm password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repeat your password"
                        className={`w-full pl-11 pr-4 py-3.5 rounded-xl border bg-stone-50/50 focus:bg-white focus:ring-2 outline-none font-medium text-stone-900 transition-all placeholder:text-stone-400 ${
                          confirm.length > 0 && confirm !== password
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                            : 'border-stone-200 focus:border-brand-500 focus:ring-brand-500/15'
                        }`}
                        required
                      />
                    </div>
                    {confirm.length > 0 && confirm !== password && (
                      <p className="text-xs text-red-600 mt-1.5 font-medium">Passwords do not match</p>
                    )}
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    className="group w-full py-4 rounded-xl font-bold text-base bg-gradient-to-r from-brand-500 to-teal-500 text-white shadow-lg shadow-brand-500/25 hover:from-brand-600 hover:to-teal-600 transition-all flex items-center justify-center gap-2 disabled:opacity-70 mt-2"
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 animate-spin" />Setting up your account…</>
                    ) : (
                      <>Activate my account<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                    )}
                  </motion.button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default function SetupAccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    }>
      <SetupAccountForm />
    </Suspense>
  );
}
