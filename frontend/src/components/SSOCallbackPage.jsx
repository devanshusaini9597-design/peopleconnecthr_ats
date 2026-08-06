import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { BASE_API_URL } from '../utils/fetchUtils';

/**
 * Lands here after a successful SAML ACS validation on the backend, which
 * redirects the browser to /sso/callback?code=<one-time-code>. We exchange
 * that code for the real session (never put the JWT itself in the URL).
 */
const SSOCallbackPage = () => {
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (!code) {
        setError('Missing SSO code.');
        return;
      }
      try {
        const res = await fetch(`${BASE_API_URL}/api/sso/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.message || 'SSO sign-in failed.');
          return;
        }

        localStorage.removeItem('token');
        localStorage.setItem('userEmail', data.user?.email || '');
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

        window.location.href = '/dashboard';
      } catch (err) {
        setError('Could not complete SSO sign-in. Please try again.');
      }
    };
    run();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {error ? (
          <>
            <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">{error}</p>
            <a href="/login" className="text-blue-600 text-sm underline mt-2 inline-block">Back to login</a>
          </>
        ) : (
          <>
            <div className="relative w-10 h-10 mx-auto mb-3">
              <ShieldCheck className="w-10 h-10 text-blue-600 absolute" />
              <Loader2 className="w-10 h-10 text-blue-200 animate-spin absolute" />
            </div>
            <p className="text-gray-500 text-sm">Completing single sign-on…</p>
          </>
        )}
      </div>
    </div>
  );
};

export default SSOCallbackPage;
