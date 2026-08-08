'use client';

export const dynamic = 'force-dynamic';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Mail, CheckCircle2, RefreshCw, Loader2, ArrowRight } from 'lucide-react';
import Logo from '@/components/Logo';
import { useToast } from '@/components/ui/Toast';

function VerifyEmailSentForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const toast = useToast();

  const [resendLoading, setResendLoading] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResendLoading(true);
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setResent(true);
      toast.success('Email sent!', `A new verification link has been sent to ${email}.`);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-md">
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
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="w-20 h-20 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-6"
          >
            <Mail className="w-10 h-10 text-brand-500" />
          </motion.div>

          <h2 className="text-2xl font-extrabold text-stone-900 mb-2">Check your inbox</h2>
          <p className="text-stone-500 mb-2">
            We sent a verification link to
          </p>
          {email && (
            <p className="font-semibold text-stone-900 mb-6 break-all">{email}</p>
          )}

          <div className="bg-stone-50 rounded-xl p-4 text-left mb-6 space-y-2">
            {[
              'Open the email from Devlumiq ATS',
              'Click "Verify Email Address"',
              'You\'ll be redirected to sign in',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <span className="text-sm text-stone-600 font-medium">{step}</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-brand-500 to-teal-500 text-white shadow-lg shadow-brand-500/25 hover:from-brand-600 hover:to-teal-600 transition-all"
            >
              I've verified — sign in <ArrowRight className="w-4 h-4" />
            </Link>

            <button
              onClick={handleResend}
              disabled={resendLoading || resent || !email}
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm border border-stone-200 text-stone-600 hover:bg-stone-50 hover:border-stone-300 transition-all disabled:opacity-60"
            >
              {resendLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
              ) : resent ? (
                <><CheckCircle2 className="w-4 h-4 text-emerald-500" />Email resent</>
              ) : (
                <><RefreshCw className="w-4 h-4" />Resend verification email</>
              )}
            </button>
          </div>

          <p className="text-xs text-stone-400 mt-6">
            Didn't get it? Check your spam folder, or{' '}
            <Link href="/contact" className="text-brand-600 hover:text-brand-700 font-semibold">
              contact support
            </Link>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function VerifyEmailSentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    }>
      <VerifyEmailSentForm />
    </Suspense>
  );
}
