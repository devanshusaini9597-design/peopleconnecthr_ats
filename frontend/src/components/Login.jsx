import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useMotionValue, useMotionTemplate, useReducedMotion } from 'motion/react';
import {
  ArrowLeft, ShieldCheck, Zap, Clock
} from 'lucide-react';
import API_URL from '../config';
import { useAuth } from '../context/AuthContext';

import { PIPELINE_STAGES, PIPELINE_SEED, staggerContainer, validateEmail } from './login/loginConstants';
import SignupPromptModal from './login/SignupPromptModal';
import LoginBrandPanel from './login/LoginBrandPanel';
import LoginAuthCard from './login/LoginAuthCard';
import { RegisterSuccessCard } from './register/RegisterAuthCard';

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { acceptSession } = useAuth();
  const prefersReduced = useReducedMotion();

  // ----- Sign-in state -----
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemoLoggingIn, setIsDemoLoggingIn] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [unmatchedEmail, setUnmatchedEmail] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  // ----- Forgot-password state (same panel, swapped view) -----
  const [mode, setMode] = useState('login'); // 'login' | 'forgot'
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState('idle'); // idle | sending | sent | error
  const [recoveryMessage, setRecoveryMessage] = useState('');

  // ----- MFA state -----
  const [mfaStep, setMfaStep] = useState('login'); // login | mfa | enroll
  const [mfaToken, setMfaToken] = useState('');
  const [enrollmentToken, setEnrollmentToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSetup, setMfaSetup] = useState(null);
  const [backupCodes, setBackupCodes] = useState(null);

  // ----- Ambient "live pipeline" motion on the brand panel -----
  const [pipelineStages, setPipelineStages] = useState(PIPELINE_SEED.map((p) => p.stage));
  useEffect(() => {
    if (prefersReduced) return;
    const id = setInterval(() => {
      setPipelineStages((prev) => {
        const next = [...prev];
        const idx = Math.floor(Math.random() * next.length);
        next[idx] = (next[idx] + 1) % PIPELINE_STAGES.length;
        return next;
      });
    }, 2800);
    return () => clearInterval(id);
  }, [prefersReduced]);

  // ----- Ambient spotlight that follows the cursor on the form side -----
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const handlePanelMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };
  const panelGlow = useMotionTemplate`radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(13,148,136,0.06), transparent 70%)`;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
    if (fieldErrors[e.target.name]) {
      setFieldErrors({ ...fieldErrors, [e.target.name]: '' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setFieldErrors({});

    const { email, password } = formData;

    if (!email || !password) {
      setError(t('auth.enterCredentials'));
      return;
    }
    if (!validateEmail(email)) {
      setFieldErrors({ email: t('auth.invalidEmail') });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data = await res.json();

      if (res.ok) {
        if (data.requiresMfa) {
          setMfaToken(data.mfaToken);
          setMfaStep('mfa');
          setIsSubmitting(false);
          return;
        }
        if (data.requiresMfaEnrollment) {
          setEnrollmentToken(data.enrollmentToken);
          sessionStorage.setItem('mfaEnrollmentToken', data.enrollmentToken);
          setMfaStep('enroll');
          setIsSubmitting(false);
          return;
        }

        // Auth is HttpOnly cookie — do not store JWT in localStorage
        localStorage.removeItem('token');
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userName', data.user?.name || '');
        localStorage.setItem('isLoggedIn', 'true');

        if (data.user) {
          localStorage.setItem('userData', JSON.stringify(data.user));
          localStorage.setItem('userRole', data.user.role || 'recruiter');
          if (data.user.organizationId) {
            localStorage.setItem('orgId', data.user.organizationId);
          }
        }
        if (data.organization) {
          localStorage.setItem('orgData', JSON.stringify(data.organization));
          localStorage.setItem('orgName', data.organization.name || '');
          if (data.organization._id) localStorage.setItem('orgId', data.organization._id);
        }

        setSuccess('Signed in — taking you in.');
        sessionStorage.setItem('showWelcomeModal', '1');

        setTimeout(() => {
          if (data.user && !data.user.onboardingCompleted && !data.organization) {
            window.location.href = '/onboarding';
          } else {
            window.location.href = '/dashboard';
          }
        }, 700);
      } else {
        if (data.message === 'email_unverified') {
          setNeedsVerification(true);
          setResendMessage(data.displayMessage || 'Please verify your email to continue.');
          setIsSubmitting(false);
          return;
        }
        if (data.message === 'invalid_credentials') {
          setError(data.displayMessage || t('auth.invalidCredentials'));
        } else if (data.message === 'password_upgrade_required') {
          setError(data.displayMessage || t('auth.passwordUpgradeRequired'));
        } else if (data.message === 'account_deactivated') {
          setError(data.displayMessage || 'Your account has been deactivated.');
        } else {
          setError(data.displayMessage || data.message || t('auth.loginFailed'));
        }
        setIsSubmitting(false);
      }
    } catch (_err) {
      setError("We couldn't reach the server. Check your connection and try again.");
      setIsSubmitting(false);
    }
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    setError('');
    if (!mfaCode || mfaCode.length < 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/mfa/verify-mfa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, code: mfaCode }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Invalid verification code.');
        setIsSubmitting(false);
        return;
      }
      localStorage.removeItem('token');
      localStorage.setItem('userEmail', data.user?.email || formData.email);
      localStorage.setItem('userName', data.user?.name || '');
      localStorage.setItem('isLoggedIn', 'true');
      if (data.user) {
        localStorage.setItem('userData', JSON.stringify(data.user));
        localStorage.setItem('userRole', data.user.role || 'recruiter');
        if (data.user.organizationId) localStorage.setItem('orgId', data.user.organizationId);
      }
      if (data.organization) {
        localStorage.setItem('orgData', JSON.stringify(data.organization));
        localStorage.setItem('orgName', data.organization.name || '');
        if (data.organization._id) localStorage.setItem('orgId', data.organization._id);
      }
      setSuccess('Signed in — taking you in.');
      setTimeout(() => { window.location.href = '/dashboard'; }, 700);
    } catch (_err) {
      setError("We couldn't verify your code. Try again.");
      setIsSubmitting(false);
    }
  };

  const startEnrollmentSetup = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/mfa/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${enrollmentToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to start MFA setup.');
        setIsSubmitting(false);
        return;
      }
      setMfaSetup(data.data);
      setIsSubmitting(false);
    } catch (_err) {
      setError('Failed to start MFA setup.');
      setIsSubmitting(false);
    }
  };

  const completeEnrollment = async (e) => {
    e.preventDefault();
    setError('');
    if (!mfaCode || mfaCode.length < 6) {
      setError('Enter the 6-digit verification code.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/mfa/verify-setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${enrollmentToken}`,
        },
        body: JSON.stringify({ code: mfaCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Invalid verification code.');
        setIsSubmitting(false);
        return;
      }
      setBackupCodes(data.backupCodes || []);
      sessionStorage.removeItem('mfaEnrollmentToken');
      localStorage.removeItem('token');
      localStorage.setItem('isLoggedIn', 'true');
      if (data.user) localStorage.setItem('userData', JSON.stringify(data.user));
      if (data.organization) {
        localStorage.setItem('orgData', JSON.stringify(data.organization));
        if (data.organization._id) localStorage.setItem('orgId', data.organization._id);
      }
      setSuccess('MFA enabled — taking you in.');
      setTimeout(() => { window.location.href = '/dashboard'; }, 1200);
    } catch (_err) {
      setError('Failed to complete MFA enrollment.');
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setSuccess('');
    setIsDemoLoggingIn(true);

    try {
      const res = await fetch(`${API_URL}/api/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Demo login failed');
      }

      localStorage.removeItem('token');
      acceptSession(data);

      // Confirm the HttpOnly cookie is usable before entering the app
      const profileRes = await fetch(`${API_URL}/api/profile`, { credentials: 'include' });
      if (!profileRes.ok) {
        throw new Error('Demo session could not be verified. Please try again.');
      }
      const profileData = await profileRes.json();
      acceptSession({
        user: profileData.user,
        organization: profileData.organization,
        entitlements: profileData.entitlements,
      });

      setSuccess('Demo account signed in — taking you in.');
      sessionStorage.setItem('showWelcomeModal', '1');
      setTimeout(() => navigate('/dashboard', { replace: true }), 400);
    } catch (err) {
      const message = err?.message && err.message !== 'Demo login failed'
        ? err.message
        : 'Demo service is unavailable right now. Please try again in a moment.';
      setError(message);
      setIsDemoLoggingIn(false);
    }
  };

  const handleResendVerification = async () => {
    const email = formData.email.trim();
    if (!email) return;
    setResendLoading(true);
    setResendMessage('');
    try {
      const res = await fetch(`${API_URL}/api/onboarding/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResendMessage(data.message || 'Verification email sent successfully.');
      } else {
        setResendMessage(data.message || 'Failed to resend. Please try again.');
      }
    } catch {
      setResendMessage('Network error. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!recoveryEmail || !validateEmail(recoveryEmail)) {
      setRecoveryStatus('error');
      setRecoveryMessage('Enter the email address on your account.');
      return;
    }

    setRecoveryStatus('sending');
    setRecoveryMessage('');
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail }),
      });
      const data = await res.json();
      setRecoveryStatus(data.success ? 'sent' : 'error');
      setRecoveryMessage(
        data.success
          ? 'If that email is registered, a reset link is on its way.'
          : (data.message || 'Something went wrong. Please try again.')
      );
    } catch {
      setRecoveryStatus('error');
      setRecoveryMessage("We couldn't reach the server. Try again in a moment.");
    }
  };

  const backToLogin = () => {
    setMode('login');
    setRecoveryStatus('idle');
    setRecoveryMessage('');
    setRecoveryEmail('');
  };

  return (
    <div className="auth-page-shell flex flex-col bg-stone-50 text-stone-900">
      {/* Full-width glass header — back only */}
      <header className="auth-header-bar">
        <Link to="/" className="auth-back-link-btn">
          <span className="auth-back-icon" aria-hidden="true">
            <ArrowLeft size={14} strokeWidth={2.5} />
          </span>
          Back to website
        </Link>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row min-w-0 w-full">
      <LoginBrandPanel pipelineStages={pipelineStages} />

      {/* ============ RIGHT: sign-in form ============ */}
      <motion.div
        onMouseMove={handlePanelMouseMove}
        className="relative flex-1 flex flex-col min-h-[min(100%,70dvh)] lg:min-h-0 auth-form-side"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute inset-0 landing-dot-grid opacity-40" />
          <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-brand-300/25 blur-3xl" />
          <div className="absolute -bottom-28 -left-20 w-80 h-80 rounded-full bg-teal-200/30 blur-3xl" />
          <div className="absolute top-1/3 right-8 w-40 h-40 rounded-full bg-emerald-200/20 blur-2xl hidden lg:block" />
          <motion.div className="absolute inset-0" style={{ background: panelGlow }} />
        </div>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 sm:px-6 md:px-10 py-8 sm:py-10 w-full min-w-0">
          {needsVerification ? (
            <div className="w-full max-w-md min-w-0">
              <RegisterSuccessCard
                prefersReduced={prefersReduced}
                email={formData.email}
                resendLoading={resendLoading}
                resendMessage={resendMessage}
                onResend={handleResendVerification}
              />
              <button
                type="button"
                onClick={() => {
                  setNeedsVerification(false);
                  setResendMessage('');
                  setError('');
                }}
                className="mt-4 w-full text-sm text-stone-500 hover:text-stone-800 underline-offset-2 hover:underline"
              >
                Back to login
              </button>
            </div>
          ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerContainer}
            className="w-full max-w-md min-w-0"
          >
          <LoginAuthCard
            prefersReduced={prefersReduced}
            mode={mode}
            mfaStep={mfaStep}
            formData={formData}
            fieldErrors={fieldErrors}
            error={error}
            success={success}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            isSubmitting={isSubmitting}
            isDemoLoggingIn={isDemoLoggingIn}
            mfaCode={mfaCode}
            setMfaCode={setMfaCode}
            mfaSetup={mfaSetup}
            backupCodes={backupCodes}
            recoveryEmail={recoveryEmail}
            setRecoveryEmail={setRecoveryEmail}
            recoveryStatus={recoveryStatus}
            recoveryMessage={recoveryMessage}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onMfaVerify={handleMfaVerify}
            onStartEnrollment={startEnrollmentSetup}
            onCompleteEnrollment={completeEnrollment}
            onDemoLogin={handleDemoLogin}
            onForgotSubmit={handleForgotSubmit}
            onBackToLogin={backToLogin}
            onForgotMode={() => setMode('forgot')}
            onBackFromMfa={() => { setMfaStep('login'); setMfaCode(''); setError(''); }}
          />

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <span className="auth-trust-chip"><ShieldCheck className="w-3.5 h-3.5 text-brand-600" /> SOC 2 ready</span>
            <span className="auth-trust-chip"><Zap className="w-3.5 h-3.5 text-brand-600" /> Live in minutes</span>
            <span className="auth-trust-chip"><Clock className="w-3.5 h-3.5 text-brand-600" /> 14-day free trial</span>
          </div>
          </motion.div>
          )}
        </div>
      </motion.div>
      </div>

      <SignupPromptModal
        open={showSignupModal}
        unmatchedEmail={unmatchedEmail}
        onClose={() => setShowSignupModal(false)}
      />

    </div>
  );
};

export default Login;
