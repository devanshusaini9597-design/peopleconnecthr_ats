import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import API_URL from '../config';
import { staggerContainer, calculateStrength } from './register/registerConstants';
import RegisterBrandPanel from './register/RegisterBrandPanel';
import RegisterAuthCard, { RegisterSuccessCard } from './register/RegisterAuthCard';

const AuthTopBar = () => (
  <header className="auth-header-bar">
    <Link to="/" className="auth-back-link-btn">
      <span className="auth-back-icon" aria-hidden="true">
        <ArrowLeft size={14} strokeWidth={2.5} />
      </span>
      Back to website
    </Link>
  </header>
);

const Register = () => {
  const prefersReduced = useReducedMotion();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const strengthScore = calculateStrength(formData.password);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
    setApiError('');
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Full name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Work email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/onboarding/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
        })
      });
      const data = await response.json();

      if (!response.ok) {
        const alreadyExists =
          data.code === 'email_already_exists' ||
          data.error === 'email_already_exists' ||
          /email already exists/i.test(data.message || '');
        if (alreadyExists) {
          setApiError('An account with this email already exists and is verified. Please log in.');
        } else {
          setApiError(data.message || 'Registration failed. Please try again.');
        }
      } else {
        // New signup OR existing but unverified — show verification step
        setIsRegistered(true);
        if (data.emailSent === false) {
          setResendMessage(data.message || 'Account created, but the verification email could not be sent. Click Resend after email is configured.');
        } else if (data.pendingVerification) {
          setResendMessage(data.message || 'We sent a new verification email.');
        }
      }
    } catch (err) {
      console.error('[Register] fetch error:', err);
      setApiError(err.message ? `Network error: ${err.message}` : 'Network error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setResendMessage('');
    try {
      const response = await fetch(`${API_URL}/api/onboarding/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email.trim() })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setResendMessage(data.message || 'Verification email sent successfully.');
      } else {
        setResendMessage(data.message || 'Failed to resend. Please try again.');
      }
    } catch (err) {
      setResendMessage('Network error. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  if (isRegistered) {
    return (
      <div className="auth-page-shell flex flex-col bg-stone-50 text-stone-900">
        <AuthTopBar />
        <div className="flex flex-1 flex-col lg:flex-row min-w-0 w-full">
          <RegisterBrandPanel />
          <div className="relative flex-1 flex flex-col min-h-[min(100%,70dvh)] lg:min-h-0 auth-form-side">
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              <div className="absolute inset-0 landing-dot-grid opacity-40" />
              <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-brand-300/25 blur-3xl" />
              <div className="absolute -bottom-28 -left-20 w-80 h-80 rounded-full bg-teal-200/30 blur-3xl" />
            </div>

            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 sm:px-6 md:px-10 py-8 sm:py-10 w-full min-w-0">
              <RegisterSuccessCard
                prefersReduced={prefersReduced}
                email={formData.email}
                resendLoading={resendLoading}
                resendMessage={resendMessage}
                onResend={handleResend}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page-shell flex flex-col bg-stone-50 text-stone-900">
      <AuthTopBar />

      <div className="flex flex-1 flex-col lg:flex-row min-w-0 w-full">
        <RegisterBrandPanel />

        <div className="relative flex-1 flex flex-col min-h-[min(100%,70dvh)] lg:min-h-0 auth-form-side">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0 landing-dot-grid opacity-40" />
            <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-brand-300/25 blur-3xl" />
            <div className="absolute -bottom-28 -left-20 w-80 h-80 rounded-full bg-teal-200/30 blur-3xl" />
            <div className="absolute top-1/3 right-8 w-40 h-40 rounded-full bg-emerald-200/20 blur-2xl hidden lg:block" />
          </div>

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 sm:px-6 md:px-10 py-8 sm:py-10 w-full min-w-0">
            <motion.div
              initial="hidden"
              animate="show"
              variants={staggerContainer}
              className="w-full max-w-md min-w-0"
            >
              <RegisterAuthCard
                prefersReduced={prefersReduced}
                formData={formData}
                errors={errors}
                apiError={apiError}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                loading={loading}
                strengthScore={strengthScore}
                onChange={handleChange}
                onSubmit={handleSubmit}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
