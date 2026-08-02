import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useMotionTemplate, useSpring, useReducedMotion } from 'motion/react';
import {
  Briefcase, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
  AlertCircle, X, UserPlus, Loader2, CheckCircle2, Sparkles
} from 'lucide-react';
import API_URL from '../config';

const PIPELINE_STAGES = ['Sourced', 'Screening', 'Interview', 'Offer', 'Hired'];

// Illustrative rows for the sign-in panel's "live pipeline" signature visual.
// Sample data only — not real candidates.
const PIPELINE_SEED = [
  { name: 'A. Sharma', role: 'Frontend Engineer', stage: 2 },
  { name: 'R. Iyer', role: 'Product Designer', stage: 1 },
  { name: 'M. Chen', role: 'Data Analyst', stage: 3 },
  { name: 'T. Osei', role: 'Sales Lead', stage: 4 },
];

const DISPLAY_FONT = "'Sora', 'Segoe UI', sans-serif";

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

/** Wraps a button/link and gently pulls it toward the cursor. */
const Magnetic = ({ children, strength = 0.25, className = '' }) => {
  const prefersReduced = useReducedMotion();
  const ref = React.useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 16, mass: 0.2 });
  const springY = useSpring(y, { stiffness: 200, damping: 16, mass: 0.2 });

  const handleMouseMove = (e) => {
    if (prefersReduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * strength);
    y.set((e.clientY - rect.top - rect.height / 2) * strength);
  };
  const handleMouseLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={prefersReduced ? undefined : { x: springX, y: springY }}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.div>
  );
};

/** One row of the "live pipeline" signature visual — name/role plus a segmented stage track. */
const PipelineRow = ({ name, role, stage }) => (
  <div className="flex items-center justify-between gap-4 py-3 border-b border-white/[0.06] last:border-0">
    <div className="min-w-0">
      <p className="text-sm font-medium text-white truncate">{name}</p>
      <p className="text-xs text-slate-400 truncate">{role}</p>
    </div>
    <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
      {PIPELINE_STAGES.map((label, i) => (
        <span
          key={label}
          title={label}
          className={`h-1.5 rounded-full transition-all duration-700 ease-out ${
            i === stage
              ? 'w-5 bg-gradient-to-r from-sky-400 to-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]'
              : i < stage
                ? 'w-1.5 bg-indigo-400/40'
                : 'w-1.5 bg-white/10'
          }`}
        />
      ))}
    </div>
  </div>
);

const Login = () => {
  const navigate = useNavigate();
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
  const panelGlow = useMotionTemplate`radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(37,99,235,0.05), transparent 70%)`;

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
      setError('Enter your email and password to continue.');
      return;
    }
    if (!validateEmail(email)) {
      setFieldErrors({ email: 'Enter a valid email address.' });
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

        localStorage.setItem('token', data.token);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userName', data.user?.name || '');
        localStorage.setItem('isLoggedIn', 'true');

        if (data.user) {
          localStorage.setItem('userData', JSON.stringify(data.user));
          localStorage.setItem('userRole', data.user.role || 'recruiter');
        }
        if (data.organization) {
          localStorage.setItem('orgData', JSON.stringify(data.organization));
          localStorage.setItem('orgName', data.organization.name || '');
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
        if (data.message === 'email_not_found') {
          setUnmatchedEmail(email);
          setShowSignupModal(true);
        } else {
          setError("That email and password don't match. Try again, or reset your password below.");
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
      localStorage.setItem('token', data.token);
      localStorage.setItem('userEmail', data.user?.email || formData.email);
      localStorage.setItem('userName', data.user?.name || '');
      localStorage.setItem('isLoggedIn', 'true');
      if (data.user) {
        localStorage.setItem('userData', JSON.stringify(data.user));
        localStorage.setItem('userRole', data.user.role || 'recruiter');
      }
      if (data.organization) {
        localStorage.setItem('orgData', JSON.stringify(data.organization));
        localStorage.setItem('orgName', data.organization.name || '');
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
      if (data.token) {
        localStorage.setItem('token', data.token);
        sessionStorage.removeItem('mfaEnrollmentToken');
        localStorage.setItem('isLoggedIn', 'true');
        if (data.user) localStorage.setItem('userData', JSON.stringify(data.user));
        if (data.organization) localStorage.setItem('orgData', JSON.stringify(data.organization));
        setSuccess('MFA enabled — taking you in.');
        setTimeout(() => { window.location.href = '/dashboard'; }, 1200);
      }
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

      localStorage.setItem('token', data.token);
      localStorage.setItem('userEmail', data.user?.email || '');
      localStorage.setItem('userName', data.user?.name || 'Demo User');
      localStorage.setItem('isLoggedIn', 'true');
      if (data.user) {
        localStorage.setItem('userData', JSON.stringify(data.user));
        localStorage.setItem('userRole', data.user.role || 'recruiter');
      }
      if (data.organization) {
        localStorage.setItem('orgData', JSON.stringify(data.organization));
        localStorage.setItem('orgName', data.organization.name || 'Demo Organization');
      }

      setSuccess('Demo account signed in — taking you in.');
      sessionStorage.setItem('showWelcomeModal', '1');
      setTimeout(() => window.location.href = '/dashboard', 600);
    } catch (err) {
      const message = err?.message && err.message !== 'Demo login failed'
        ? err.message
        : 'Demo service is unavailable right now. Please try again in a moment.';
      setError(message);
      setIsDemoLoggingIn(false);
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
    <div className="min-h-screen flex bg-white text-slate-900">
      {/* ============ LEFT: brand panel (desktop only) ============ */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] relative flex-col overflow-hidden bg-[#080b16] px-12 xl:px-16 py-10">
        {/* Fine grid texture */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]" aria-hidden="true">
          <defs>
            <pattern id="loginGrid" width="42" height="42" patternUnits="userSpaceOnUse">
              <path d="M 42 0 L 0 0 0 42" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#loginGrid)" />
        </svg>
        {/* Single ambient glow, restrained */}
        <div className="absolute -top-24 -left-16 w-[26rem] h-[26rem] rounded-full bg-indigo-600/20 blur-[110px]" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#080b16] to-transparent" aria-hidden="true" />

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: DISPLAY_FONT }}>
              SkillNix
            </span>
          </Link>
        </motion.div>

        <div className="relative z-10 flex-1 flex flex-col justify-center py-10">
          <motion.div initial="hidden" animate="show" variants={staggerContainer}>
            <motion.p
              variants={fadeUp}
              className="text-xs font-semibold tracking-[0.2em] text-indigo-300/80 uppercase mb-5"
            >
              Applicant tracking, simplified
            </motion.p>
            <motion.h1
              variants={fadeUp}
              style={{ fontFamily: DISPLAY_FONT }}
              className="text-4xl xl:text-[2.7rem] font-bold leading-[1.15] text-white mb-5"
            >
              Every candidate,<br />exactly where they<br />are in your pipeline.
            </motion.h1>
            <motion.p variants={fadeUp} className="text-slate-400 text-[15px] leading-relaxed max-w-sm mb-10">
              Sign in to review today's pipeline, move candidates forward, and keep every hire on track.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5 max-w-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
                  Live pipeline
                </span>
              </div>
              <div>
                {PIPELINE_SEED.map((p, i) => (
                  <PipelineRow key={p.name} name={p.name} role={p.role} stage={pipelineStages[i]} />
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>

        <div className="relative z-10 text-xs text-slate-500">
          © {new Date().getFullYear()} SkillNix Inc. — built for recruiting teams who move fast.
        </div>
      </div>

      {/* ============ RIGHT: sign-in form ============ */}
      <motion.div
        onMouseMove={handlePanelMouseMove}
        className="relative flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-12"
      >
        <motion.div className="pointer-events-none absolute inset-0" style={{ background: panelGlow }} aria-hidden="true" />

        {/* Mobile-only wordmark */}
        <Link to="/" className="lg:hidden flex items-center gap-2.5 mb-10 relative z-10">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900" style={{ fontFamily: DISPLAY_FONT }}>SkillNix</span>
        </Link>

        <motion.div
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="w-full max-w-sm relative z-10"
        >
          <AnimatePresence mode="wait">
            {mode === 'login' ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: prefersReduced ? 0 : -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: prefersReduced ? 0 : 16 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                <div className="mb-8">
                  <h1 style={{ fontFamily: DISPLAY_FONT }} className="text-[28px] font-bold text-gray-900">
                    {mfaStep === 'mfa' ? 'Two-factor authentication' : mfaStep === 'enroll' ? 'Set up MFA' : 'Welcome back'}
                  </h1>
                  <p className="text-sm text-gray-500 mt-1.5">
                    {mfaStep === 'mfa'
                      ? 'Enter the code from your authenticator app.'
                      : mfaStep === 'enroll'
                        ? 'Your organization requires MFA before you can sign in.'
                        : 'Sign in to your SkillNix account to continue.'}
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
                        <div className="mb-4 flex items-start gap-2 p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
                          <AlertCircle size={16} className="mt-0.5 shrink-0" />
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
                  <form onSubmit={handleMfaVerify} className="space-y-5" noValidate>
                    <div>
                      <label htmlFor="mfa-code" className="block text-sm font-medium text-gray-700 mb-1.5">
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
                        className="w-full px-4 py-3 rounded-xl bg-slate-50/70 border border-gray-200 text-gray-900 font-mono tracking-widest text-center text-lg outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
                      />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & sign in'}
                    </button>
                    <button type="button" onClick={() => { setMfaStep('login'); setMfaCode(''); setError(''); }} className="w-full text-sm text-gray-500 hover:text-gray-700">
                      Back to sign in
                    </button>
                  </form>
                ) : mfaStep === 'enroll' ? (
                  <div className="space-y-5">
                    {!mfaSetup ? (
                      <button type="button" onClick={startEnrollmentSetup} disabled={isSubmitting} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Begin MFA setup'}
                      </button>
                    ) : (
                      <form onSubmit={completeEnrollment} className="space-y-4">
                        <p className="text-sm text-gray-600">Add this secret to your authenticator app:</p>
                        <code className="block text-xs font-mono bg-slate-100 rounded-lg p-3 break-all">{mfaSetup.secret}</code>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 font-mono tracking-widest text-center"
                        />
                        <button type="submit" disabled={isSubmitting} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold">
                          {isSubmitting ? 'Verifying…' : 'Verify & continue'}
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
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div>
                    <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        id="login-email"
                        type="email"
                        name="email"
                        autoComplete="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="you@company.com"
                        aria-invalid={!!fieldErrors.email}
                        aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                        className={`w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50/70 border text-gray-900 placeholder-gray-400 outline-none transition-colors
                          focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white
                          ${fieldErrors.email ? 'border-red-400' : 'border-gray-200'}`}
                      />
                    </div>
                    {fieldErrors.email && (
                      <p id="login-email-error" className="text-sm mt-1.5 text-red-600">{fieldErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        autoComplete="current-password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-50/70 border border-gray-200 text-gray-900 placeholder-gray-400 outline-none transition-colors focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <Magnetic strength={0.15} className="w-full">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      disabled={isSubmitting || isDemoLoggingIn}
                      className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/35"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Signing in…
                        </>
                      ) : (
                        <>
                          Sign in
                          <ArrowRight size={16} />
                        </>
                      )}
                    </motion.button>
                  </Magnetic>

                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white px-3 text-xs text-gray-400 uppercase tracking-wider">or</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={isSubmitting || isDemoLoggingIn}
                    className="w-full inline-flex items-center justify-center gap-2 border border-blue-200 text-blue-700 font-semibold py-3 rounded-xl bg-white hover:bg-blue-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {isDemoLoggingIn ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Entering demo…
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Try demo account
                      </>
                    )}
                  </button>

                  <p className="text-center text-sm mt-6 text-gray-500">
                    New to SkillNix?{' '}
                    <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700">
                      Start your free trial
                    </Link>
                  </p>
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
                  onClick={backToLogin}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6"
                >
                  <ArrowLeft size={15} />
                  Back to sign in
                </button>

                <div className="mb-6">
                  <h1 style={{ fontFamily: DISPLAY_FONT }} className="text-2xl font-bold text-gray-900">
                    Reset your password
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
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
                  <form onSubmit={handleForgotSubmit} className="space-y-5" noValidate>
                    <div>
                      <label htmlFor="recovery-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Email address
                      </label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          id="recovery-email"
                          type="email"
                          autoComplete="email"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          placeholder="you@company.com"
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50/70 border border-gray-200 text-gray-900 placeholder-gray-400 outline-none transition-colors focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    <Magnetic strength={0.15} className="w-full">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        type="submit"
                        disabled={recoveryStatus === 'sending'}
                        className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/35"
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
                    onClick={backToLogin}
                    className="w-full text-center px-6 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors font-medium text-gray-700"
                  >
                    Back to sign in
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Account-not-found modal */}
      <AnimatePresence>
        {showSignupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
            >
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center">
                      <AlertCircle size={20} className="text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Account not found</h3>
                      <p className="text-xs text-gray-500 mt-0.5">No account exists with this email</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSignupModal(false)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Close"
                  >
                    <X size={18} className="text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="px-6 pb-4">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-800 truncate">{unmatchedEmail}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  Want to create a new account with this email address?
                </p>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setShowSignupModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Try again
                </button>
                <button
                  onClick={() => {
                    setShowSignupModal(false);
                    navigate('/register');
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <UserPlus size={16} />
                  Create account
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;
