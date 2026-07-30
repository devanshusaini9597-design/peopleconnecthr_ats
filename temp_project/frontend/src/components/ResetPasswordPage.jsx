import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import BASE_API_URL from '../config';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [isVerifying, setIsVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setIsVerifying(false);
      setError('No reset token provided. Please request a new password reset link.');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`${BASE_API_URL}/api/auth/verify-reset-token?token=${token}`);
        const data = await res.json();
        if (data.success) {
          setIsValid(true);
          setEmail(data.email);
        } else {
          setError(data.message || 'Invalid or expired reset link');
        }
      } catch {
        setError('Failed to verify reset link. Please try again.');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const validatePassword = (pwd) => {
    const checks = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    };
    return checks;
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    const checks = validatePassword(newPassword);
    if (!checks.uppercase || !checks.lowercase || !checks.number || !checks.special) {
      setError('Password must include uppercase, lowercase, number, and special character');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch(`${BASE_API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(data.message || 'Failed to reset password');
      }
    } catch {
      setError('Failed to reset password. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const checks = validatePassword(newPassword);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Reset Password</h1>
            <p className="text-white/80 text-sm mt-1">SkillNix ATS</p>
          </div>

          <div className="p-6">
            {isVerifying ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
                <p className="text-gray-500">Verifying reset link...</p>
              </div>
            ) : success ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Password Reset Successful</h2>
                <p className="text-gray-500 text-sm">Redirecting to login...</p>
              </div>
            ) : !isValid ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-800 mb-2">Invalid Reset Link</h2>
                <p className="text-gray-500 text-sm mb-4">{error}</p>
                <Link to="/login" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium text-sm">
                  <ArrowLeft className="w-4 h-4" /> Back to Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <p className="text-sm text-gray-500 text-center mb-4">
                  Resetting password for <strong>{email}</strong>
                </p>

                {error && (
                  <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 border border-red-200">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 pr-10"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPassword && (
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                      <span className={checks.length ? 'text-green-600' : 'text-gray-400'}>8+ characters {checks.length ? '✓' : ''}</span>
                      <span className={checks.uppercase ? 'text-green-600' : 'text-gray-400'}>Uppercase {checks.uppercase ? '✓' : ''}</span>
                      <span className={checks.lowercase ? 'text-green-600' : 'text-gray-400'}>Lowercase {checks.lowercase ? '✓' : ''}</span>
                      <span className={checks.number ? 'text-green-600' : 'text-gray-400'}>Number {checks.number ? '✓' : ''}</span>
                      <span className={checks.special ? 'text-green-600' : 'text-gray-400'}>Special char {checks.special ? '✓' : ''}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 pr-10 ${confirmPassword && confirmPassword !== newPassword ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200'}`}
                      required
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isResetting || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {isResetting ? <><Loader2 className="w-4 h-4 animate-spin" /> Resetting...</> : 'Reset Password'}
                </button>

                <div className="text-center mt-3">
                  <Link to="/login" className="text-sm text-gray-500 hover:text-indigo-600">Back to Login</Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
