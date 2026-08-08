import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Loader2, ArrowRight } from 'lucide-react';
import BASE_API_URL from '../config';

const SubscribePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const prefill = searchParams.get('email');
    if (prefill && prefill.includes('@')) setEmail(prefill.trim());
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trim = (s) => (s || '').trim();
    const eTrim = trim(email).toLowerCase();
    if (!eTrim || !eTrim.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_API_URL}/api/public/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: eTrim,
          firstName: trim(firstName),
          lastName: trim(lastName),
        }),
      });
      const data = await res.json();
      if (data.success) {
        navigate('/subscribe/thank-you', { replace: true });
        return;
      }
      setError(data.message || 'Subscription failed. Please try again.');
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
          <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 px-6 py-8 text-center">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Subscribe for Updates</h1>
            <p className="text-white/90 text-sm mt-1">Skillnix Recruitment Services</p>
            <p className="text-white/70 text-xs mt-2 max-w-xs mx-auto">Job alerts, hiring drives & career insights delivered to your inbox.</p>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 border border-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email address <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">First name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Subscribing...</> : <>Subscribe <ArrowRight className="w-4 h-4" /></>}
              </button>

              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                By subscribing you agree to receive marketing emails. You can unsubscribe at any time from the link in our emails.
              </p>
            </form>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          <a href="/" className="hover:text-indigo-600">Back to home</a>
        </p>
      </div>
    </div>
  );
};

export default SubscribePage;
