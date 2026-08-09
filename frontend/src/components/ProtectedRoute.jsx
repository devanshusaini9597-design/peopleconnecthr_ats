import React, { useState } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLoadingScreen from './ui/AppLoadingScreen';
import API_URL from '../config';

export default function ProtectedRoute({ children, requiredRoles }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  if (isLoading) {
    return (
      <AppLoadingScreen
        message="Signing you in"
        subMessage="Verifying your session and loading entitlements…"
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user && user.isEmailVerified === false) {
    const handleResend = async () => {
      if (!user.email) return;
      setResendLoading(true);
      setResendMessage('');
      try {
        const res = await fetch(`${API_URL}/api/onboarding/resend-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
        });
        const data = await res.json().catch(() => ({}));
        setResendMessage(
          res.ok
            ? (data.message || 'Verification email sent successfully.')
            : (data.message || 'Failed to resend. Please try again.')
        );
      } catch {
        setResendMessage('Network error. Please try again.');
      } finally {
        setResendLoading(false);
      }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-stone-50">
        <h2 className="text-2xl font-bold mb-4 text-stone-900">Verify Your Email</h2>
        <p className="mb-2 text-stone-600 max-w-md">
          Please check your inbox for a verification link before continuing.
        </p>
        {user.email && (
          <p className="mb-6 text-sm text-stone-500">
            Sent to <span className="font-semibold text-stone-800">{user.email}</span>
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading}
            className="bg-stone-200 text-stone-800 px-4 py-2 rounded shadow hover:bg-stone-300 disabled:opacity-60"
          >
            {resendLoading ? 'Sending…' : "Didn't get it? Resend"}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700"
          >
            I&apos;ve verified my email
          </button>
        </div>
        {resendMessage && (
          <p className="mt-4 text-sm text-brand-700 max-w-md">{resendMessage}</p>
        )}
        <Link to="/login" className="mt-6 text-sm text-stone-500 hover:text-stone-800 underline">
          Back to login
        </Link>
      </div>
    );
  }

  if (user && user.onboardingCompleted === false && !location.pathname.startsWith('/onboarding')) {
    return <Navigate to="/onboarding" replace />;
  }

  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
        <h2 className="text-2xl font-bold mb-4 text-red-600">Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return children;
}
