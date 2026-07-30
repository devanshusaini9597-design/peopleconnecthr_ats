import React, { useState } from 'react';
import { 
  Mail, Calendar, MessageSquare, Bot, Briefcase, 
  Settings, CheckCircle2, AlertCircle, Loader2, Link2, Unlink
} from 'lucide-react';
import API_URL from '../config';

const integrations = {
  email: [
    { id: 'smtp', name: 'Custom SMTP', desc: 'Connect your own email server', icon: Mail, connected: true, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'zeptomail', name: 'Zoho ZeptoMail', desc: 'High deliverability transactional email', icon: Mail, connected: false, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { id: 'sendgrid', name: 'SendGrid', desc: 'Cloud-based email delivery', icon: Mail, connected: false, color: 'text-cyan-500', bg: 'bg-cyan-50' }
  ],
  calendar: [
    { id: 'gcal', name: 'Google Calendar', desc: 'Sync interviews with Google Calendar', icon: Calendar, connected: false, color: 'text-red-500', bg: 'bg-red-50' },
    { id: 'outlook', name: 'Outlook Calendar', desc: 'Sync interviews with Microsoft Outlook', icon: Calendar, connected: false, color: 'text-blue-600', bg: 'bg-blue-50' }
  ],
  coming_soon: [
    { id: 'twilio', name: 'Twilio SMS', desc: 'Send candidate updates via SMS/WhatsApp', icon: MessageSquare },
    { id: 'openai', name: 'AI Assistant', desc: 'Auto-generate job descriptions and summaries', icon: Bot },
    { id: 'linkedin', name: 'LinkedIn', desc: 'Post jobs directly to LinkedIn', icon: Briefcase }
  ]
};

export default function IntegrationSettingsPage() {
  const [activeConfig, setActiveConfig] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTest = () => {
    setTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setTesting(false);
      setTestResult('success');
    }, 1500);
  };

  const renderCard = (integration, category) => {
    const isComingSoon = category === 'coming_soon';
    const Icon = integration.icon;

    return (
      <div 
        key={integration.id} 
        className={`bg-white rounded-xl border ${isComingSoon ? 'border-gray-100 opacity-60' : 'border-gray-200 hover:shadow-md'} transition-all overflow-hidden flex flex-col`}
      >
        <div className="p-5 flex-1">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-lg ${integration.bg || 'bg-gray-100'} ${integration.color || 'text-gray-500'}`}>
              <Icon className="w-6 h-6" />
            </div>
            {!isComingSoon && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                integration.connected 
                  ? 'bg-green-50 text-green-700 border-green-100' 
                  : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${integration.connected ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                {integration.connected ? 'Connected' : 'Not Configured'}
              </span>
            )}
            {isComingSoon && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                Coming Soon
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-gray-900">{integration.name}</h3>
          <p className="text-sm text-gray-500 mt-1">{integration.desc}</p>
        </div>

        {!isComingSoon && (
          <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 mt-auto flex justify-end">
            <button
              onClick={() => setActiveConfig(activeConfig === integration.id ? null : integration.id)}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Configure
            </button>
          </div>
        )}

        {/* Expandable Config Area */}
        {activeConfig === integration.id && !isComingSoon && (
          <div className="border-t border-gray-100 bg-gray-50 p-5 animate-in slide-in-from-top-2">
            {integration.id === 'smtp' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Host</label>
                    <input type="text" defaultValue="smtp.example.com" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Port</label>
                    <input type="text" defaultValue="587" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Username / Email</label>
                  <input type="text" defaultValue="alerts@company.com" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                  <input type="password" defaultValue="••••••••••••" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
            )}
            
            {integration.id.includes('cal') && (
              <div className="text-center py-4">
                <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 shadow-sm flex items-center gap-2 mx-auto">
                  <Link2 className="w-4 h-4" /> Authenticate via OAuth
                </button>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between pt-4 border-t border-gray-200">
              <button className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1">
                <Unlink className="w-3.5 h-3.5" /> Disconnect
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={handleTest}
                  disabled={testing}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test'}
                </button>
                <button className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
                  Save
                </button>
              </div>
            </div>
            
            {testResult === 'success' && (
              <div className="mt-3 text-xs text-green-600 flex items-center gap-1.5 bg-green-50 p-2 rounded">
                <CheckCircle2 className="w-4 h-4" /> Connection successful!
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Integrations</h1>
          <p className="text-gray-500 mt-1 text-sm">Connect your ATS with external tools and services.</p>
        </div>

        <section>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Email Providers</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {integrations.email.map(i => renderCard(i, 'email'))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Calendars & Scheduling</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {integrations.calendar.map(i => renderCard(i, 'calendar'))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Coming Soon</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {integrations.coming_soon.map(i => renderCard(i, 'coming_soon'))}
          </div>
        </section>
      </div>
    </div>
  );
}
