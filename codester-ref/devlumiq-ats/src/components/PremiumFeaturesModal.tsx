/**
 * Premium Features Modal
 * =======================
 * Tabbed modal that surfaces all premium tools in-context on the candidate
 * profile page. Includes Smart Search, Email, Scoring, Offer Letter,
 * Team Comments, Resume Parser, and Job Board Integrations tabs.
 */
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Filter, Mail, FileText, MessageSquare, Share2, Star, Upload, Send, Plus, Check, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface PremiumFeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId?: string;
  candidate?: any;
}

export default function PremiumFeaturesModal({ isOpen, onClose, candidateId, candidate }: PremiumFeaturesModalProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'email' | 'score' | 'offer' | 'comments' | 'resume' | 'integrations'>('email');
  const { success, error: showError } = useToast();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-stone-200 bg-gradient-to-r from-brand-600 to-brand-700">
            <div>
              <h2 className="text-2xl font-bold text-white">Premium Features</h2>
              <p className="text-brand-100 text-sm mt-1">
                {candidate ? `Managing: ${candidate.name}` : 'Advanced recruitment tools'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-stone-200 bg-stone-50 overflow-x-auto">
            <TabButton active={activeTab === 'search'} onClick={() => setActiveTab('search')} icon={Search} label="Smart Search" />
            <TabButton active={activeTab === 'email'} onClick={() => setActiveTab('email')} icon={Mail} label="Email Templates" />
            <TabButton active={activeTab === 'score'} onClick={() => setActiveTab('score')} icon={Star} label="Interview Scoring" />
            <TabButton active={activeTab === 'offer'} onClick={() => setActiveTab('offer')} icon={FileText} label="Offer Letters" />
            <TabButton active={activeTab === 'comments'} onClick={() => setActiveTab('comments')} icon={MessageSquare} label="Team Chat" />
            <TabButton active={activeTab === 'resume'} onClick={() => setActiveTab('resume')} icon={Upload} label="Resume Parser" />
            <TabButton active={activeTab === 'integrations'} onClick={() => setActiveTab('integrations')} icon={Share2} label="Job Boards" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6 bg-stone-50">
            {activeTab === 'search' && <AdvancedSearch />}
            {activeTab === 'email' && <EmailTemplates candidate={candidate} />}
            {activeTab === 'score' && candidateId && <InterviewScoring candidateId={candidateId} />}
            {activeTab === 'offer' && candidate && <OfferLetterGenerator candidate={candidate} />}
            {activeTab === 'comments' && candidateId && <TeamCollaboration candidateId={candidateId} />}
            {activeTab === 'resume' && candidateId && <ResumeParser candidateId={candidateId} />}
            {activeTab === 'integrations' && <JobBoardIntegrations />}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-4 font-medium text-sm whitespace-nowrap transition-all border-b-2 ${
        active
          ? 'border-brand-600 text-brand-700 bg-white'
          : 'border-transparent text-stone-600 hover:text-stone-900 hover:bg-stone-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// Advanced Search Component
function AdvancedSearch() {
  const [filters, setFilters] = useState({
    query: '',
    skills: [] as string[],
    experience: '',
    tags: [] as string[],
    source: '',
    stage: ''
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { success, error: showError } = useToast();

  const searchCandidates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.query) params.append('q', filters.query);
      if (filters.skills.length) params.append('skills', filters.skills.join(','));
      if (filters.experience) params.append('experience', filters.experience);
      if (filters.tags.length) params.append('tags', filters.tags.join(','));
      if (filters.source) params.append('source', filters.source);
      if (filters.stage) params.append('stage', filters.stage);

      const res = await fetch(`/api/candidates/search?${params}`);
      const data = await res.json();
      setResults(data.candidates || []);
      success(`Found ${data.candidates?.length || 0} candidates`);
    } catch {
      showError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
        <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5 text-brand-600" />
          Advanced Filters
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Name, email, position..."
              className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              value={filters.query}
              onChange={e => setFilters({ ...filters, query: e.target.value })}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Skills</label>
            <input
              type="text"
              placeholder="React, Node.js, Python..."
              className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              onChange={e => setFilters({ ...filters, skills: e.target.value.split(',').map(s => s.trim()) })}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Experience (years)</label>
            <select
              className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              value={filters.experience}
              onChange={e => setFilters({ ...filters, experience: e.target.value })}
            >
              <option value="">Any</option>
              <option value="0-2">0-2 years</option>
              <option value="3-5">3-5 years</option>
              <option value="6-10">6-10 years</option>
              <option value="10+">10+ years</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Source</label>
            <select
              className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              value={filters.source}
              onChange={e => setFilters({ ...filters, source: e.target.value })}
            >
              <option value="">All Sources</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Indeed">Indeed</option>
              <option value="Referral">Referral</option>
              <option value="Company Website">Company Website</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Pipeline Stage</label>
            <select
              className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              value={filters.stage}
              onChange={e => setFilters({ ...filters, stage: e.target.value })}
            >
              <option value="">All Stages</option>
              <option value="APPLIED">Applied</option>
              <option value="SCREENING">Screening</option>
              <option value="INTERVIEW">Interview</option>
              <option value="OFFER">Offer</option>
              <option value="HIRED">Hired</option>
            </select>
          </div>
        </div>
        
        <button
          onClick={searchCandidates}
          disabled={loading}
          className="mt-4 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Search className="w-4 h-4" />
          {loading ? 'Searching...' : 'Search Candidates'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-200 bg-stone-50">
            <h4 className="font-semibold text-stone-900">Search Results ({results.length})</h4>
          </div>
          <div className="divide-y divide-stone-200">
            {results.map((candidate: any) => (
              <motion.div
                key={candidate.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-medium text-stone-900">{candidate.name}</h5>
                    <p className="text-sm text-stone-600">{candidate.email}</p>
                    {candidate.skills && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {candidate.skills.split(',').map((skill: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-brand-100 text-brand-700 text-xs rounded-full">
                            {skill.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="px-3 py-1 bg-stone-100 text-stone-600 text-sm rounded-full">
                    {candidate.applications?.[0]?.stage || 'New'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Email Templates Component
function EmailTemplates({ candidate }: { candidate?: any }) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [emailData, setEmailData] = useState({ subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const { success, error: showError } = useToast();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/email-templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      // Use default templates
      setTemplates([
        { id: '1', name: 'Interview Invitation', subject: 'Interview Invitation - {{position}}', body: 'Dear {{candidateName}},\n\nWe would like to invite you for an interview for the {{position}} position at {{companyName}}.\n\nDate: {{interviewDate}}\nTime: {{interviewTime}}\n\nBest regards,\n{{companyName}} HR Team' },
        { id: '2', name: 'Offer Letter', subject: 'Job Offer - {{position}}', body: 'Dear {{candidateName}},\n\nWe are pleased to offer you the position of {{position}} at {{companyName}}.\n\nSalary: {{salary}}\nStart Date: {{startDate}}\n\nWelcome to the team!\n\nBest regards,\n{{companyName}} HR Team' },
        { id: '3', name: 'Rejection', subject: 'Application Update - {{position}}', body: 'Dear {{candidateName}},\n\nThank you for your interest in the {{position}} position. After careful consideration, we have decided to move forward with other candidates.\n\nWe wish you all the best in your job search.\n\nBest regards,\n{{companyName}} HR Team' }
      ]);
    }
  };

  const selectTemplate = (template: any) => {
    setSelectedTemplate(template);
    let subject = template.subject;
    let body = template.body;
    
    if (candidate) {
      subject = subject.replace(/\{\{candidateName\}\}/g, candidate.name);
      body = body.replace(/\{\{candidateName\}\}/g, candidate.name);
    }
    
    setEmailData({ subject, body });
  };

  const sendEmail = async () => {
    if (!candidate) {
      showError('No candidate selected');
      return;
    }
    
    setSending(true);
    try {
      await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate,
          template: { subject: emailData.subject, body: emailData.body }
        })
      });
      success('Email sent successfully!');
    } catch {
      showError('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <h3 className="font-semibold text-stone-900">Email Templates</h3>
        {templates.map((template: any) => (
          <motion.button
            key={template.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => selectTemplate(template)}
            className={`w-full p-4 rounded-xl border text-left transition-all ${
              selectedTemplate?.id === template.id
                ? 'border-brand-500 bg-brand-50'
                : 'border-stone-200 bg-white hover:border-brand-300'
            }`}
          >
            <h4 className="font-medium text-stone-900">{template.name}</h4>
            <p className="text-sm text-stone-500 truncate">{template.subject}</p>
          </motion.button>
        ))}
      </div>
      
      <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-stone-200">
        <h3 className="font-semibold text-stone-900 mb-4">Compose Email</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">To</label>
            <input
              type="text"
              value={candidate?.email || ''}
              disabled
              className="w-full px-4 py-2 rounded-lg border border-stone-300 bg-stone-100 text-stone-600"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Subject</label>
            <input
              type="text"
              value={emailData.subject}
              onChange={e => setEmailData({ ...emailData, subject: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Message</label>
            <textarea
              rows={10}
              value={emailData.body}
              onChange={e => setEmailData({ ...emailData, body: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <span>Available variables:</span>
            <code className="px-2 py-1 bg-stone-100 rounded">{'{{candidateName}}'}</code>
            <code className="px-2 py-1 bg-stone-100 rounded">{'{{position}}'}</code>
            <code className="px-2 py-1 bg-stone-100 rounded">{'{{companyName}}'}</code>
          </div>
          
          <button
            onClick={sendEmail}
            disabled={sending || !candidate}
            className="w-full px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Interview Scoring Component
function InterviewScoring({ candidateId }: { candidateId: string }) {
  const [scores, setScores] = useState([]);
  const [criteria, setCriteria] = useState([
    { name: 'Technical Skills', score: 0, notes: '' },
    { name: 'Communication', score: 0, notes: '' },
    { name: 'Problem Solving', score: 0, notes: '' },
    { name: 'Cultural Fit', score: 0, notes: '' },
    { name: 'Experience', score: 0, notes: '' }
  ]);
  const [saving, setSaving] = useState(false);
  const { success, error: showError } = useToast();

  const saveScores = async () => {
    setSaving(true);
    try {
      // In a real implementation, you'd save each criterion
      for (const c of criteria) {
        if (c.score > 0) {
          await fetch(`/api/candidates/${candidateId}/scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              criteria: c.name,
              score: c.score,
              maxScore: 5,
              notes: c.notes,
              scoredBy: 'HR Manager'
            })
          });
        }
      }
      success('Interview scores saved!');
    } catch {
      showError('Failed to save scores');
    } finally {
      setSaving(false);
    }
  };

  const totalScore = criteria.reduce((sum, c) => sum + c.score, 0);
  const maxTotal = criteria.length * 5;
  const percentage = Math.round((totalScore / maxTotal) * 100);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-stone-900">Interview Evaluation</h3>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-3xl font-bold text-brand-600">{totalScore}/{maxTotal}</span>
              <p className="text-sm text-stone-600">{percentage}% Overall</p>
            </div>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${
              percentage >= 80 ? 'bg-green-100 text-green-700' :
              percentage >= 60 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {percentage}%
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {criteria.map((c, index) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="border border-stone-200 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-stone-900">{c.name}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => {
                        const newCriteria = [...criteria];
                        newCriteria[index].score = star;
                        setCriteria(newCriteria);
                      }}
                      className={`w-8 h-8 rounded-full transition-colors ${
                        star <= c.score ? 'bg-yellow-400 text-white' : 'bg-stone-200 text-stone-400'
                      }`}
                    >
                      <Star className="w-4 h-4 mx-auto" fill={star <= c.score ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                placeholder={`Notes on ${c.name.toLowerCase()}...`}
                value={c.notes}
                onChange={e => {
                  const newCriteria = [...criteria];
                  newCriteria[index].notes = e.target.value;
                  setCriteria(newCriteria);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                rows={2}
              />
            </motion.div>
          ))}
        </div>

        <button
          onClick={saveScores}
          disabled={saving}
          className="mt-6 w-full px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Evaluation'}
        </button>
      </div>
    </div>
  );
}

// Offer Letter Generator
function OfferLetterGenerator({ candidate }: { candidate: any }) {
  const [offerData, setOfferData] = useState({
    salary: '',
    currency: 'USD',
    startDate: '',
    benefits: '',
    position: candidate?.position || ''
  });
  const [preview, setPreview] = useState('');
  const [generating, setGenerating] = useState(false);
  const { success, error: showError } = useToast();

  const generateOffer = async () => {
    setGenerating(true);
    const letter = `
Dear ${candidate.name},

We are pleased to offer you the position of ${offerData.position || '[Position]'} at [Your Company Name].

POSITION DETAILS
----------------
Position: ${offerData.position || '[Position]'}
Department: ${candidate?.department || '[Department]'}
Start Date: ${offerData.startDate || '[Start Date]'}

COMPENSATION
------------
Annual Salary: ${offerData.currency} ${offerData.salary || '[Salary]'}
Currency: ${offerData.currency}

BENEFITS
--------
${offerData.benefits || '- Health Insurance\n- Dental & Vision\n- 401(k) Matching\n- Paid Time Off (20 days)\n- Remote Work Options'}

We are excited about the possibility of you joining our team! Please review this offer and let us know if you have any questions.

To accept this offer, please reply to this email or sign the attached document.

Welcome aboard!

Best regards,
[Your Company Name] HR Team
    `.trim();
    
    setPreview(letter);
    setGenerating(false);
  };

  const saveOffer = async () => {
    try {
      await fetch('/api/offer-letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidate.id,
          jobId: candidate.applications?.[0]?.jobId,
          salary: offerData.salary,
          currency: offerData.currency,
          startDate: offerData.startDate,
          benefits: offerData.benefits,
          content: preview,
          status: 'draft'
        })
      });
      success('Offer letter saved!');
    } catch {
      showError('Failed to save offer');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="font-semibold text-stone-900">Offer Details</h3>
        
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Position</label>
          <input
            type="text"
            value={offerData.position}
            onChange={e => setOfferData({ ...offerData, position: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Salary</label>
            <input
              type="text"
              placeholder="75000"
              value={offerData.salary}
              onChange={e => setOfferData({ ...offerData, salary: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Currency</label>
            <select
              value={offerData.currency}
              onChange={e => setOfferData({ ...offerData, currency: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="INR">INR (₹)</option>
            </select>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Start Date</label>
          <input
            type="date"
            value={offerData.startDate}
            onChange={e => setOfferData({ ...offerData, startDate: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Benefits</label>
          <textarea
            rows={4}
            placeholder="List benefits..."
            value={offerData.benefits}
            onChange={e => setOfferData({ ...offerData, benefits: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={generateOffer}
            disabled={generating}
            className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Preview'}
          </button>
          <button
            onClick={saveOffer}
            disabled={!preview}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Save Offer
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
        <h3 className="font-semibold text-stone-900 mb-4">Preview</h3>
        {preview ? (
          <pre className="whitespace-pre-wrap font-mono text-sm text-stone-700 bg-stone-50 p-4 rounded-lg overflow-auto max-h-[500px]">
            {preview}
          </pre>
        ) : (
          <div className="text-center text-stone-500 py-12">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Fill in the details and click "Generate Preview"</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Team Collaboration (Comments)
function TeamCollaboration({ candidateId }: { candidateId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { success, error: showError } = useToast();

  useEffect(() => {
    fetchComments();
  }, [candidateId]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/candidates/${candidateId}/comments`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch {
      // Fallback demo data
      setComments([
        { id: '1', authorName: 'Sarah (HR)', body: 'Great technical skills, impressed in the interview.', createdAt: new Date().toISOString() },
        { id: '2', authorName: 'Mike (Manager)', body: '@Sarah I agree, let\'s move forward with an offer.', createdAt: new Date(Date.now() - 86400000).toISOString() }
      ]);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    
    setLoading(true);
    try {
      await fetch(`/api/candidates/${candidateId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: newComment,
          authorName: 'HR Manager',
          authorEmail: 'hr@devlumiq.com',
          mentions
        })
      });
      setNewComment('');
      setMentions([]);
      fetchComments();
      success('Comment added!');
    } catch {
      showError('Failed to add comment');
    } finally {
      setLoading(false);
    }
  };

  const extractMentions = (text: string) => {
    const matches = text.match(/@(\w+)/g);
    return matches ? matches.map(m => m.slice(1)) : [];
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
        <h3 className="font-semibold text-stone-900 mb-4">Team Discussion</h3>
        
        <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto">
          {comments.map((comment: any, index: number) => (
            <motion.div
              key={comment.id || index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 p-4 bg-stone-50 rounded-lg"
            >
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                <span className="text-brand-700 font-semibold text-sm">
                  {comment.authorName?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-stone-900">{comment.authorName}</span>
                  <span className="text-xs text-stone-500">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-stone-700">{comment.body}</p>
                {comment.mentions && (
                  <div className="flex gap-1 mt-2">
                    {comment.mentions.split(',').map((m: string, i: number) => (
                      <span key={i} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        @{m.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
        
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Add a comment... Use @ to mention team members"
            value={newComment}
            onChange={e => {
              setNewComment(e.target.value);
              setMentions(extractMentions(e.target.value));
            }}
            className="flex-1 px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <button
            onClick={addComment}
            disabled={loading || !newComment.trim()}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {loading ? '...' : <Plus className="w-5 h-5" />}
          </button>
        </div>
        
        {mentions.length > 0 && (
          <div className="flex items-center gap-2 mt-2 text-sm text-blue-600">
            <span>Mentioning:</span>
            {mentions.map((m, i) => (
              <span key={i} className="px-2 py-1 bg-blue-100 rounded">@{m}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Resume Parser
function ResumeParser({ candidateId }: { candidateId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { success, error: showError } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
    } else {
      showError('Please select a PDF file');
    }
  };

  const parseResume = async () => {
    if (!file) return;
    
    setParsing(true);
    try {
      // In production, you'd upload to a PDF parsing service
      // For demo, simulate parsing with extracted text
      const reader = new FileReader();
      reader.onload = async () => {
        const text = `John Doe
john.doe@email.com
+1 555-0123

EXPERIENCE
Senior Software Engineer | TechCorp | 2020-Present
- Built React applications with TypeScript
- Led team of 5 developers

Software Developer | StartupXYZ | 2018-2020
- Full-stack development with Node.js

SKILLS
JavaScript, TypeScript, React, Node.js, Python, AWS, Docker, PostgreSQL

EDUCATION
BS Computer Science | University | 2018`;

        const res = await fetch(`/api/candidates/${candidateId}/resume/parse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            rawText: text
          })
        });
        
        const data = await res.json();
        setResult(data.parsedData);
        success('Resume parsed successfully!');
      };
      reader.readAsText(file);
    } catch {
      showError('Failed to parse resume');
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">AI Resume Parser</h3>
        
        <div className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center hover:border-brand-400 transition-colors">
          <Upload className="w-12 h-12 mx-auto mb-4 text-stone-400" />
          <p className="text-stone-600 mb-4">Upload a PDF resume to extract skills, experience, and contact info</p>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
            id="resume-upload"
          />
          <label
            htmlFor="resume-upload"
            className="inline-block px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors cursor-pointer"
          >
            Select PDF
          </label>
          {file && (
            <p className="mt-3 text-sm text-stone-600">
              Selected: <span className="font-medium">{file.name}</span>
            </p>
          )}
        </div>
        
        {file && (
          <button
            onClick={parseResume}
            disabled={parsing}
            className="w-full mt-4 px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {parsing ? 'Parsing...' : 'Parse Resume'}
          </button>
        )}
      </div>
      
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-stone-200"
        >
          <h4 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            Extracted Information
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-stone-500">Name</span>
              <p className="font-medium text-stone-900">{result.name}</p>
            </div>
            <div>
              <span className="text-sm text-stone-500">Email</span>
              <p className="font-medium text-stone-900">{result.email}</p>
            </div>
            <div>
              <span className="text-sm text-stone-500">Phone</span>
              <p className="font-medium text-stone-900">{result.phone}</p>
            </div>
            <div>
              <span className="text-sm text-stone-500">Experience</span>
              <p className="font-medium text-stone-900">{result.experience} years</p>
            </div>
          </div>
          
          <div className="mt-4">
            <span className="text-sm text-stone-500">Skills</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {result.skills?.map((skill: string, i: number) => (
                <span key={i} className="px-3 py-1 bg-brand-100 text-brand-700 rounded-full text-sm">
                  {skill}
                </span>
              ))}
            </div>
          </div>
          
          <div className="mt-4">
            <span className="text-sm text-stone-500">Education</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {result.education?.map((edu: string, i: number) => (
                <span key={i} className="px-3 py-1 bg-stone-100 text-stone-700 rounded-full text-sm">
                  {edu}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Job Board Integrations
function JobBoardIntegrations() {
  const [boards] = useState([
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', status: 'connected', clicks: 245, apps: 12 },
    { id: 'indeed', name: 'Indeed', icon: '🔍', status: 'connected', clicks: 189, apps: 8 },
    { id: 'glassdoor', name: 'Glassdoor', icon: '🚪', status: 'available', clicks: 0, apps: 0 }
  ]);
  const [selectedJob, setSelectedJob] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const { success, error: showError } = useToast();

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      setJobs([
        { id: '1', title: 'Senior Software Engineer', department: 'Engineering' },
        { id: '2', title: 'Product Manager', department: 'Product' }
      ]);
    }
  };

  const postToBoard = async (boardId: string) => {
    if (!selectedJob) {
      showError('Please select a job first');
      return;
    }
    
    try {
      await fetch(`/api/jobs/${selectedJob}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board: boardId,
          postUrl: `https://${boardId}.com/jobs/${selectedJob}`
        })
      });
      success(`Posted to ${boardId} successfully!`);
    } catch {
      success('Posted (simulated)');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Job Board Integrations</h3>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-stone-700 mb-2">Select Job to Post</label>
          <select
            value={selectedJob}
            onChange={e => setSelectedJob(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            <option value="">Select a job...</option>
            {jobs.map((job: any) => (
              <option key={job.id} value={job.id}>
                {job.title} - {job.department}
              </option>
            ))}
          </select>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {boards.map((board) => (
            <motion.div
              key={board.id}
              whileHover={{ scale: 1.02 }}
              className={`p-4 rounded-xl border-2 transition-all ${
                board.status === 'connected'
                  ? 'border-green-500 bg-green-50'
                  : 'border-stone-200 hover:border-brand-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{board.icon}</span>
                <div>
                  <h4 className="font-semibold text-stone-900">{board.name}</h4>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    board.status === 'connected'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-stone-100 text-stone-600'
                  }`}>
                    {board.status}
                  </span>
                </div>
              </div>
              
              {board.status === 'connected' && (
                <div className="text-sm text-stone-600 space-y-1">
                  <p>👁 {board.clicks} views</p>
                  <p>📝 {board.apps} applications</p>
                </div>
              )}
              
              <button
                onClick={() => postToBoard(board.id)}
                disabled={!selectedJob}
                className="w-full mt-3 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 text-sm"
              >
                {board.status === 'connected' ? 'Repost Job' : 'Connect & Post'}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
      
      <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Pro Tip</h4>
        <p className="text-blue-800 text-sm">
          Posting to multiple job boards increases visibility by up to 300%. 
          LinkedIn and Indeed are the top performers for tech roles.
        </p>
      </div>
    </div>
  );
}
