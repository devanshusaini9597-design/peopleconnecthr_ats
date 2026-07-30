import React from 'react';
import { 
  CreditCard, Check, Zap, Users, Briefcase, Mail, Download, 
  ArrowRight, ShieldCheck
} from 'lucide-react';

const MetricRing = ({ label, current, max, color, icon: Icon }) => {
  const percentage = Math.min((current / max) * 100, 100);
  const strokeColor = percentage > 85 ? 'text-red-500' : percentage > 60 ? 'text-amber-500' : color;
  
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 flex items-center justify-between shadow-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
          <Icon className="w-4 h-4" />
          {label}
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {current.toLocaleString()} <span className="text-sm font-normal text-gray-400">/ {max.toLocaleString()}</span>
        </div>
      </div>
      <div className="relative w-16 h-16">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <path className="text-gray-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path className={`${strokeColor} transition-all duration-1000 ease-out`} strokeWidth="3" strokeDasharray={`${percentage}, 100`} stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
      </div>
    </div>
  );
};

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-gray-50/50 p-6 pb-20">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Billing & Plans</h1>
            <p className="text-gray-500 mt-1 text-sm">Manage your subscription and monitor usage.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200 font-medium">
            <ShieldCheck className="w-4 h-4" /> Secure Payment via Stripe
          </div>
        </div>

        {/* Current Plan Alert */}
        <div className="bg-gradient-to-r from-gray-900 to-slate-800 rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider">
                  Current Plan
                </span>
                <span className="text-yellow-400 text-sm font-medium flex items-center gap-1">
                  12 Days left in Trial
                </span>
              </div>
              <h2 className="text-3xl font-bold mb-1">Starter Tier</h2>
              <p className="text-gray-400 text-sm">Perfect for small teams starting to scale their hiring.</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <div className="text-2xl font-bold">$49 <span className="text-sm font-normal text-gray-400">/mo</span></div>
                <div className="text-xs text-gray-400">Billed annually</div>
              </div>
              <button className="px-6 py-3 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Manage Subscription
              </button>
            </div>
          </div>
        </div>

        {/* Usage Stats */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Current Usage (This billing cycle)</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricRing label="Active Jobs" current={3} max={5} color="text-blue-500" icon={Briefcase} />
            <MetricRing label="Team Members" current={4} max={5} color="text-indigo-500" icon={Users} />
            <MetricRing label="Candidates" current={450} max={1000} color="text-emerald-500" icon={Users} />
            <MetricRing label="Emails Sent" current={1850} max={2000} color="text-amber-500" icon={Mail} />
          </div>
        </div>

        {/* Plans */}
        <div className="pt-8">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">Ready to grow? Upgrade your plan.</h3>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-white border-2 border-blue-500 rounded-2xl p-6 shadow-md relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                Current Plan
              </div>
              <h4 className="text-lg font-bold text-gray-900">Starter</h4>
              <div className="mt-2 text-3xl font-bold text-gray-900">$49<span className="text-lg font-normal text-gray-500">/mo</span></div>
              <p className="text-sm text-gray-500 mt-2">Essential features for small teams.</p>
              
              <ul className="mt-6 space-y-3 mb-8">
                {['Up to 5 active jobs', '5 team members', '1,000 candidates/mo', 'Basic reporting', 'Email support'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 shrink-0" /> {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap className="w-24 h-24 text-indigo-500" />
              </div>
              <h4 className="text-lg font-bold text-gray-900">Professional</h4>
              <div className="mt-2 text-3xl font-bold text-gray-900">$149<span className="text-lg font-normal text-gray-500">/mo</span></div>
              <p className="text-sm text-gray-500 mt-2">Advanced tools for growing companies.</p>
              
              <ul className="mt-6 space-y-3 mb-8 relative z-10">
                {['Unlimited active jobs', '25 team members', 'Unlimited candidates', 'Custom pipelines', 'Advanced analytics', 'Priority support'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 shrink-0" /> {feature}
                  </li>
                ))}
              </ul>
              <button className="w-full py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
                Upgrade to Pro <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Enterprise */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
              <h4 className="text-lg font-bold text-gray-900">Enterprise</h4>
              <div className="mt-2 text-3xl font-bold text-gray-900">Custom</div>
              <p className="text-sm text-gray-500 mt-2">Bespoke solutions for large organizations.</p>
              
              <ul className="mt-6 space-y-3 mb-8">
                {['Unlimited everything', 'Custom integrations', 'Dedicated account manager', 'SAML SSO', 'Custom contracts', '24/7 phone support'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 shrink-0" /> {feature}
                  </li>
                ))}
              </ul>
              <button className="w-full py-2.5 bg-white border-2 border-gray-200 text-gray-900 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                Contact Sales
              </button>
            </div>
          </div>
        </div>

        {/* Invoice History */}
        <div className="pt-8">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Billing History</h3>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden text-sm">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <CreditCard className="w-8 h-8 text-gray-300 mb-2" />
                      <p>No billing history yet.</p>
                      <p className="text-xs text-gray-400 mt-1">Invoices will appear here once you upgrade to a paid plan.</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
