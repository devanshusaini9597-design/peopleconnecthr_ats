

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, X, AlertCircle, UserPlus, Eye, EyeOff } from 'lucide-react';
import API_URL from '../config';

const Login = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [unmatchedEmail, setUnmatchedEmail] = useState('');

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password validation - min 8 chars, uppercase, lowercase, number, special char
  const validatePassword = (password) => {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    const hasMinLength = password.length >= 8;

    return {
      valid: hasUppercase && hasLowercase && hasNumber && hasSpecial && hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecial,
      hasMinLength
    };
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
    if (fieldErrors[e.target.name]) {
      setFieldErrors({ ...fieldErrors, [e.target.name]: '' });
    }
  };

  // ✅ Updated HandleSubmit with validation
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setFieldErrors({});

    const { email, password } = formData;
    const errors = {};

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    // Validate email format
    if (!validateEmail(email)) {
      setFieldErrors({ email: 'Please enter a valid email address' });
      return;
    }

    try {
      console.log('🔵 [LOGIN] Attempting login with email:', email);
      console.log('🔵 [LOGIN] API URL:', API_URL);
      
      // ✅ POST to backend (works for localhost and live; CORS allows both)
      const res = await fetch(`${API_URL}/api/login`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      console.log('🔵 [LOGIN] Response status:', res.status, 'ok:', res.ok);
      
      const data = await res.json();
      console.log('🔵 [LOGIN] Response data:', data);

      if (res.ok) {
        // --- SUCCESS CASE ---
        localStorage.setItem('token', data.token);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userName', data.user?.name || '');
        localStorage.setItem('isLoggedIn', 'true');
        
        // Store SaaS-specific data
        if (data.user) {
          localStorage.setItem('userData', JSON.stringify(data.user));
          localStorage.setItem('userRole', data.user.role || 'recruiter');
        }
        if (data.organization) {
          localStorage.setItem('orgData', JSON.stringify(data.organization));
          localStorage.setItem('orgName', data.organization.name || '');
        }

        setSuccess('Login Successful! Redirecting...');
        
        setTimeout(() => {
          // Route based on onboarding status
          if (data.user && !data.user.onboardingCompleted && !data.organization) {
            window.location.href = '/onboarding';
          } else {
            window.location.href = '/dashboard';
          }
        }, 1000);
      } else {
        // Check if email is not found
        console.log('🟡 [LOGIN] Login failed with message:', data.message);
        if (data.message === 'email_not_found') {
          setUnmatchedEmail(email);
          setShowSignupModal(true);
          setError('');
        } else {
          setError('Incorrect email or password. Please try again.');
        }
      }
    } catch (err) {
      console.error('🔴 [LOGIN] Network/Request Error:', err);
      setError("Server se connect nahi ho paa raha. Please wait 30 seconds and try again.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 font-sans" style={{backgroundColor: 'var(--neutral-50)'}}>
      <div className="w-full max-w-md rounded-2xl p-8" style={{backgroundColor: 'var(--bg-primary)', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border-light)'}}>
        
        <h2 className="text-3xl font-bold text-center mb-6" style={{color: 'var(--primary-main)'}}>Login</h2>
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm text-center font-medium" style={{backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-main)', color: 'var(--error-main)'}}>
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 rounded-lg text-sm text-center font-medium" style={{backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-main)', color: 'var(--success-main)'}}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold" style={{color: 'var(--text-secondary)'}}>Email Address</label>
            <input 
              type="email" 
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="admin@company.com" 
              className="w-full mt-1 p-3 rounded-lg outline-none transition-all"
              style={{
                border: `1px solid ${fieldErrors.email ? 'var(--error-main)' : 'var(--border-main)'}`,
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-primary)'
              }}
              onFocus={(e) => e.target.style.boxShadow = '0 0 0 3px var(--primary-lighter)'}
              onBlur={(e) => e.target.style.boxShadow = 'none'}
            />
            {fieldErrors.email && <p className="text-sm mt-1" style={{color: 'var(--error-main)'}}>{fieldErrors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold" style={{color: 'var(--text-secondary)'}}>Password</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                name="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••" 
                className="w-full mt-1 p-3 pr-11 rounded-lg outline-none transition-all"
                style={{
                  border: `1px solid ${fieldErrors.password ? 'var(--error-main)' : 'var(--border-main)'}`,
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-primary)'
                }}
                onFocus={(e) => e.target.style.boxShadow = '0 0 0 3px var(--primary-lighter)'}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 p-1 rounded-md hover:bg-gray-100 transition"
                style={{ color: 'var(--text-tertiary)' }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && <p className="text-sm mt-1" style={{color: 'var(--error-main)'}}>{fieldErrors.password}</p>}
          </div>
          
          <button 
            type="submit" 
            className="w-full text-white font-bold py-3 rounded-lg shadow-lg transition-all active:scale-95"
            style={{
              background: 'var(--gradient-primary)',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)'
            }}
            onMouseEnter={(e) => e.target.style.boxShadow = '0 0 30px rgba(99, 102, 241, 0.5)'}
            onMouseLeave={(e) => e.target.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.3)'}
          >
            Sign In
          </button>
        </form>

        <p className="text-center mt-6" style={{color: 'var(--text-secondary)'}}>
          New here? <Link to="/register" className="font-semibold hover:underline" style={{color: 'var(--primary-main)'}}>Register Account</Link>
        </p>
      </div>

      {/* SIGNUP SUGGESTION MODAL */}
      {showSignupModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center">
                    <AlertCircle size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Account Not Found</h3>
                    <p className="text-xs text-gray-500 mt-0.5">No account exists with this email</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSignupModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 pb-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-800 truncate">{unmatchedEmail}</span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-3">
                Would you like to create a new account with this email address?
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowSignupModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  setShowSignupModal(false);
                  navigate('/register');
                }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition flex items-center justify-center gap-1.5"
              >
                <UserPlus size={16} />
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;