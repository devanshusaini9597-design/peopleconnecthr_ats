'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Star, FileCheck, Sparkles, Send, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface QuickActionsProps {
  candidate: {
    id: string;
    name: string;
    email: string;
    position?: string;
    status?: string;
  };
  onEmailClick: () => void;
  onScoreClick: () => void;
  onOfferClick: () => void;
  hasScores?: boolean;
  averageScore?: number;
}

export function QuickActionsPanel({ 
  candidate, 
  onEmailClick, 
  onScoreClick, 
  onOfferClick,
  hasScores = false,
  averageScore = 0 
}: QuickActionsProps) {
  const showOffer = candidate.status === 'Offer' || candidate.status === 'Hired';

  return (
    <div className="flex flex-wrap gap-2">
      {/* Email Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onEmailClick}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-teal-600 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 hover:shadow-brand-500/35 transition-all"
      >
        <Mail className="w-4 h-4" />
        <span className="hidden sm:inline">Send Email</span>
        <Sparkles className="w-3 h-3 text-amber-300" />
      </motion.button>

      {/* Score Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onScoreClick}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-amber-500/25 hover:shadow-amber-500/35 transition-all"
      >
        <Star className="w-4 h-4" />
        <span className="hidden sm:inline">Score Interview</span>
      </motion.button>

      {/* Offer Button (conditional) */}
      {showOffer && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onOfferClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/35 transition-all"
        >
          <FileCheck className="w-4 h-4" />
          <span className="hidden sm:inline">Generate Offer</span>
        </motion.button>
      )}

      {/* Score Badge */}
      {hasScores && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold ${
          averageScore >= 80 ? 'bg-emerald-100 text-emerald-700' : 
          averageScore >= 60 ? 'bg-amber-100 text-amber-700' : 
          'bg-stone-100 text-stone-700'
        }`}>
          <Star className="w-4 h-4" />
          Score: {averageScore}%
        </div>
      )}
    </div>
  );
}

// Email Templates
const EMAIL_TEMPLATES = [
  { id: '1', name: 'Interview Invitation', subject: 'Interview Invitation - {{position}}', body: 'Hi {{candidateName}},\n\nWe would like to invite you for an interview for the {{position}} position.\n\nBest regards' },
  { id: '2', name: 'Application Received', subject: 'Application Received - {{position}}', body: 'Hi {{candidateName}},\n\nThank you for applying to the {{position}} position. We will review your application.\n\nBest regards' },
  { id: '3', name: 'Offer Letter', subject: 'Job Offer - {{position}}', body: 'Dear {{candidateName}},\n\nWe are pleased to offer you the position of {{position}}.\n\nCongratulations!' },
  { id: '4', name: 'Rejection', subject: 'Application Update', body: 'Hi {{candidateName}},\n\nThank you for your interest. After careful consideration, we have decided to move forward with other candidates.\n\nBest wishes' },
];

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: {
    name: string;
    email: string;
    position?: string;
  };
}

export function EmailTemplatesModal({ isOpen, onClose, candidate }: EmailModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState(EMAIL_TEMPLATES[0]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const toast = useToast();

  const selectTemplate = (template: typeof EMAIL_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    let subj = template.subject;
    let bod = template.body;
    subj = subj.replace(/\{\{candidateName\}\}/g, candidate.name);
    bod = bod.replace(/\{\{candidateName\}\}/g, candidate.name);
    if (candidate.position) {
      subj = subj.replace(/\{\{position\}\}/g, candidate.position);
      bod = bod.replace(/\{\{position\}\}/g, candidate.position);
    }
    setSubject(subj);
    setBody(bod);
  };

  const sendEmail = async () => {
    setSending(true);
    try {
      await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate, subject, body }),
      });
      toast.success('Email sent successfully');
      onClose();
    } catch {
      toast.error('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto"
      >
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">Send Email</h2>
              <p className="text-sm text-stone-500">to {candidate.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Template</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EMAIL_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => selectTemplate(template)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedTemplate.id === template.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-stone-200 hover:border-brand-300'
                  }`}
                >
                  <p className="font-semibold text-sm text-stone-900">{template.name}</p>
                  <p className="text-xs text-stone-500 truncate">{template.subject}</p>
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none font-mono text-sm"
            />
          </div>
          
          <div className="flex gap-3 pt-2">
            <button
              onClick={sendEmail}
              disabled={sending || !subject || !body}
              className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Email
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-stone-200 text-stone-700 rounded-xl font-semibold hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
