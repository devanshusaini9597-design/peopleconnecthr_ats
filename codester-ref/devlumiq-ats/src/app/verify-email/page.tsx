'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Mail, ArrowRight, RefreshCw } from 'lucide-react';
import Logo from '@/components/Logo';

type Status = 'loading' | 'success' | 'error' | 'resent';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendEmailInput, setResendEmailInput] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No verification token found in the link.');
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        if (res.ok) {
          setStatus('success');
          setTimeout(() => router.push('/login?verified=1'), 3000);
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus('error');
          setErrorMsg(data?.error ?? 'Verification failed.');
        }
      } catch {
        setStatus('error');
        setErrorMsg('Something went wrong. Please try again.');
      }
    };

    verify();
  }, [token, router]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendLoading(true);
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmailInput.trim().toLowerCase() }),
      });
      setResendEmail(resendEmailInput);
      setStatus('resent');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <Logo className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-xl text-stone-900">Devlumiq ATS</span>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-8 sm:p-10 bg-white shadow-[var(--shadow-elevated)] border border-stone-200/80 text-center"
        >
          {status === 'loading' && (
            <>
              <div className="w-20 h-20 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
              </div>
              <h2 className="text-2xl font-extrabold text-stone-900 mb-2">Verifying your email…</h2>
              <p className="text-stone-500">Please wait while we confirm your address.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </motion.div>
              <h2 className="text-2xl font-extrabold text-stone-900 mb-2">Email verified!</h2>
              <p className="text-stone-500 mb-6">
                Your email address has been confirmed. Redirecting you to sign in…
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 py-3.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-brand-500 to-teal-500 text-white shadow-lg shadow-brand-500/25 hover:from-brand-600 hover:to-teal-600 transition-all"
              >
                Sign in now
                <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-20 h-20 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-extrabold text-stone-900 mb-2">Link expired</h2>
              <p className="text-stone-500 mb-8">{errorMsg}</p>

              <form onSubmit={handleResend} className="space-y-3 text-left">
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  Resend verification email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={resendEmailInput}
                    onChange={(e) => setResendEmailInput(e.target.value)}
                    placeholder="you@company.com"
                    className="flex-1 px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none font-medium text-stone-900 text-sm"
                    required
                  />
                  <button
                    type="submit"
                    disabled={resendLoading}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-500 text-white font-bold text-sm hover:bg-brand-600 transition-colors disabled:opacity-60"
                  >
                    {resendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Resend
                  </button>
                </div>
              </form>

              <div className="mt-6 pt-6 border-t border-stone-100">
                <Link href="/login" className="text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                  Back to sign in
                </Link>
              </div>
            </>
          )}

          {status === 'resent' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="w-20 h-20 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-6"
              >
                <Mail className="w-10 h-10 text-brand-500" />
              </motion.div>
              <h2 className="text-2xl font-extrabold text-stone-900 mb-2">Check your inbox</h2>
              <p className="text-stone-500 mb-6">
                A new verification link has been sent to{' '}
                <span className="font-semibold text-stone-900">{resendEmail}</span>.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 py-3.5 px-6 rounded-xl font-bold text-sm border border-stone-200 text-stone-600 hover:bg-stone-50 transition-all"
              >
                Back to sign in
              </Link>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
