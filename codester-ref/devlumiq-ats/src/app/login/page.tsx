'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, Mail, Lock, Shield, Eye, EyeOff, Loader2, Sparkles, Users, BarChart3 } from 'lucide-react';
import Logo from '@/components/Logo';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import { email as validateEmail } from '@/lib/validation';
import { ROLE_UI } from '@/lib/roleUi';
import { isDemoHost } from '@/lib/demo-login';

const DEMO_ROLES = [
  {
    role: 'ADMIN' as const,
    label: 'Admin',
    email: 'admin@devlumiq.com',
    icon: ROLE_UI.ADMIN.icon,
    bg: 'bg-violet-500',
    ringColor: 'ring-violet-400/50',
    labelBg: 'bg-violet-50',
    labelText: 'text-violet-700',
  },
  {
    role: 'RECRUITER' as const,
    label: 'Recruiter',
    email: 'recruiter@devlumiq.com',
    icon: ROLE_UI.RECRUITER.icon,
    bg: 'bg-brand-500',
    ringColor: 'ring-brand-400/50',
    labelBg: 'bg-brand-50',
    labelText: 'text-brand-700',
  },
  {
    role: 'HIRING_MANAGER' as const,
    label: 'HR Manager',
    email: 'hiring@devlumiq.com',
    icon: ROLE_UI.HIRING_MANAGER.icon,
    bg: 'bg-amber-500',
    ringColor: 'ring-amber-400/50',
    labelBg: 'bg-amber-50',
    labelText: 'text-amber-700',
  },
  {
    role: 'INTERVIEWER' as const,
    label: 'Interviewer',
    email: 'interviewer@devlumiq.com',
    icon: ROLE_UI.INTERVIEWER.icon,
    bg: 'bg-sky-500',
    ringColor: 'ring-sky-400/50',
    labelBg: 'bg-sky-50',
    labelText: 'text-sky-700',
  },
  {
    role: 'VIEWER' as const,
    label: 'Viewer',
    email: 'viewer@devlumiq.com',
    icon: ROLE_UI.VIEWER.icon,
    bg: 'bg-stone-500',
    ringColor: 'ring-stone-400/50',
    labelBg: 'bg-stone-100',
    labelText: 'text-stone-700',
  },
];

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const toast = useToast();
  const justVerified = searchParams.get('verified') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoadingRole, setDemoLoadingRole] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // Show demo panel in local/dev, when env-enabled, or on known staging hosts (no Vercel env needed).
  const [showDemoLogins, setShowDemoLogins] = useState(
    (process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN || '').trim().toLowerCase() === 'true' ||
    process.env.NODE_ENV !== 'production',
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const remembered = localStorage.getItem('loginRememberEmail');
      if (remembered) setEmail(remembered);
      if (isDemoHost(window.location.hostname)) {
        setShowDemoLogins(true);
      }
    }
  }, []);

  const doLogin = async (loginEmail: string, loginPassword: string, isDemo = false, demoRole?: string) => {
    if (isDemo && demoRole) setDemoLoadingRole(demoRole); else if (!isDemo) setLoading(true);
    setError('');
    setErrorCode('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error ?? t('common.error');
        setError(msg);
        setErrorCode(data?.code ?? '');
        toast.error(t('login.signIn') + ' failed', msg);
        return;
      }
      const user = data?.user ?? {};
      localStorage.setItem('token', data?.token ?? 'demo-' + Date.now());
      localStorage.setItem('userEmail', user.email ?? loginEmail);
      localStorage.setItem('userName', user.name ?? loginEmail.split('@')[0]);
      localStorage.setItem('isLoggedIn', 'true');
      if (rememberMe && !isDemo) {
        localStorage.setItem('loginRememberEmail', user.email ?? loginEmail);
      } else if (!isDemo) {
        localStorage.removeItem('loginRememberEmail');
      }
      sessionStorage.removeItem('welcome-shown');
      router.push('/dashboard');
    } catch {
      const msg = t('common.error');
      setError(msg);
      toast.error(t('login.signIn') + ' failed', msg);
    } finally {
      setLoading(false);
      setDemoLoadingRole(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const errors: { email?: string; password?: string } = {};
    const emailErr = validateEmail(email);
    if (emailErr) errors.email = emailErr;
    if (!password.trim()) errors.password = 'Password is required';
    if (errors.email || errors.password) {
      setFieldErrors(errors);
      return;
    }

    await doLogin(email, password);
  };

  const handleDemoRoleLogin = async (_roleEmail: string, roleName: string) => {
    setFieldErrors({});
    setError('');
    setDemoLoadingRole(roleName);
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: roleName }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error ?? t('common.error');
        setError(msg);
        toast.error(t('login.signIn') + ' failed', msg);
        return;
      }
      const user = data?.user ?? {};
      localStorage.setItem('token', 'demo-' + Date.now());
      localStorage.setItem('userEmail', user.email ?? '');
      localStorage.setItem('userName', user.name ?? '');
      localStorage.setItem('isLoggedIn', 'true');
      sessionStorage.removeItem('welcome-shown');
      router.push('/dashboard');
    } catch {
      const msg = t('common.error');
      setError(msg);
      toast.error(t('login.signIn') + ' failed', msg);
    } finally {
      setDemoLoadingRole(null);
    }
  };

  const handleSocialLogin = (provider: string) => {
    toast.info(`${provider} Sign-In`, 'Social authentication can be configured in your environment settings.');
  };

  const isSubmitting = loading || !!demoLoadingRole;

  return (
    <div className="min-h-screen flex overflow-x-hidden w-full">
      {/* Left - Branding panel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 xl:p-16 bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(13,148,136,0.15),transparent)]" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-brand-500/10 to-transparent" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-brand-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-48 h-48 bg-warm-500/10 rounded-full blur-3xl" />
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
        <div className="relative max-w-md">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight"
          >
            {t('login.heroTitle')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-stone-400 mt-4 text-lg leading-relaxed"
          >
            {t('login.heroDesc')}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-10 grid grid-cols-3 gap-4"
          >
            {[
              { icon: Users, label: 'Smart', desc: 'Candidate tracking' },
              { icon: BarChart3, label: 'Fast', desc: 'Real-time analytics' },
              { icon: Shield, label: 'Secure', desc: 'Enterprise-grade' },
            ].map((stat, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <stat.icon className="w-5 h-5 text-brand-400 mb-2" />
                <p className="text-lg font-bold text-white">{stat.label}</p>
                <p className="text-xs text-stone-500 mt-0.5">{stat.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
        <div className="relative text-stone-600 text-sm">
          © {new Date().getFullYear()} {t('login.copyright')}
        </div>
      </motion.div>

      {/* Right - Login form */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex-1 flex items-start sm:items-center justify-center p-4 sm:p-8 lg:p-12 bg-stone-50 min-w-0 overflow-y-auto"
      >
        <div className="w-full max-w-md">
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
            className="rounded-2xl p-5 sm:p-8 md:p-10 bg-white shadow-[var(--shadow-elevated)] border border-stone-200/80"
          >
            {justVerified && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 mb-6">
                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
                <p className="text-sm font-semibold text-emerald-800">Email verified! You can now sign in.</p>
              </div>
            )}
            <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mb-1">{t('login.welcomeBack')}</h2>
            <p className="text-stone-500 mb-7 font-medium text-sm">{t('login.signInDesc')}</p>

            {/* Social Login Buttons */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <button
                type="button"
                onClick={() => handleSocialLogin('Google')}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 transition-all text-sm font-semibold text-stone-700 disabled:opacity-50 shadow-sm"
              >
                <GoogleIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Google</span>
              </button>
              <button
                type="button"
                onClick={() => handleSocialLogin('LinkedIn')}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 transition-all text-sm font-semibold text-stone-700 disabled:opacity-50 shadow-sm"
              >
                <LinkedInIcon className="w-5 h-5 text-[#0A66C2]" />
                <span className="hidden sm:inline">LinkedIn</span>
              </button>
              <button
                type="button"
                onClick={() => handleSocialLogin('GitHub')}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 transition-all text-sm font-semibold text-stone-700 disabled:opacity-50 shadow-sm"
              >
                <GitHubIcon className="w-5 h-5" />
                <span className="hidden sm:inline">GitHub</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 font-semibold text-stone-400 uppercase tracking-wider">or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">{t('login.email')}</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                    placeholder={t('login.emailPlaceholder')}
                    className={`w-full pl-11 pr-4 py-3.5 rounded-xl border bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-500/15 outline-none font-medium text-stone-900 transition-all placeholder:text-stone-400 ${fieldErrors.email ? 'border-red-400 focus:border-red-500' : 'border-stone-200 focus:border-brand-500'}`}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                  />
                  {fieldErrors.email && <p id="login-email-error" className="text-sm text-red-600 mt-1">{fieldErrors.email}</p>}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-stone-700">{t('login.password')}</label>
                  <Link href="/forgot-password" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                    {t('login.forgotPassword')}
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                    placeholder={t('login.passwordPlaceholder')}
                    className={`w-full pl-11 pr-12 py-3.5 rounded-xl border bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-500/15 outline-none font-medium text-stone-900 transition-all placeholder:text-stone-400 ${fieldErrors.password ? 'border-red-400 focus:border-red-500' : 'border-stone-200 focus:border-brand-500'}`}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {fieldErrors.password && <p id="login-password-error" className="text-sm text-red-600 mt-1">{fieldErrors.password}</p>}
                </div>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="remember" className="ml-2 text-sm font-medium text-stone-600">{t('login.rememberMe')}</label>
              </div>
              {error && (
                <div role="alert" className={`rounded-xl p-3.5 text-sm font-medium ${
                  errorCode === 'EMAIL_UNVERIFIED' || errorCode === 'PENDING_INVITE'
                    ? 'bg-amber-50 border border-amber-200 text-amber-800'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  <p>{error}</p>
                  {errorCode === 'EMAIL_UNVERIFIED' && (
                    <a
                      href={`/verify-email-sent?email=${encodeURIComponent(email)}`}
                      className="underline font-semibold mt-1 inline-block hover:opacity-80"
                    >
                      Resend verification email →
                    </a>
                  )}
                </div>
              )}
              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                className="btn-cta-primary w-full py-4 rounded-xl font-bold text-base shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('login.signingIn') ?? 'Signing in...'}
                  </>
                ) : (
                  <>
                    {t('login.signIn')}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Live Demo Access Panel — gated; must also enable ENABLE_DEMO_LOGIN server-side in production */}
            {showDemoLogins && (
            <div className="mt-6 pt-6 border-t border-stone-100">
              <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50/50 to-yellow-50 border border-amber-200/60 shadow-sm p-4 sm:p-5 overflow-hidden">
                {/* Header */}
                <div className="flex flex-col gap-3 mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 sm:p-2.5 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl shadow-sm flex-shrink-0">
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-stone-900 text-sm">Live Demo Access</h4>
                      <p className="text-xs text-stone-500 mt-0.5 leading-snug">No sign-up required — pick a role to preview</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-amber-100 font-mono text-[11px] sm:text-xs w-fit max-w-full">
                    <span className="text-stone-400 flex-shrink-0">pw:</span>
                    <span className="font-semibold text-amber-700 truncate">Demo@1234</span>
                  </div>
                </div>

                {/* Role grid — 2 cols on phones, 3 on xs+, wraps cleanly for 5 roles */}
                <div className="grid grid-cols-2 xs:grid-cols-3 gap-2 sm:gap-2.5">
                  {DEMO_ROLES.map((dr) => {
                    const DRIcon = dr.icon;
                    const isLoadingThis = demoLoadingRole === dr.role;
                    return (
                      <motion.button
                        key={dr.role}
                        type="button"
                        onClick={() => handleDemoRoleLogin(dr.email, dr.role)}
                        disabled={isSubmitting}
                        whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
                        whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                        title={`Sign in as ${dr.label}\n${dr.email}`}
                        className={`flex flex-col items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-1.5 sm:px-2 rounded-xl border-2 transition-all duration-200 min-w-0 ${
                          isSubmitting && !isLoadingThis
                            ? 'opacity-40 cursor-not-allowed border-transparent'
                            : `cursor-pointer border-transparent hover:border-white/60 hover:shadow-md hover:ring-2 ${dr.ringColor}`
                        }`}
                      >
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${dr.bg} flex items-center justify-center shadow-sm flex-shrink-0`}>
                          {isLoadingThis ? (
                            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-spin" />
                          ) : (
                            <DRIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          )}
                        </div>
                        <span className={`text-[10px] sm:text-[11px] font-semibold text-center leading-tight truncate w-full px-0.5 ${dr.labelText}`}>
                          {dr.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>
            )}

            <p className="text-center mt-6 text-sm text-stone-500">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-bold text-brand-600 hover:text-brand-700">
                Create one free
              </Link>
            </p>
          </motion.div>

          <p className="text-center text-xs text-stone-400 mt-6">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-stone-600">Terms of Service</Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline hover:text-stone-600">Privacy Policy</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
