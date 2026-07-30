import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Briefcase, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
  AlertCircle, X, UserPlus, Loader2, CheckCircle2
} from 'lucide-react';
import API_URL from '../config';

// Quiet nod to what this product actually does — a hiring pipeline —
// rendered as a small progress signature under the wordmark.
const PIPELINE_STAGES = ['Sourced', 'Screening', 'Interview', 'Hired'];

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const Login = () => {
  const navigate = useNavigate();

  // ----- Sign-in state -----
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [unmatchedEmail, setUnmatchedEmail] = useState('');

  // ----- Forgot-password state (same card, swapped view) -----
  const [mode, setMode] = useState('login'); // 'login' | 'forgot'
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState('idle'); // idle | sending | sent | error
  const [recoveryMessage, setRecoveryMessage] = useState('');

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
    } catch (err) {
      setError("We couldn't reach the server. Check your connection and try again.");
      setIsSubmitting(false);
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
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex items-center justify-center p-4 relative overflow-hidden">
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 9s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        @media (prefers-reduced-motion: reduce) {
          .animate-blob { animation: none; }
        }
      `}</style>

      {/* Soft ambient background, matching the landing page */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-200/50 rounded-full filter blur-[120px] opacity-70 animate-blob" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-200/50 rounded-full filter blur-[120px] opacity-70 animate-blob animation-delay-2000" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Wordmark */}
        <Link to="/" className="flex items-center justify-center space-x-2 mb-8">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg shadow-sm">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">
            SkillNix
          </span>
        </Link>

        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200">
          {mode === 'login' ? (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
                <p className="text-sm text-gray-500 mt-1">Sign in to pick up where your pipeline left off.</p>
              </div>

              {/* Pipeline signature strip */}
              <div className="flex items-center justify-between mb-8 px-1" aria-hidden="true">
                {PIPELINE_STAGES.map((stage, i) => (
                  <React.Fragment key={stage}>
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          i === PIPELINE_STAGES.length - 1
                            ? 'bg-blue-600 shadow-[0_0_8px_2px_rgba(37,99,235,0.35)]'
                            : 'bg-gray-300'
                        }`}
                      />
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 hidden sm:block">
                        {stage}
                      </span>
                    </div>
                    {i < PIPELINE_STAGES.length - 1 && (
                      <div className="flex-1 h-px bg-gray-200 mx-1" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Status messages */}
              <div aria-live="polite">
                {error && (
                  <div className="mb-4 flex items-start gap-2 p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="mb-4 flex items-center gap-2 p-3 rounded-lg text-sm bg-emerald-50 border border-emerald-200 text-emerald-700">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>{success}</span>
                  </div>
                )}
              </div>

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
                      className={`w-full pl-10 pr-4 py-3 rounded-lg bg-gray-50 border text-gray-900 placeholder-gray-400 outline-none transition-colors
                        focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white
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
                      className="w-full pl-10 pr-11 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 outline-none transition-colors focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white"
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

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 active:scale-[0.98]"
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
                </button>
              </form>

              <p className="text-center text-sm mt-6 text-gray-500">
                New to SkillNix?{' '}
                <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700">
                  Start your free trial
                </Link>
              </p>
            </>
          ) : (
            <>
              {/* ---- Forgot password view ---- */}
              <button
                onClick={backToLogin}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6"
              >
                <ArrowLeft size={15} />
                Back to sign in
              </button>

              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
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
                        className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 outline-none transition-colors focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={recoveryStatus === 'sending'}
                    className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 active:scale-[0.98]"
                  >
                    {recoveryStatus === 'sending' ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Sending link…
                      </>
                    ) : (
                      'Send reset link'
                    )}
                  </button>
                </form>
              )}

              {recoveryStatus === 'sent' && (
                <button
                  onClick={backToLogin}
                  className="w-full text-center px-6 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors font-medium text-gray-700"
                >
                  Back to sign in
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Account-not-found modal */}
      {showSignupModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
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
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
