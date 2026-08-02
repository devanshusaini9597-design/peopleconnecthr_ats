import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, ChevronDown, ChevronUp, Clock, AlertCircle, Briefcase, Building, LogOut, ArrowRight, FileText, Download, ShieldAlert, X, Globe } from 'lucide-react';
import API_URL from '../config';
import { getPortalLocale, setPortalLocale, t, PORTAL_LOCALES } from '../utils/portalI18n';

/**
 * GDPR self-service widget (Art. 15/17/20) — always available, no plan gate.
 * Lets the candidate download everything the org holds on them, or
 * permanently anonymize their own record.
 */
const PrivacyPanel = ({ token, onErased }) => {
  const [eraseOpen, setEraseOpen] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [error, setError] = useState('');

  const handleExport = () => {
    window.open(`${API_URL}/api/portal/gdpr/export?token=${token}`, '_blank');
  };

  const handleErase = async () => {
    setErasing(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/portal/gdpr/erase?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to erase data');
      setEraseOpen(false);
      onErased?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setErasing(false);
    }
  };

  return (
    <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <ShieldAlert className="h-5 w-5 text-indigo-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Your data & privacy</h3>
          <p className="text-sm text-gray-500 mt-1">
            You can download everything we hold about you, or permanently erase your personal information.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <Download className="h-4 w-4" /> Download my data
            </button>
            <button
              onClick={() => setEraseOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
            >
              Erase my data
            </button>
          </div>
        </div>
      </div>

      {eraseOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !erasing && setEraseOpen(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Erase my data?</h3>
              <button onClick={() => setEraseOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-gray-600">
              This permanently removes your name, email, phone, resume, and any self-reported demographics from every application
              on file with this company. <strong>This cannot be undone.</strong>
            </p>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md mt-3 flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 shrink-0" /> {error}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEraseOpen(false)}
                disabled={erasing}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleErase}
                disabled={erasing}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-70"
              >
                {erasing ? 'Erasing…' : 'Yes, erase permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ApplicationCard = ({ app }) => {
  const [expanded, setExpanded] = useState(false);
  
  // Dummy visual pipeline phases for demo
  const phases = ['Applied', 'Screening', 'Interview', 'Offer'];
  const currentPhaseIndex = Math.min(Math.floor(Math.random() * 4), 3); // Replace with actual logic based on app.status

  const getStatusColor = (status) => {
    switch((status || '').toLowerCase()) {
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'hired': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-4 transition-all duration-300">
      <div 
        className="p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 mb-4 sm:mb-0">
          <div className="flex items-center justify-between sm:justify-start gap-4 mb-2">
            <h3 className="text-lg font-bold text-gray-900">{app.jobTitle || 'Unknown Role'}</h3>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(app.status)}`}>
              {app.status || 'Active'}
            </span>
          </div>
          <div className="flex items-center text-sm text-gray-500 space-x-4">
            <span className="flex items-center"><Building className="h-4 w-4 mr-1" /> {app.companyName || 'Company'}</span>
            <span className="flex items-center"><Clock className="h-4 w-4 mr-1" /> Applied {new Date(app.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between sm:justify-end sm:w-1/3">
          <div className="text-right text-sm text-gray-500 mr-4 hidden sm:block">
            Last update: {new Date(app.updatedAt).toLocaleDateString()}
          </div>
          <button className="text-gray-400 hover:text-gray-600 focus:outline-none p-2 rounded-full hover:bg-gray-100 transition-colors">
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-gray-100 bg-gray-50 animate-in slide-in-from-top-2">
          {/* Visual Pipeline */}
          <div className="my-6">
            <div className="relative">
              <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2 z-0 rounded-full"></div>
              <div 
                className="absolute top-1/2 left-0 h-1 bg-indigo-500 -translate-y-1/2 z-0 rounded-full transition-all duration-500"
                style={{ width: `${(currentPhaseIndex / (phases.length - 1)) * 100}%` }}
              ></div>
              <div className="relative z-10 flex justify-between">
                {phases.map((phase, idx) => (
                  <div key={phase} className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                      idx <= currentPhaseIndex ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 text-gray-300'
                    }`}>
                      {idx < currentPhaseIndex ? <CheckCircle className="h-5 w-5" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                    </div>
                    <span className={`text-xs mt-2 font-medium ${idx <= currentPhaseIndex ? 'text-indigo-900' : 'text-gray-500'}`}>
                      {phase}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center"><FileText className="h-4 w-4 mr-2" /> Documents</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between text-indigo-600">
                  <span className="truncate pr-4">Resume.pdf</span>
                  <a href="#" className="hover:underline text-xs shrink-0">View</a>
                </li>
              </ul>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center">
                  + Upload additional document
                </button>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center"><Mail className="h-4 w-4 mr-2" /> Recent Messages</h4>
              {app.messages && app.messages.length > 0 ? (
                <div className="space-y-3">
                  {/* Messages mock */}
                  <p className="text-sm text-gray-600 italic">"We'd love to schedule a call for next week."</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No messages from the team yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CandidatePortal = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [locale, setLocale] = useState(() => getPortalLocale(searchParams));

  const handleLocaleChange = (code) => {
    setLocale(code);
    setPortalLocale(code);
    const next = new URLSearchParams(searchParams);
    next.set('locale', code);
    setSearchParams(next, { replace: true });
  };

  const [email, setEmail] = useState('');
  const [loginState, setLoginState] = useState('idle'); // idle, loading, sent, error
  const [loginError, setLoginError] = useState('');

  const [authData, setAuthData] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);

  useEffect(() => {
    if (token) {
      // Authenticate with token
      const verifyAndFetch = async () => {
        try {
          setLoadingApps(true);
          const res = await fetch(`${API_URL}/api/portal/status?token=${token}`);
          if (!res.ok) throw new Error('Invalid or expired magic link');
          const data = await res.json();
          setAuthData(data.candidate);
          setApplications(data.applications || []);
        } catch (err) {
          setLoginError(err.message);
          navigate('/portal', { replace: true });
        } finally {
          setLoadingApps(false);
        }
      };
      verifyAndFetch();
    }
  }, [token, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setLoginState('loading');
    setLoginError('');
    
    try {
      const res = await fetch(`${API_URL}/api/portal/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (!res.ok) throw new Error('Failed to send magic link. Please check your email and try again.');
      
      setLoginState('sent');
    } catch (err) {
      setLoginState('error');
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
    navigate('/portal', { replace: true });
    setAuthData(null);
    setApplications([]);
  };

  if (!token && !authData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="absolute top-4 right-4 flex items-center gap-2 text-sm text-gray-600">
          <Globe className="h-4 w-4" />
          <select
            value={locale}
            onChange={(e) => handleLocaleChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1 bg-white"
            aria-label={t(locale, 'language')}
          >
            {PORTAL_LOCALES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center h-12 w-12 bg-indigo-100 rounded-xl mx-auto items-center text-indigo-600">
            <Briefcase className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {t(locale, 'portalTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t(locale, 'loginTitle')}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-gray-100">
            {loginState === 'sent' ? (
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Check your email</h3>
                <p className="mt-2 text-sm text-gray-500">
                  We've sent a magic link to <span className="font-semibold">{email}</span>. Click it to log in securely.
                </p>
                <button onClick={() => setLoginState('idle')} className="mt-6 text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                  Use a different email
                </button>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleLogin}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    {t(locale, 'emailLabel')}
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                {loginError && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md flex items-start">
                    <AlertCircle className="h-5 w-5 mr-2 shrink-0" /> {loginError}
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={loginState === 'loading'}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 transition-colors"
                  >
                    {loginState === 'loading' ? 'Sending link...' : 'Send Magic Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 text-indigo-600 font-bold text-xl tracking-tight">
            <Briefcase className="h-6 w-6" />
            <span>SkillNix Portal</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-bold text-gray-900">{authData?.name || 'Candidate'}</span>
              <span className="text-xs text-gray-500">{authData?.email}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">Your Applications</h1>
          <p className="mt-2 text-gray-600">Track the status of your job applications across all SkillNix partner companies.</p>
        </div>

        {loadingApps ? (
          <div className="flex justify-center items-center py-20">
             <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : applications.length > 0 ? (
          <div className="space-y-4">
            {applications.map((app, index) => (
              <ApplicationCard key={app._id || index} app={app} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="mx-auto h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Briefcase className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No applications found</h3>
            <p className="text-gray-500 max-w-sm mx-auto">It looks like you haven't applied to any open roles yet using this email address.</p>
          </div>
        )}

        {token && <PrivacyPanel token={token} onErased={handleLogout} />}
      </main>
    </div>
  );
};

export default CandidatePortal;
