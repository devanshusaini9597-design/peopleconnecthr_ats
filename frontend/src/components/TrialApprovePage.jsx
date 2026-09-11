import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import API_URL from '../config';

function tokenFromLocation() {
  const hash = String(window.location.hash || '').replace(/^#/, '').trim();
  if (hash) return decodeURIComponent(hash);
  const query = new URLSearchParams(window.location.search).get('token');
  return (query || '').trim();
}

export default function TrialApprovePage() {
  const navigate = useNavigate();
  const [state, setState] = useState('working');
  const [message, setMessage] = useState('Approving this trial…');

  useEffect(() => {
    const token = tokenFromLocation();
    if (window.location.search.includes('token=')) {
      window.history.replaceState(null, '', '/trial-approve');
    }
    if (token && window.location.hash) {
      window.history.replaceState(null, '', '/trial-approve');
    }

    if (!token) {
      setState('error');
      setMessage('This approval link is missing its token.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/onboarding/trial-requests/approve-with-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Approval failed');
        if (cancelled) return;
        setState('ok');
        setMessage('Trial access is approved. The buyer can sign in now.');
        setTimeout(() => navigate('/login?activated=1', { replace: true }), 1200);
      } catch (err) {
        if (cancelled) return;
        setState('error');
        setMessage(err.message || 'This approval link is invalid or has expired.');
      }
    })();

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-dvh bg-stone-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm text-center">
        {state === 'working' && <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-600" />}
        {state === 'ok' && <CheckCircle className="mx-auto h-8 w-8 text-teal-600" />}
        {state === 'error' && <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />}
        <h1 className="mt-4 text-lg font-semibold text-stone-900">Trial approval</h1>
        <p className="mt-2 text-sm text-stone-600">{message}</p>
        {state === 'error' && (
          <Link to="/login" className="mt-6 inline-block text-sm font-medium text-teal-700 hover:underline">
            Back to sign in
          </Link>
        )}
      </div>
    </div>
  );
}
