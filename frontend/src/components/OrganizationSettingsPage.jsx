import React, { useState, useEffect } from 'react';
import { 
  Building2, Globe, MapPin, DollarSign, Calendar, 
  Settings, Users, Briefcase, Plus, X, Upload, Save, CheckCircle2,
  Trash2, Mail, UserPlus, GripVertical, Link as LinkIcon, Loader2
} from 'lucide-react';
import API_URL from '../config';
import PageHeader from './ui/PageHeader';

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-4 right-4 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white font-medium z-50 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
      {message}
    </div>
  );
};

export default function OrganizationSettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [org, setOrg] = useState({
    name: '',
    domain: '',
    timezone: 'UTC',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    atsSettings: {
      pipelineStages: ['Sourced', 'Applied', 'Phone Screen', 'Interview', 'Offer', 'Hired'],
      defaultSources: ['LinkedIn', 'Indeed', 'Company Website', 'Referral'],
      careersPageEnabled: false,
      careersPageTitle: 'Join Our Team',
      careersPageDescription: '',
      candidatePortalEnabled: false
    }
  });
  
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('recruiter');

  useEffect(() => {
    fetchOrgData();
    if (activeTab === 'team') {
      fetchMembers();
    }
  }, [activeTab]);

  const fetchOrgData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/organization`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrg(prev => ({
          ...prev,
          ...data,
          atsSettings: { ...prev.atsSettings, ...data.atsSettings }
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/organization/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/organization`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(org)
      });
      if (!res.ok) throw new Error('Failed to save settings');
      setToast({ type: 'success', message: 'Settings saved successfully' });
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/onboarding/invite`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      if (!res.ok) throw new Error('Failed to send invite');
      setToast({ type: 'success', message: `Invitation sent to ${inviteEmail}` });
      setInviteEmail('');
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  if (loading) {
    return (
      <div className="page-shell-ats">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-ats max-w-6xl">
        <PageHeader
          icon={Building2}
          title="Organization Settings"
          subtitle="Manage your company preferences, team, and careers page."
        />

        <div className="card-ats-bordered overflow-hidden">
          <div className="flex border-b border-stone-200 bg-stone-50/50 overflow-x-auto hide-scrollbar">
            {[
              { id: 'general', icon: Settings, label: 'General' },
              { id: 'pipeline', icon: GripVertical, label: 'Pipeline' },
              { id: 'team', icon: Users, label: 'Team' },
              { id: 'careers', icon: Briefcase, label: 'Careers Page' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap
                  ${activeTab === tab.id 
                    ? 'text-brand-700 border-b-2 border-brand-500 bg-white' 
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6 md:p-8">
            {activeTab === 'general' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Company Name</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input
                          type="text"
                          value={org.name}
                          onChange={e => setOrg({...org, name: e.target.value})}
                          className="input-ats pl-9"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Company Domain</label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input
                          type="text"
                          value={org.domain}
                          onChange={e => setOrg({...org, domain: e.target.value})}
                          className="input-ats pl-9"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">Company Logo</label>
                      <div className="border-2 border-dashed border-stone-200 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-stone-50 transition-colors cursor-pointer group">
                        <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                          <Upload className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-medium text-stone-700">Click to upload or drag & drop</p>
                        <p className="text-xs text-stone-500 mt-1">SVG, PNG, JPG or GIF (max. 2MB)</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-stone-100 grid md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Timezone</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <select 
                        value={org.timezone}
                        onChange={e => setOrg({...org, timezone: e.target.value})}
                        className="input-ats pl-9 appearance-none"
                      >
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">America/New_York</option>
                        <option value="Europe/London">Europe/London</option>
                        <option value="Asia/Kolkata">Asia/Kolkata</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Currency</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <select 
                        value={org.currency}
                        onChange={e => setOrg({...org, currency: e.target.value})}
                        className="input-ats pl-9 appearance-none"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="INR">INR (₹)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Date Format</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <select 
                        value={org.dateFormat}
                        onChange={e => setOrg({...org, dateFormat: e.target.value})}
                        className="input-ats pl-9 appearance-none"
                      >
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="btn-primary"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'pipeline' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h3 className="text-lg font-medium text-stone-900 mb-1">Pipeline Stages</h3>
                  <p className="text-sm text-stone-500 mb-4">Define the stages candidates move through in your hiring process.</p>
                  
                  <div className="bg-stone-50 rounded-xl p-2 space-y-2 border border-stone-100 max-w-2xl">
                    {org.atsSettings.pipelineStages.map((stage, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-stone-200 shadow-sm group">
                        <GripVertical className="w-4 h-4 text-stone-400 cursor-grab" />
                        <span className="flex-1 text-sm font-medium text-stone-700">{stage}</span>
                        <button className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 p-2 mt-2">
                      <input 
                        type="text" 
                        placeholder="New stage name..." 
                        className="flex-1 input-ats"
                      />
                      <button className="btn-primary">
                        <Plus className="w-4 h-4" /> Add
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-stone-100">
                  <h3 className="text-lg font-medium text-stone-900 mb-1">Default Sources</h3>
                  <p className="text-sm text-stone-500 mb-4">Common sources where your candidates come from.</p>
                  <div className="flex flex-wrap gap-2 max-w-2xl">
                    {org.atsSettings.defaultSources.map((source, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 text-sm font-medium rounded-full border border-brand-100">
                        {source}
                        <button className="hover:text-brand-900 focus:outline-none"><X className="w-3.5 h-3.5" /></button>
                      </span>
                    ))}
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-stone-300 text-stone-600 text-sm font-medium rounded-full hover:bg-stone-50 hover:border-stone-400 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add Source
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-stone-100">
                  <button 
                    onClick={handleSave} 
                    className="btn-primary"
                  >
                    <Save className="w-4 h-4" /> Save Changes
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'team' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-brand-50 border border-brand-100 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-brand-900 mb-3 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" /> Invite New Member
                  </h3>
                  <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input 
                        type="email" 
                        required
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com" 
                        className="input-ats pl-9"
                      />
                    </div>
                    <select 
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value)}
                      className="sm:w-48 input-ats"
                    >
                      <option value="admin">Admin</option>
                      <option value="recruiter">Recruiter</option>
                      <option value="interviewer">Interviewer</option>
                      <option value="readonly">Read Only</option>
                    </select>
                    <button type="submit" className="btn-primary whitespace-nowrap">
                      Send Invite
                    </button>
                  </form>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-stone-900 mb-4">Team Members</h3>
                  <div className="border border-stone-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-medium">
                        <tr>
                          <th className="px-4 py-3">Member</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {members.length > 0 ? members.map(m => (
                          <tr key={m._id} className="hover:bg-stone-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                                  {m.name ? m.name.charAt(0) : m.email.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-medium text-stone-900">{m.name || 'Pending User'}</div>
                                  <div className="text-stone-500 text-xs">{m.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-stone-600 capitalize">{m.role}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                Active
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button className="text-stone-400 hover:text-red-600 p-1 rounded transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="4" className="px-4 py-8 text-center text-stone-500 text-sm">
                              No team members found. (Placeholder data)
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'careers' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-gradient-to-r from-brand-50 to-teal-50 border border-brand-100 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                      Public Careers Page
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${org.atsSettings.careersPageEnabled ? 'bg-green-500' : 'bg-stone-400'}`}></span>
                    </h3>
                    <p className="text-sm text-stone-600 mt-1 max-w-xl">Host a beautiful, branded job board to attract top talent directly from your website.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={org.atsSettings.careersPageEnabled}
                      onChange={e => setOrg({...org, atsSettings: {...org.atsSettings, careersPageEnabled: e.target.checked}})}
                    />
                    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                  </label>
                </div>

                <div className={`space-y-6 transition-opacity duration-300 ${!org.atsSettings.careersPageEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Page Title</label>
                    <input
                      type="text"
                      value={org.atsSettings.careersPageTitle}
                      onChange={e => setOrg({...org, atsSettings: {...org.atsSettings, careersPageTitle: e.target.value}})}
                      className="input-ats"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Welcome Message / Description</label>
                    <textarea
                      rows="4"
                      value={org.atsSettings.careersPageDescription}
                      onChange={e => setOrg({...org, atsSettings: {...org.atsSettings, careersPageDescription: e.target.value}})}
                      className="input-ats resize-none"
                      placeholder="Tell candidates why they should join your team..."
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg border border-stone-200">
                    <div className="flex items-center gap-3">
                      <LinkIcon className="w-5 h-5 text-stone-400" />
                      <div>
                        <div className="text-sm font-medium text-stone-900">Your Public URL</div>
                        <div className="text-xs text-brand-600 hover:underline cursor-pointer">
                          https://skillnix.com/careers/{org.domain || 'your-company'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-stone-100">
                  <button 
                    onClick={handleSave} 
                    className="btn-primary"
                  >
                    <Save className="w-4 h-4" /> Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
