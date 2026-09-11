import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Mail, Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck,
  Zap, User, Phone, Lock, AlertCircle, ArrowRight, Sparkles, Clock, Building2,
} from 'lucide-react';
import { BRAND_NAME } from '../ui/BrandLogo';
import {
  fadeUp,
  strengthLabels,
  strengthBarColors,
  strengthTextColors,
} from './registerConstants';

export function RegisterTrustChips() {
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      <span className="auth-trust-chip"><ShieldCheck className="w-3.5 h-3.5 text-brand-600" /> SOC 2 ready</span>
      <span className="auth-trust-chip"><Zap className="w-3.5 h-3.5 text-brand-600" /> Sales-assisted setup</span>
      <span className="auth-trust-chip"><Clock className="w-3.5 h-3.5 text-brand-600" /> Access after approval</span>
    </div>
  );
}

export function RegisterSuccessCard({
  prefersReduced,
  email,
  resendLoading,
  resendMessage,
  onResend,
  variant = 'verify',
}) {
  const pending = variant === 'pending';
  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-md min-w-0"
    >
      <div className="auth-form-card text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-brand-500 to-teal-700 flex items-center justify-center shadow-lg shadow-brand-500/25">
          {pending ? <Clock className="w-8 h-8 text-white" /> : <Mail className="w-8 h-8 text-white" />}
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-semibold mb-4">
          <CheckCircle2 className="w-3 h-3" />
          {pending ? 'Request received' : 'Almost there'}
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-stone-900 mb-3 tracking-tight">
          {pending ? 'Our team will contact you' : 'Check your email'}
        </h2>
        <p className="text-stone-500 text-sm mb-8 leading-relaxed break-words">
          {pending ? (
            <>
              We confirmed{' '}
              <span className="font-semibold text-stone-800">{email}</span>
              {' '}and sent your details to our sales team.
              They will reach out, and after approval you can sign in with the password you created.
            </>
          ) : (
            <>
              We&apos;ve sent a verification link to{' '}
              <span className="font-semibold text-stone-800">{email}</span>
            </>
          )}
        </p>

        <div className="space-y-3">
          {!pending && (
            <button
              type="button"
              onClick={onResend}
              disabled={resendLoading}
              className="btn-secondary w-full !py-3"
            >
              {resendLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Didn't receive it? Resend"}
            </button>
          )}
          {resendMessage && (
            <p className="text-sm text-brand-700">{resendMessage}</p>
          )}
          <Link to="/login" className="btn-cta-primary w-full !py-3">
            {pending ? 'Back to sign in' : 'Already verified? Continue to login'}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <RegisterTrustChips />
    </motion.div>
  );
}

export default function RegisterAuthCard({
  prefersReduced,
  formData,
  errors,
  apiError,
  showPassword,
  setShowPassword,
  loading,
  strengthScore,
  onChange,
  onBlur,
  onSubmit,
  emailVerified,
  otpSent,
  otpCode,
  setOtpCode,
  otpSending,
  otpVerifying,
  otpResendMessage,
  onSendCode,
  onVerifyCode,
}) {
  return (
    <>
      <div className="auth-form-card">
        <motion.div variants={fadeUp} className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-[11px] font-semibold mb-4">
            <Sparkles className="w-3 h-3" />
            Request a trial
          </div>
          <h1 className="text-2xl sm:text-[1.75rem] font-bold text-stone-900 tracking-tight">
            Request access to <span className="text-gradient">{BRAND_NAME}</span>
          </h1>
          <p className="text-sm text-stone-500 mt-2 leading-relaxed">
            Verify your work email, then submit your details. Our sales team will review your request after that.
          </p>

          <div className="mt-5 flex items-center gap-2">
            {['Details', 'Verify email', 'Sales review'].map((step, i) => {
              const active = i === 0 || (i === 1 && (otpSent || emailVerified));
              const done = i === 1 && emailVerified;
              return (
              <React.Fragment key={step}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                    done
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : active
                        ? 'bg-gradient-to-br from-brand-500 to-teal-600 text-white shadow-sm shadow-brand-500/30'
                        : 'bg-stone-100 text-stone-400 border border-stone-200'
                  }`}>
                    {done ? '✓' : i + 1}
                  </span>
                  <span className={`text-[11px] font-semibold truncate ${active || done ? 'text-stone-700' : 'text-stone-400'}`}>
                    {step}
                  </span>
                </div>
                {i < 2 && <div className="flex-1 h-px bg-stone-200 min-w-[12px]" aria-hidden="true" />}
              </React.Fragment>
              );
            })}
          </div>
        </motion.div>

        {apiError && (
          <motion.div
            variants={fadeUp}
            className="mb-5 flex items-start gap-2 p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{apiError}</span>
          </motion.div>
        )}

        <motion.form variants={fadeUp} onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="register-name" className="label-ats">Full name *</label>
            <div className="relative rounded-xl auth-input-glow transition-shadow">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                id="register-name"
                type="text"
                name="name"
                autoComplete="name"
                value={formData.name}
                onChange={onChange}
                onBlur={onBlur}
                placeholder="Jane Doe"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'register-name-error' : undefined}
                className={`input-ats !pl-10 !bg-stone-50/80 focus:!bg-white ${errors.name ? 'input-ats-error' : ''}`}
              />
            </div>
            {errors.name && <p id="register-name-error" className="field-error">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="register-email" className="label-ats">Work email *</label>
            <div className="flex gap-2 items-stretch">
              <div className="relative rounded-xl auth-input-glow transition-shadow flex-1 min-w-0">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  id="register-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={onChange}
                  onBlur={onBlur}
                  placeholder="jane@yourcompany.com"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'register-email-error' : undefined}
                  className={`input-ats !pl-10 ${emailVerified ? '!pr-10' : ''} !bg-stone-50/80 focus:!bg-white ${
                    errors.email ? 'input-ats-error' : emailVerified ? '!border-emerald-300' : ''
                  }`}
                />
                {emailVerified && (
                  <CheckCircle2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600" />
                )}
              </div>
              {!emailVerified && (
                <button
                  type="button"
                  onClick={onSendCode}
                  disabled={otpSending || loading}
                  className="btn-secondary shrink-0 !px-3 sm:!px-4"
                >
                  {otpSending ? <Loader2 size={16} className="animate-spin" /> : otpSent ? 'Resend' : 'Send code'}
                </button>
              )}
            </div>
            {errors.email && <p id="register-email-error" className="field-error">{errors.email}</p>}
            {!errors.email && emailVerified && (
              <p className="mt-1.5 text-[11px] font-medium text-emerald-700">Work email verified.</p>
            )}
            {!errors.email && !emailVerified && (
              <p className="mt-1.5 text-[11px] text-stone-400">Use your company email — personal inboxes like Gmail are not allowed.</p>
            )}

            {otpSent && !emailVerified && (
              <div className={`mt-3 rounded-xl border p-3 ${errors.otp ? 'border-red-200 bg-red-50/70' : 'border-brand-100 bg-brand-50/50'}`}>
                <label htmlFor="register-otp" className="label-ats">Verification code *</label>
                <div className="flex gap-2 items-stretch">
                  <input
                    id="register-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onBlur={onBlur}
                    name="otp"
                    placeholder="000000"
                    aria-invalid={!!errors.otp}
                    aria-describedby={errors.otp ? 'register-otp-error' : undefined}
                    className={`input-ats font-mono tracking-[0.35em] text-center flex-1 min-w-0 ${errors.otp ? 'input-ats-error' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={onVerifyCode}
                    disabled={otpVerifying || otpCode.length < 6}
                    className="btn-primary shrink-0 !px-3 sm:!px-4"
                  >
                    {otpVerifying ? <Loader2 size={16} className="animate-spin" /> : 'Verify'}
                  </button>
                </div>
                {errors.otp ? (
                  <p id="register-otp-error" className="field-error">{errors.otp}</p>
                ) : (
                  <p className="mt-2 text-[11px] text-stone-500 break-words">
                    We sent a 6-digit code to <span className="font-semibold text-stone-700">{formData.email}</span>.
                  </p>
                )}
                {otpResendMessage && (
                  <p className="mt-1 text-[11px] text-brand-700">{otpResendMessage}</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="register-phone" className="label-ats">Phone number (optional)</label>
            <div className="relative rounded-xl auth-input-glow transition-shadow">
              <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                id="register-phone"
                type="tel"
                name="phone"
                autoComplete="tel"
                value={formData.phone}
                onChange={onChange}
                onBlur={onBlur}
                placeholder="+1 (555) 000-0000"
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? 'register-phone-error' : undefined}
                className={`input-ats !pl-10 !bg-stone-50/80 focus:!bg-white ${errors.phone ? 'input-ats-error' : ''}`}
              />
            </div>
            {errors.phone && <p id="register-phone-error" className="field-error">{errors.phone}</p>}
          </div>

          <div>
            <label htmlFor="register-company" className="label-ats">Company *</label>
            <div className="relative rounded-xl auth-input-glow transition-shadow">
              <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                id="register-company"
                type="text"
                name="companyName"
                autoComplete="organization"
                value={formData.companyName}
                onChange={onChange}
                onBlur={onBlur}
                placeholder="Acme Staffing"
                aria-invalid={!!errors.companyName}
                aria-describedby={errors.companyName ? 'register-company-error' : undefined}
                className={`input-ats !pl-10 !bg-stone-50/80 focus:!bg-white ${errors.companyName ? 'input-ats-error' : ''}`}
              />
            </div>
            {errors.companyName && <p id="register-company-error" className="field-error">{errors.companyName}</p>}
          </div>

          <div>
            <label htmlFor="register-password" className="label-ats">Password *</label>
            <div className="relative rounded-xl auth-input-glow transition-shadow">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={onChange}
                onBlur={onBlur}
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'register-password-error' : undefined}
                className={`input-ats !pl-10 !pr-11 !bg-stone-50/80 focus:!bg-white ${errors.password ? 'input-ats-error' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-400 hover:text-stone-600 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p id="register-password-error" className="field-error">{errors.password}</p>}

            {formData.password && (
              <div className="mt-2.5">
                <div className="flex gap-1 h-1.5 mb-1.5">
                  {[1, 2, 3, 4].map((idx) => (
                    <div
                      key={idx}
                      className={`flex-1 rounded-full transition-all ${
                        strengthScore >= idx ? strengthBarColors[strengthScore] : 'bg-stone-200'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs ${strengthTextColors[strengthScore] || 'text-red-500'}`}>
                  Password strength: {strengthLabels[strengthScore] || 'Weak'}
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="register-confirm" className="label-ats">Confirm password *</label>
            <div className="relative rounded-xl auth-input-glow transition-shadow">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                id="register-confirm"
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={onChange}
                onBlur={onBlur}
                placeholder="••••••••"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'register-confirm-error' : undefined}
                className={`input-ats !pl-10 !bg-stone-50/80 focus:!bg-white ${errors.confirmPassword ? 'input-ats-error' : ''}`}
              />
            </div>
            {errors.confirmPassword && <p id="register-confirm-error" className="field-error">{errors.confirmPassword}</p>}
          </div>

          <motion.button
            whileTap={prefersReduced ? undefined : { scale: 0.97 }}
            type="submit"
            disabled={loading || otpSending || otpVerifying}
            className="btn-cta-primary w-full !py-3.5 mt-1"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                Submit request
                <ArrowRight size={16} />
              </>
            )}
          </motion.button>

          <p className="text-xs text-stone-500 text-center pt-1">
            By submitting, you agree to our{' '}
            <a href="#" className="text-brand-700 hover:text-brand-800">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-brand-700 hover:text-brand-800">Privacy Policy</a>
          </p>

          <div className="auth-switch">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-800">Already have an account?</p>
              <p className="text-xs text-stone-500 mt-0.5">Jump back in and continue hiring.</p>
            </div>
            <Link to="/login" className="auth-switch-cta">
              Log in
              <ArrowRight size={14} />
            </Link>
          </div>
        </motion.form>
      </div>

      <RegisterTrustChips />
    </>
  );
}
