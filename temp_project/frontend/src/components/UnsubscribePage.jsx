import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft } from 'lucide-react';
import BASE_API_URL from '../config';

const UnsubscribePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const e = searchParams.get('email');
    if (e && e.includes('@')) setEmail(e.trim());
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const emailTrim = (email || '').trim().toLowerCase();
    if (!emailTrim || !emailTrim.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_API_URL}/api/public/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTrim }),
      });
      const data = await res.json();
      if (data.success) {
        navigate('/unsubscribe/thank-you', { replace: true });
        return;
      }
      setError(data.message || 'Unsubscribe failed. Please try again.');
    } catch {
      setError('Unable to connect. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-8">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <Mail className="w-7 h-7 text-gray-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Unsubscribe from updates</h1>
            <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto mb-6">
              Enter your email address to be removed from our mailing list. You will no longer receive marketing emails from us.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 border border-red-200">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3 bg-gray-800 text-white rounded-lg font-semibold text-sm hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Unsubscribing...</> : 'Unsubscribe'}
              </button>
            </form>
            <p className="text-gray-500 text-xs mt-4 text-center">
              Changed your mind? <a href="/subscribe" className="text-indigo-600 hover:text-indigo-800 font-medium">Subscribe again</a>
            </p>
          </div>
          <div className="px-6 pb-8 pt-2 border-t border-gray-100 text-center">
            <a href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 font-medium text-sm">
              <ArrowLeft className="w-4 h-4" /> Back to home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnsubscribePage;
