import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileText, Server, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react';
import API_URL from '../config';

const SUBPROCESSORS = [
  { name: 'Amazon Web Services (AWS)', purpose: 'Cloud infrastructure & data hosting', location: 'US / EU' },
  { name: 'MongoDB Atlas', purpose: 'Database hosting', location: 'US / EU' },
  { name: 'Stripe', purpose: 'Payment processing', location: 'US' },
  { name: 'SendGrid / ZeptoMail', purpose: 'Transactional email delivery (BYOK optional)', location: 'Global' },
  { name: 'Vercel / Render', purpose: 'Application hosting', location: 'Global' }
];

export default function TrustCenterPage() {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/status`).then((r) => r.json()).then((d) => {
      if (d.success) setStatus(d.data);
    }).catch(() => {});
    fetch(`${API_URL}/api/status/history`).then((r) => r.json()).then((d) => {
      if (d.success) setHistory(d.data || []);
    }).catch(() => {});
  }, []);

  const overall = status?.overall || { status: 'operational', label: 'All systems operational' };

  return (
    <div className="min-h-screen bg-stone-50 overflow-x-hidden">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 text-stone-900 font-semibold min-w-0">
            <img src="/atslogo.jpg" alt="SkillNix" className="w-8 h-8 rounded-lg flex-shrink-0" />
            <span className="truncate text-sm sm:text-base">SkillNix Trust Center</span>
          </Link>
          <Link
            to="/status"
            className="text-sm text-brand-700 hover:text-brand-800 font-medium whitespace-nowrap flex-shrink-0"
          >
            Status page →
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-10 animate-page-enter">
        <section>
          <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="icon-box-ats !w-11 !h-11 sm:!w-12 sm:!h-12">
              <Shield strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">Trust Center</h1>
          </div>
          <p className="text-stone-600 text-base sm:text-lg leading-relaxed max-w-2xl">
            Security, compliance, and transparency for teams evaluating SkillNix.
          </p>
        </section>

        <section className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <h2 className="section-title-ats !mb-0 !pb-0 !border-0">
            <Server className="w-4 h-4 text-brand-600" />
            System status
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2 mt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-stone-800">
              {overall.status === 'operational' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              )}
              <span>{overall.label}</span>
            </div>
            <Link
              to="/status"
              className="sm:ml-auto text-sm text-brand-700 hover:text-brand-800 font-medium"
            >
              View details →
            </Link>
          </div>
          {history.length > 0 && (
            <div className="mt-4 pt-4 border-t border-stone-100">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-3">Recent incidents</p>
              <ul className="space-y-2.5 text-sm text-stone-600">
                {history.slice(0, 3).map((inc) => (
                  <li key={inc._id} className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4">
                    <span className="font-medium text-stone-800">{inc.title}</span>
                    <span className="text-stone-400 text-xs sm:text-sm">
                      {inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleDateString() : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <h2 className="section-title-ats !mb-0 !pb-0 !border-0">
            <FileText className="w-4 h-4 text-brand-600" />
            Data Processing Agreement (DPA)
          </h2>
          <p className="text-stone-600 text-sm mt-4 mb-5 leading-relaxed">
            Our standard DPA covers GDPR, data processing terms, and subprocessors listed below.
            Enterprise customers may request a countersigned copy.
          </p>
          <a
            href="mailto:legal@skillnix.app?subject=DPA%20Request"
            className="btn-primary inline-flex w-full sm:w-auto"
          >
            Request DPA template <ExternalLink className="w-4 h-4" />
          </a>
        </section>

        <section className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <h2 className="section-title-ats !mb-0 !pb-0 !border-0">Security whitepaper</h2>
          <p className="text-stone-600 text-sm mt-4 mb-4 leading-relaxed">
            SkillNix implements tenant isolation, encrypted credentials at rest (AES-256-GCM),
            JWT session auth with RBAC, rate limiting, audit logging, and optional MFA, SSO/SCIM,
            and BYOK encryption for Enterprise plans.
          </p>
          <a
            href="mailto:security@skillnix.app?subject=Security%20Whitepaper"
            className="inline-flex items-center gap-2 text-brand-700 text-sm font-semibold hover:text-brand-800"
          >
            Request full security whitepaper <ExternalLink className="w-4 h-4" />
          </a>
        </section>

        <section className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <h2 className="section-title-ats !mb-0 !pb-0 !border-0">Subprocessors</h2>
          <div className="overflow-x-auto mt-4 -mx-1 px-1">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="pb-2.5 pr-4 font-semibold">Vendor</th>
                  <th className="pb-2.5 pr-4 font-semibold">Purpose</th>
                  <th className="pb-2.5 font-semibold">Location</th>
                </tr>
              </thead>
              <tbody>
                {SUBPROCESSORS.map((sp) => (
                  <tr key={sp.name} className="border-b border-stone-100 last:border-0">
                    <td className="py-3.5 pr-4 font-semibold text-stone-800">{sp.name}</td>
                    <td className="py-3.5 pr-4 text-stone-600">{sp.purpose}</td>
                    <td className="py-3.5 text-stone-500">{sp.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
