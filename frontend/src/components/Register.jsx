import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import API_URL from '../config';
import { staggerContainer, calculateStrength, validateWorkEmail, validateSignupForm, firstRegisterError, focusRegisterField, REGISTER_FIELD_ORDER } from './register/registerConstants';
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

function applyRegisterError(data, setApiError, setErrors) {
  const alreadyExists =
    data.code === 'email_already_exists' ||
    data.error === 'email_already_exists' ||
    /email already exists/i.test(data.message || '');
  const personalBlocked =
    data.code === 'personal_email_not_allowed' ||
    /work email|personal email/i.test(data.message || '');
  if (alreadyExists) {
    const message = 'An account with this email already exists. Please log in, or wait if your trial is still under review.';
    setApiError(message);
    setErrors((prev) => ({ ...prev, email: message }));
    return 'email';
  }
  if (personalBlocked) {
    const message = data.message || 'Please use your work email address.';
    setApiError(message);
    setErrors((prev) => ({ ...prev, email: message }));
    return 'email';
  }
  if (data.code === 'email_not_verified') {
    setErrors((prev) => ({ ...prev, email: data.message || 'Verify your work email before submitting.' }));
    return 'email';
  }
  if (data.code === 'name_required') {
    setErrors((prev) => ({ ...prev, name: data.message || 'Full name is required' }));
    return 'name';
  }
  if (data.code === 'company_required') {
    setErrors((prev) => ({ ...prev, companyName: data.message || 'Company name is required' }));
    return 'companyName';
  }
  setApiError(data.displayMessage || data.message || 'Could not submit your request. Please try again.');
  return null;
}

const Register = () => {
  const prefersReduced = useReducedMotion();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    name: '',
    email: (searchParams.get('email') || '').trim(),
    phone: '',
    companyName: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [signupOtpToken, setSignupOtpToken] = useState('');
  const [signupVerifiedToken, setSignupVerifiedToken] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpResendMessage, setOtpResendMessage] = useState('');

  const strengthScore = calculateStrength(formData.password);

  const resetEmailVerification = () => {
    setEmailVerified(false);
    setSignupVerifiedToken('');
    setSignupOtpToken('');
    setOtpCode('');
    setOtpSent(false);
    setOtpResendMessage('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setApiError('');
    if (name === 'email') {
      resetEmailVerification();
      setErrors((prev) => ({ ...prev, email: '', otp: '' }));
      return;
    }
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const handleOtpChange = (value) => {
    setOtpCode(value);
    if (errors.otp) setErrors((prev) => ({ ...prev, otp: '' }));
  };

  const handleBlur = (e) => {
    const field = e.target.name;
    if (!REGISTER_FIELD_ORDER.includes(field)) return;
    const snapshot = {
      formData: field === 'otp' ? formData : { ...formData, [field]: e.target.value },
      emailVerified,
      otpSent,
      otpCode: field === 'otp' ? e.target.value.replace(/\D/g, '').slice(0, 6) : otpCode,
    };
    const next = validateSignupForm(snapshot);
    setErrors((prev) => ({ ...prev, [field]: next[field] || '' }));
  };

  const handleSendCode = async () => {
    const work = validateWorkEmail(formData.email);
    if (!formData.email.trim() || !work.valid) {
      setErrors((prev) => ({
        ...prev,
        email: !formData.email.trim() ? 'Work email is required' : work.reason,
      }));
      focusRegisterField('email');
      return;
    }

    setOtpSending(true);
    setApiError('');
    setErrors((prev) => ({ ...prev, email: '', otp: '' }));
    try {
      const response = await fetch(`${API_URL}/api/onboarding/send-signup-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim(),
          name: formData.name.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const field = applyRegisterError(data, setApiError, setErrors);
        focusRegisterField(field || 'email');
        return;
      }
      if (data.pendingApproval) {
        setIsRegistered(true);
        return;
      }
      setSignupOtpToken(data.signupOtpToken);
      setOtpSent(true);
      setOtpCode('');
      setOtpResendMessage(data.message || 'Enter the 6-digit code we sent to your work email.');
      focusRegisterField('otp');
    } catch (err) {
      setApiError(err.message ? `Network error: ${err.message}` : 'Network error. Please try again later.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!otpCode || otpCode.length < 6) {
      setErrors((prev) => ({ ...prev, otp: 'Enter the 6-digit code from your work email.' }));
      focusRegisterField('otp');
      return;
    }
    setOtpVerifying(true);
    setApiError('');
    try {
      const response = await fetch(`${API_URL}/api/onboarding/verify-signup-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signupOtpToken, code: otpCode }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.signupOtpToken) setSignupOtpToken(data.signupOtpToken);
        setErrors((prev) => ({
          ...prev,
          otp: data.displayMessage || data.message || 'That code is incorrect.',
        }));
        focusRegisterField('otp');
        return;
      }
      setSignupVerifiedToken(data.signupVerifiedToken);
      setEmailVerified(true);
      setOtpResendMessage('');
      setErrors((prev) => ({ ...prev, email: '', otp: '' }));
      const nextEmpty = !formData.companyName.trim()
        ? 'companyName'
        : !formData.password
          ? 'password'
          : !formData.confirmPassword
            ? 'confirmPassword'
            : null;
      if (nextEmpty) focusRegisterField(nextEmpty);
    } catch (err) {
      setApiError(err.message ? `Network error: ${err.message}` : 'Network error. Please try again later.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateSignupForm({ formData, emailVerified, otpSent, otpCode });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      focusRegisterField(firstRegisterError(validationErrors));
      return;
    }

    setLoading(true);
    setApiError('');
    try {
      const response = await fetch(`${API_URL}/api/onboarding/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          companyName: formData.companyName.trim(),
          signupVerifiedToken,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        const field = applyRegisterError(data, setApiError, setErrors);
        if (field) focusRegisterField(field);
      } else {
        setIsRegistered(true);
      }
    } catch (err) {
      console.error('[Register] fetch error:', err);
      setApiError(err.message ? `Network error: ${err.message}` : 'Network error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = (searchParams.get('signupOtpToken') || '').trim();
    const shouldResend = searchParams.get('otpResend') === '1';
    const otpStep = searchParams.get('signupOtp') === '1';
    if (!token && !otpStep && !shouldResend) return;

    if (token) {
      setSignupOtpToken(token);
      setOtpSent(true);
    }

    if (shouldResend && token) {
      const guardKey = `signup-otp-email-resend:${token}`;
      if (!sessionStorage.getItem(guardKey)) {
        sessionStorage.setItem(guardKey, '1');
        (async () => {
          setOtpSending(true);
          setApiError('');
          try {
            const res = await fetch(`${API_URL}/api/onboarding/resend-signup-otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ signupOtpToken: token }),
            });
            const data = await res.json();
            if (!res.ok) {
              setApiError(data.displayMessage || data.message || 'Could not resend the code.');
              return;
            }
            if (data.signupOtpToken) setSignupOtpToken(data.signupOtpToken);
            setOtpSent(true);
            setOtpResendMessage(data.message || 'A new code is on its way.');
          } catch {
            setApiError('Could not resend the code. Try again.');
          } finally {
            setOtpSending(false);
          }
        })();
      }
    }

    if (shouldResend || otpStep) {
      const next = new URLSearchParams(searchParams);
      next.delete('otpResend');
      next.delete('signupOtp');
      const qs = next.toString();
      navigate(qs ? `/register?${qs}` : '/register', { replace: true });
    }
    // Consume email deep-links once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = isRegistered ? (
    <RegisterSuccessCard
      prefersReduced={prefersReduced}
      email={formData.email}
      variant="pending"
    />
  ) : (
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
        onBlur={handleBlur}
        onSubmit={handleSubmit}
        emailVerified={emailVerified}
        otpSent={otpSent}
        otpCode={otpCode}
        setOtpCode={handleOtpChange}
        otpSending={otpSending}
        otpVerifying={otpVerifying}
        otpResendMessage={otpResendMessage}
        onSendCode={handleSendCode}
        onVerifyCode={handleVerifyCode}
      />
    </motion.div>
  );

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
            {card}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
