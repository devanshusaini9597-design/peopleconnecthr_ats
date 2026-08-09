import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import API_URL from '../config';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. No token provided.');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/onboarding/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.message || 'Verification failed. The link may be expired or invalid.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('Network error. Please try again later.');
      }
    };

    verifyEmail();
  }, [searchParams]);

  const handleContinue = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="auth-header-bar">
        <Link to="/" className="auth-back-link-btn">
          <span className="auth-back-icon" aria-hidden="true">
            <ArrowLeft size={14} strokeWidth={2.5} />
          </span>
          Back to website
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-lg border border-stone-200 p-8">
            {status === 'loading' && (
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <Loader2 className="w-16 h-16 text-brand-600 animate-spin" />
                </div>
                <h2 className="text-2xl font-semibold text-stone-900 mb-2">Verifying Your Email</h2>
                <p className="text-stone-600">Please wait while we verify your email address...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', duration: 0.5 }}
                  >
                    <CheckCircle className="w-16 h-16 text-emerald-500" />
                  </motion.div>
                </div>
                <h2 className="text-2xl font-semibold text-stone-900 mb-2">Email Verified!</h2>
                <p className="text-stone-600 mb-6">{message}</p>
                <button
                  onClick={handleContinue}
                  className="w-full py-3 px-4 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors"
                >
                  Continue to Login
                </button>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <XCircle className="w-16 h-16 text-red-500" />
                </div>
                <h2 className="text-2xl font-semibold text-stone-900 mb-2">Verification Failed</h2>
                <p className="text-stone-600 mb-6">{message}</p>
                <div className="space-y-3">
                  <Link
                    to="/register"
                    className="block w-full py-3 px-4 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors text-center"
                  >
                    Create New Account
                  </Link>
                  <Link
                    to="/login"
                    className="block w-full py-3 px-4 bg-stone-100 text-stone-700 rounded-lg font-medium hover:bg-stone-200 transition-colors text-center"
                  >
                    Back to Login
                  </Link>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;