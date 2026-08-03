import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle, XCircle, Clock, Loader2 } from 'lucide-react';
import API_URL from '../config';
import EmptyState from './ui/EmptyState';

const PublicFooter = () => (
  <footer className="border-t border-stone-200 bg-white py-6 mt-auto">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
      <Link to="/" className="text-sm text-stone-500 hover:text-brand-700 font-medium transition-colors">
        ← Back to SkillNix
      </Link>
    </div>
  </footer>
);

const STATUS_ICON = {
  operational: CheckCircle,
  degraded: AlertTriangle,
  major_outage: XCircle
};

const STATUS_COLOR = {
  operational: 'text-emerald-600',
  degraded: 'text-amber-600',
  major_outage: 'text-red-600'
};

const STATUS_BG = {
  operational: 'bg-emerald-50 border-emerald-200/70',
  degraded: 'bg-amber-50 border-amber-200/70',
  major_outage: 'bg-red-50 border-red-200/70'
};

const INCIDENT_STATUS = {
  investigating: 'Investigating',
  identified: 'Identified',
  monitoring: 'Monitoring',
  resolved: 'Resolved'
};

export default function StatusPage() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/status`).then((r) => r.json()),
      fetch(`${API_URL}/api/status/history`).then((r) => r.json())
    ]).then(([current, hist]) => {
      if (current.success) setData(current.data);
      if (hist.success) setHistory(hist.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const overall = data?.overall || { status: 'operational', label: 'All systems operational' };
  const Icon = STATUS_ICON[overall.status] || CheckCircle;

  return (
    <div className="min-h-screen bg-stone-50 overflow-x-hidden flex flex-col">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 text-stone-900 font-semibold min-w-0">
            <img src="/atslogo.jpg" alt="SkillNix" className="w-8 h-8 rounded-lg flex-shrink-0" />
            <span className="truncate text-sm sm:text-base">SkillNix Status</span>
          </Link>
          <Link to="/trust" className="text-sm text-brand-700 hover:text-brand-800 font-medium whitespace-nowrap flex-shrink-0">
            Trust Center →
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-10 animate-page-enter flex-1 w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            <p className="text-sm text-stone-500 font-medium">Loading status…</p>
          </div>
        ) : (
          <>
            <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border flex items-center justify-center flex-shrink-0 ${STATUS_BG[overall.status] || STATUS_BG.operational}`}>
                  <Icon className={`w-6 h-6 sm:w-7 sm:h-7 ${STATUS_COLOR[overall.status] || STATUS_COLOR.operational}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">{overall.label}</p>
                  <p className="text-sm text-stone-500 mt-0.5">
                    Last checked {new Date().toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {data?.activeIncidents?.length > 0 && (
              <section>
                <h2 className="section-title-ats">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Active incidents
                </h2>
                <div className="space-y-4">
                  {data.activeIncidents.map((inc) => (
                    <div key={inc._id} className="card-ats-bordered p-5 relative overflow-hidden">
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <h3 className="font-semibold text-stone-900">{inc.title}</h3>
                        <span className="badge-warning self-start">
                          {INCIDENT_STATUS[inc.status] || inc.status}
                        </span>
                      </div>
                      {inc.description && (
                        <p className="text-sm text-stone-600 mt-2 leading-relaxed">{inc.description}</p>
                      )}
                      {(inc.updates || []).slice(-3).map((u, i) => (
                        <div key={i} className="mt-3 pt-3 border-t border-stone-100 text-sm text-stone-600 flex gap-2">
                          <Clock className="w-4 h-4 shrink-0 mt-0.5 text-brand-600" />
                          <div>
                            <span className="text-stone-400 text-xs">
                              {new Date(u.createdAt).toLocaleString()} —{' '}
                            </span>
                            {u.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="section-title-ats">
                <Clock className="w-4 h-4 text-brand-600" />
                Incident history (90 days)
              </h2>
              {history.length === 0 ? (
                <div className="card-ats-bordered relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                  <EmptyState
                    icon={CheckCircle}
                    message="No incidents in the last 90 days"
                    subMessage="All systems have been running smoothly."
                    tone="emerald"
                    compact
                  />
                </div>
              ) : (
                <ul className="space-y-3">
                  {history.map((inc) => (
                    <li
                      key={inc._id}
                      className="card-ats-bordered p-4 sm:p-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-900">{inc.title}</p>
                        <p className="text-xs text-stone-500 mt-1">
                          {new Date(inc.startedAt).toLocaleDateString()} — resolved{' '}
                          {inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      <span className="badge-success self-start sm:self-auto">Resolved</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
