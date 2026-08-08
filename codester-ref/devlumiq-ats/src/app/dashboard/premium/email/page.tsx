/**
 * Email Templates Page
 * =====================
 * Pre-built email templates for candidate communications (interview invites,
 * offers, rejections, screening requests). Templates use {{variableName}}
 * syntax. Emails are previewed and sent via the /api/email/send endpoint.
 */
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Send, Sparkles, CheckCircle, FileText, Calendar, Gift, HeartHandshake, Phone } from 'lucide-react';
import { CandidateSelector } from '@/components/ui/CandidateSelector';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import { useToast } from '@/components/ui/Toast';
import { useLocale } from '@/components/providers/LocaleProvider';
import { EmailShortFormManager } from '@/components/dashboard/EmailShortFormManager';

const EMAIL_TEMPLATES = [
  {
    id: 'interview',
    name: 'Interview Invitation',
    subject: 'Interview Invitation - {{position}}',
    body: `Dear {{candidateName}},

Thank you for applying for the {{position}} position at {{companyName}}.

We would like to invite you for an interview:
Date: {{date}}
Time: {{time}}
Format: {{format}}

Please confirm your availability by replying to this email.

Best regards,
HR Team
{{companyName}}`,
    icon: Calendar,
  },
  {
    id: 'offer',
    name: 'Job Offer',
    subject: 'Job Offer - {{position}}',
    body: `Dear {{candidateName}},

We are delighted to offer you the position of {{position}} at {{companyName}}!

Salary: {{salary}}
Start Date: {{startDate}}
Benefits: {{benefits}}

Please review the attached offer letter and confirm your acceptance.

Best regards,
HR Team
{{companyName}}`,
    icon: Gift,
  },
  {
    id: 'rejection',
    name: 'Application Update',
    subject: 'Application Update',
    body: `Dear {{candidateName}},

Thank you for your interest in the {{position}} position at {{companyName}}.

After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.

We wish you the best in your job search.

Best regards,
HR Team
{{companyName}}`,
    icon: HeartHandshake,
  },
  {
    id: 'screening',
    name: 'Phone Screening Request',
    subject: 'Phone Screening - {{position}}',
    body: `Dear {{candidateName}},

Thank you for applying to the {{position}} position.

We would like to schedule a brief 15-minute phone screening to discuss your background and the role.

Please let us know your availability for this week.

Best regards,
HR Team`,
    icon: Phone,
  },
];

interface Candidate {
  id: string;
  name: string;
  email: string;
  position?: string;
}

export default function EmailTemplatesPage() {
  const { t } = useLocale();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(EMAIL_TEMPLATES[0]);
  const [subject, setSubject] = useState(EMAIL_TEMPLATES[0].subject);
  const [body, setBody] = useState(EMAIL_TEMPLATES[0].body);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // Template variables
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [format, setFormat] = useState('Video Call');
  const [salary, setSalary] = useState('');
  const [startDate, setStartDate] = useState('');
  const [benefits, setBenefits] = useState('Health Insurance, 401k');

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      const res = await fetch('/api/candidates', { credentials: 'include' });
      const data = await res.json();
      setCandidates(data.candidates || []);
      if (data.candidates?.length > 0) {
        setSelectedCandidate(data.candidates[0]);
      }
    } catch {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (template: typeof EMAIL_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setSubject(template.subject);
    setBody(template.body);
  };

  const getProcessedContent = () => {
    let processedSubject = subject;
    let processedBody = body;

    if (selectedCandidate) {
      processedSubject = processedSubject.replace(/\{\{candidateName\}\}/g, selectedCandidate.name);
      processedSubject = processedSubject.replace(/\{\{position\}\}/g, selectedCandidate.position || '[Position]');
      
      processedBody = processedBody.replace(/\{\{candidateName\}\}/g, selectedCandidate.name);
      processedBody = processedBody.replace(/\{\{position\}\}/g, selectedCandidate.position || '[Position]');
      processedBody = processedBody.replace(/\{\{date\}\}/g, date || '[Date]');
      processedBody = processedBody.replace(/\{\{time\}\}/g, time || '[Time]');
      processedBody = processedBody.replace(/\{\{format\}\}/g, format);
      processedBody = processedBody.replace(/\{\{salary\}\}/g, salary || '[Salary]');
      processedBody = processedBody.replace(/\{\{startDate\}\}/g, startDate || '[Start Date]');
      processedBody = processedBody.replace(/\{\{benefits\}\}/g, benefits);
      processedBody = processedBody.replace(/\{\{companyName\}\}/g, '[Your Company Name]');
      processedSubject = processedSubject.replace(/\{\{companyName\}\}/g, '[Your Company Name]');
    }

    return { subject: processedSubject, body: processedBody };
  };

  const sendEmail = async () => {
    if (!selectedCandidate) {
      toast.error('Please select a candidate');
      return;
    }

    setSending(true);
    try {
      const { subject: processedSubject, body: processedBody } = getProcessedContent();

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          candidate: selectedCandidate,
          job: { title: selectedCandidate.position || 'Position' },
          template: selectedTemplate.id,
          subject: processedSubject,
          body: processedBody,
          interviewDate: date,
          interviewTime: time,
          salary,
          startDate,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? 'Send failed');
      }

      const data = await res.json();
      toast.success(`Email composed for ${data.email?.to ?? selectedCandidate.email}`);
      // Reset template variables after send
      setDate(''); setTime(''); setSalary(''); setStartDate('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send email';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const { subject: previewSubject, body: previewBody } = getProcessedContent();

  return (
    <PageShell>
      {/* Header */}
      <PageHeader icon={Mail} title={t('premium.emailTemplates.title')} subtitle={t('premium.emailTemplates.subtitle')} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Template Selection & Editor */}
        <div className="space-y-4">
          {/* Templates */}
          <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm">
            <h3 className="font-bold text-stone-900 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-600" />
              {t('premium.emailTemplates.selectTemplate')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EMAIL_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => selectTemplate(template)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedTemplate.id === template.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-stone-200 hover:border-brand-300 hover:bg-stone-50'
                  }`}
                >
                  <template.icon className="w-5 h-5 text-brand-600 mb-1" />
                  <p className="font-semibold text-sm text-stone-900">
                    {template.id === 'interview' ? t('premium.emailTemplates.interviewInvitation') :
                     template.id === 'offer' ? t('premium.emailTemplates.jobOffer') :
                     template.id === 'rejection' ? t('premium.emailTemplates.applicationUpdate') :
                     template.id === 'screening' ? t('premium.emailTemplates.phoneScreening') :
                     template.name}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Candidate Selection */}
          <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm">
            <h3 className="font-bold text-stone-900 mb-3 flex items-center gap-2 text-sm">
              Select Candidate
            </h3>
            <CandidateSelector
              candidates={candidates}
              selected={selectedCandidate}
              onSelect={(c) => setSelectedCandidate(c as Candidate)}
              subtitle="email"
              placeholder={t('premium.emailTemplates.selectPlaceholder')}
            />
          </div>

          {/* Template Variables */}
          {selectedTemplate.id === 'interview' && (
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm">
              <h3 className="font-bold text-stone-900 mb-3">{t('premium.emailTemplates.interviewInvitation')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Interview Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:border-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Interview Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:border-brand-500 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Format</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:border-brand-500 outline-none"
                  >
                    <option value="Video Call">Video Call</option>
                    <option value="Phone Call">Phone Call</option>
                    <option value="In-Person">In-Person</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {selectedTemplate.id === 'offer' && (
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm">
              <h3 className="font-bold text-stone-900 mb-3">{t('premium.emailTemplates.jobOffer')}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">{t('premium.offerLetters.salary')}</label>
                  <input
                    type="text"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    placeholder="e.g. $80,000 per year"
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:border-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">{t('premium.offerLetters.startDate')}</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:border-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Benefits</label>
                  <input
                    type="text"
                    value={benefits}
                    onChange={(e) => setBenefits(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:border-brand-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Email Preview */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm">
            <h3 className="font-bold text-stone-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-600" />
              {t('premium.emailTemplates.emailPreview')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">{t('premium.emailTemplates.to')}</label>
                <input
                  type="text"
                  value={selectedCandidate?.email || ''}
                  readOnly
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-sm text-stone-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">{t('premium.emailTemplates.subject')}</label>
                <input
                  type="text"
                  value={previewSubject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:border-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">{t('premium.emailTemplates.body')}</label>
                <textarea
                  value={previewBody}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:border-brand-500 outline-none resize-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Send Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={sendEmail}
            disabled={sending || !selectedCandidate}
            className="w-full p-4 bg-gradient-to-r from-brand-600 to-teal-600 text-white rounded-xl font-bold text-lg hover:from-brand-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('premium.emailTemplates.sending')}
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                {t('premium.emailTemplates.sendEmail')}
              </>
            )}
          </motion.button>

          {selectedCandidate && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <p className="text-sm text-emerald-700">
                {t('premium.emailTemplates.noCandidate')}
              </p>
            </div>
          )}
        </div>
      </div>

      <EmailShortFormManager />
    </PageShell>
  );
}
