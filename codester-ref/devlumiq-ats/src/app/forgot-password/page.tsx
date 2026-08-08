'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Mail, Shield, KeyRound, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import Logo from '@/components/Logo';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import { email as validateEmail } from '@/lib/validation';

export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fieldError, setFieldError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError('');

    const emailErr = validateEmail(email);
    if (emailErr) {
      setFieldError(emailErr);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFieldError(data?.error ?? 'Request failed. Please try again.');
        return;
      }
      setSubmitted(true);
      toast.success('Reset link sent!', `Check ${email} for password reset instructions.`);
    } catch {
      setFieldError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-x-hidden w-full">
      {/* Left - Branding panel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 xl:p-16 bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 relative overflow-hidden"
      >
        {/* Premium background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(13,148,136,0.15),transparent)]" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-brand-500/10 to-transparent" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-brand-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-48 h-48 bg-warm-500/10 rounded-full blur-3xl" />

        {/* Header with logo and back button */}
        <div className="relative flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <Logo className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-xl text-white">{t('login.dashboardLink')}</span>
          </Link>
          <Link
            href="/"
            className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 transition-all duration-300 backdrop-blur-sm"
          >
            <ArrowLeft className="w-4 h-4 text-stone-300 group-hover:-translate-x-1 transition-transform duration-300" />
            <span className="text-sm font-semibold text-stone-200 group-hover:text-white">Back to website</span>
          </Link>
        </div>

        {/* Main content */}
        <div className="relative max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-teal-500/20 border border-brand-500/30 flex items-center justify-center mb-6">
              <KeyRound className="w-8 h-8 text-brand-400" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight"
          >
            Reset your<br />
            <span className="text-gradient">password</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-stone-400 mt-4 text-lg leading-relaxed"
          >
            Don't worry, we've got you covered. Enter your email and we'll send you a secure link to reset your password.
          </motion.p>

          {/* Security badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="mt-10 flex flex-wrap gap-3"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
              <Shield className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-medium text-stone-300">Secure SSL</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
              <Sparkles className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-medium text-stone-300">Instant Delivery</span>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="relative text-stone-600 text-sm">
          © {new Date().getFullYear()} {t('login.copyright')}
        </div>
      </motion.div>

      {/* Right - Form panel */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 bg-stone-50 min-w-0"
      >
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center justify-between mb-8">
            <div className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center">
                <Logo className="w-5 h-5 text-white" />
              </div>
              <span className="font-extrabold text-xl text-stone-900">{t('login.brandName')}</span>
            </div>
            <Link
              href="/"
              className="group inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 border border-stone-200 hover:border-stone-300 transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4 text-stone-500 group-hover:-translate-x-1 transition-transform duration-300" />
              <span className="text-sm font-semibold text-stone-600 group-hover:text-stone-800">Back</span>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl p-8 sm:p-10 bg-white shadow-[var(--shadow-elevated)] border border-stone-200/80"
          >
            {!submitted ? (
              <>
                {/* Back to login link */}
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-stone-900 transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </Link>

                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-50 to-teal-50 border border-brand-100 flex items-center justify-center mb-6">
                  <Mail className="w-7 h-7 text-brand-600" />
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mb-2">
                  Forgot password?
                </h2>
                <p className="text-stone-500 mb-8 font-medium text-sm">
                  Enter your email address and we'll send you a link to reset your password.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-2">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setFieldError('');
                        }}
                        placeholder="you@company.com"
                        className={`w-full pl-11 pr-4 py-3.5 rounded-xl border bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-500/15 outline-none font-medium text-stone-900 transition-all placeholder:text-stone-400 ${
                          fieldError
                            ? 'border-red-400 focus:border-red-500'
                            : 'border-stone-200 focus:border-brand-500'
                        }`}
                        aria-invalid={!!fieldError}
                      />
                    </div>
                    {fieldError && (
                      <p className="text-sm text-red-600 mt-1.5">{fieldError}</p>
                    )}
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    whileHover={{ scale: loading ? 1 : 1.01 }}
                    className="group w-full py-4 rounded-xl font-bold text-base bg-gradient-to-r from-brand-500 to-teal-500 text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/35 hover:from-brand-600 hover:to-teal-600 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:scale-100 mt-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending link...
                      </>
                    ) : (
                      <>
                        Send reset link
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                      </>
                    )}
                  </motion.button>
                </form>

                {/* Help section */}
                <div className="mt-6 pt-6 border-t border-stone-100">
                  <p className="text-sm text-stone-600">
                    Need help?{' '}
                    <Link href="/contact" className="font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                      Contact support
                    </Link>
                  </p>
                </div>
              </>
            ) : (
              /* Success state */
              <div className="text-center py-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 flex items-center justify-center mx-auto mb-6"
                >
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </motion.div>

                <h2 className="text-2xl font-extrabold text-stone-900 mb-2">
                  Check your email
                </h2>
                <p className="text-stone-500 mb-6">
                  We've sent a password reset link to <span className="font-semibold text-stone-900">{email}</span>
                </p>

                <div className="space-y-3">
                  <motion.button
                    onClick={() => {
                      setSubmitted(false);
                      setEmail('');
                    }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3.5 rounded-xl font-bold text-sm bg-stone-100 text-stone-700 hover:bg-stone-200 transition-all"
                  >
                    Didn't receive it? Try again
                  </motion.button>

                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm border border-stone-200 text-stone-600 hover:bg-stone-50 hover:border-stone-300 transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to login
                  </Link>
                </div>
              </div>
            )}
          </motion.div>

          {/* Footer text */}
          <p className="text-center text-xs text-stone-400 mt-6">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-stone-600">Terms of Service</Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline hover:text-stone-600">Privacy Policy</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
