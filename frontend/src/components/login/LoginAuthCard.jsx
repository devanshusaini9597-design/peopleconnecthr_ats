import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
  AlertCircle, Loader2, CheckCircle2, Sparkles,
} from 'lucide-react';
import { BRAND_NAME } from '../ui/BrandLogo';
import { Magnetic } from './Magnetic';

export default function LoginAuthCard({
  prefersReduced,
  mode,
  mfaStep,
  formData,
  fieldErrors,
  error,
  success,
  showPassword,
  setShowPassword,
  isSubmitting,
  isDemoLoggingIn,
  mfaCode,
  setMfaCode,
  mfaSetup,
  backupCodes,
  recoveryEmail,
  setRecoveryEmail,
  recoveryStatus,
  recoveryMessage,
  onChange,
  onSubmit,
  onMfaVerify,
  onStartEnrollment,
  onCompleteEnrollment,
  onDemoLogin,
  onForgotSubmit,
  onBackToLogin,
  onForgotMode,
  onBackFromMfa,
}) {
  const { t } = useTranslation();

  return (
    <div className="auth-form-card">
      <AnimatePresence mode="wait">
        {mode === 'login' ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, x: prefersReduced ? 0 : -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: prefersReduced ? 0 : 16 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <div className="mb-7">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-[11px] font-semibold mb-4">
                <Sparkles className="w-3 h-3" />
                {t('auth.welcomeBack')}
              </div>
              <h1 className="text-2xl sm:text-[1.75rem] font-bold text-stone-900 tracking-tight">
                {mfaStep === 'mfa' ? 'Two-factor authentication' : mfaStep === 'enroll' ? 'Set up MFA' : (
                  <>{t('auth.title')} <span className="text-gradient">{BRAND_NAME}</span></>
                )}
              </h1>
              <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                {mfaStep === 'mfa'
                  ? 'Enter the code from your authenticator app.'
                  : mfaStep === 'enroll'
                    ? 'Your organization requires MFA before you can sign in.'
                    : t('auth.subtitle')}
              </p>
            </div>

            {/* Status messages */}
            <div aria-live="polite">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mb-4 flex items-start gap-2 p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700" role="alert">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{error}</span>
                    </div>
                  </motion.div>
                )}
                {success && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mb-4 flex items-center gap-2 p-3 rounded-lg text-sm bg-emerald-50 border border-emerald-200 text-emerald-700">
                      <CheckCircle2 size={16} className="shrink-0" />
                      <span>{success}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {mfaStep === 'mfa' ? (
              <form onSubmit={onMfaVerify} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="mfa-code" className="label-ats">
                    Authentication code
                  </label>
                  <input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="input-ats font-mono tracking-widest text-center text-lg"
                  />
                </div>
                <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & sign in'}
                </button>
                <button type="button" onClick={onBackFromMfa} className="btn-ghost w-full text-sm text-stone-500">
                  Back to sign in
                </button>
              </form>
            ) : mfaStep === 'enroll' ? (
              <div className="space-y-5">
                {!mfaSetup ? (
                  <button type="button" onClick={onStartEnrollment} disabled={isSubmitting} className="btn-primary w-full">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Begin MFA setup'}
                  </button>
                ) : (
                  <form onSubmit={onCompleteEnrollment} className="space-y-4">
                    <p className="text-sm text-stone-600">Add this secret to your authenticator app:</p>
                    <code className="block text-xs font-mono bg-stone-50 border border-stone-200 rounded-xl p-3 break-all">{mfaSetup.secret}</code>
                    <div>
                      <label className="label-ats">Verification code</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="input-ats font-mono tracking-widest text-center"
                      />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                      {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : 'Verify & continue'}
                    </button>
                  </form>
                )}
                {backupCodes?.length > 0 && (
                  <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="font-semibold text-amber-900 mb-1">Save backup codes:</p>
                    <div className="grid grid-cols-2 gap-1 font-mono">{backupCodes.map((c) => <span key={c}>{c}</span>)}</div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="login-email" className="label-ats">
                    {t('auth.email')}
                  </label>
                  <div className="relative rounded-xl auth-input-glow transition-shadow">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      id="login-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      value={formData.email}
                      onChange={onChange}
                      placeholder="you@company.com"
                      aria-invalid={!!fieldErrors.email}
                      aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                      className={`input-ats !pl-10 !bg-stone-50/80 focus:!bg-white ${fieldErrors.email ? 'input-ats-error' : ''}`}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p id="login-email-error" className="field-error">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="label-ats !mb-0">
                      {t('auth.password')}
                    </label>
                    <button
                      type="button"
                      onClick={onForgotMode}
                      className="text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
                    >
                      {t('auth.forgotPassword')}
                    </button>
                  </div>
                  <div className="relative rounded-xl auth-input-glow transition-shadow">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="current-password"
                      value={formData.password}
                      onChange={onChange}
                      placeholder="••••••••"
                      className={`input-ats !pl-10 !pr-11 !bg-stone-50/80 focus:!bg-white ${fieldErrors.password ? 'input-ats-error' : ''}`}
                      aria-invalid={!!fieldErrors.password}
                      aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-400 hover:text-stone-600 transition-colors"
                      aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p id="login-password-error" className="field-error" role="alert">{fieldErrors.password}</p>
                  )}
                </div>

                <Magnetic strength={0.15} className="w-full">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={isSubmitting || isDemoLoggingIn}
                    className="btn-cta-primary w-full !py-3.5"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        {t('auth.signingIn')}
                      </>
                    ) : (
                      <>
                        {t('auth.login')}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </motion.button>
                </Magnetic>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-stone-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-xs text-stone-400 uppercase tracking-wider">{t('common.or')}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onDemoLogin}
                  disabled={isSubmitting || isDemoLoggingIn}
                  className="btn-secondary w-full !py-3 !border-brand-200 !text-brand-700 hover:!bg-brand-50"
                >
                  {isDemoLoggingIn ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      {t('auth.demoEntering')}
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      {t('auth.demoLogin')}
                    </>
                  )}
                </button>

                <div className="auth-switch">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-800">New to {BRAND_NAME}?</p>
                    <p className="text-xs text-stone-500 mt-0.5">Start hiring in minutes — no credit card.</p>
                  </div>
                  <Link to="/register" className="auth-switch-cta">
                    Start free trial
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </form>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="forgot"
            initial={{ opacity: 0, x: prefersReduced ? 0 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: prefersReduced ? 0 : -16 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <button
              onClick={onBackToLogin}
              className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors mb-6"
            >
              <ArrowLeft size={15} />
              Back to sign in
            </button>

            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-[11px] font-semibold mb-4">
                <Lock className="w-3 h-3" />
                Password recovery
              </div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
                Reset your password
              </h1>
              <p className="text-sm text-stone-500 mt-2">
                Enter the email on your account and we'll send a link to reset it.
              </p>
            </div>

            <div aria-live="polite">
              {recoveryStatus === 'sent' && (
                <div className="mb-4 flex items-start gap-2 p-3 rounded-lg text-sm bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>{recoveryMessage}</span>
                </div>
              )}
              {recoveryStatus === 'error' && (
                <div className="mb-4 flex items-start gap-2 p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{recoveryMessage}</span>
                </div>
              )}
            </div>

            {recoveryStatus !== 'sent' && (
              <form onSubmit={onForgotSubmit} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="recovery-email" className="label-ats">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      id="recovery-email"
                      type="email"
                      autoComplete="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="input-ats !pl-10"
                    />
                  </div>
                </div>

                <Magnetic strength={0.15} className="w-full">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={recoveryStatus === 'sending'}
                    className="btn-primary w-full !py-3"
                  >
                    {recoveryStatus === 'sending' ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Sending link…
                      </>
                    ) : (
                      'Send reset link'
                    )}
                  </motion.button>
                </Magnetic>
              </form>
            )}

            {recoveryStatus === 'sent' && (
              <button
                onClick={onBackToLogin}
                className="btn-secondary w-full !py-3"
              >
                Back to sign in
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
