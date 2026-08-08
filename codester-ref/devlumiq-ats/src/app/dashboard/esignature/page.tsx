'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileSignature, FileCheck, Clock, XCircle, CheckCircle, Send, Download, FileText, Pen, AlertCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import { format } from 'date-fns';

type ESignatureRequest = {
  id: string;
  offerLetterId: string;
  provider: string;
  externalId: string | null;
  status: string;
  signUrl: string | null;
  signedDocumentUrl: string | null;
  signerName: string;
  signerEmail: string;
  signedAt: string | null;
  createdAt: string;
  sentAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  offerLetter: {
    candidate: { name: string; email: string };
    job: { title: string };
  };
};

export default function ESignaturePage() {
  const { t } = useLocale();
  const toast = useToast();
  const [requests, setRequests] = useState<ESignatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'declined'>('all');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/esignature/send', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRequests(data || []);
      }
    } catch (error) {
      console.error('Error fetching eSignatures:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'signed':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'sent':
      case 'delivered':
        return <Clock className="w-5 h-5 text-amber-500" />;
      case 'declined':
      case 'voided':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'draft':
        return <FileText className="w-5 h-5 text-stone-400" />;
      default:
        return <Send className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'signed':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'sent':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'delivered':
        return 'bg-brand-100 text-brand-700 border-brand-200';
      case 'declined':
      case 'voided':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'draft':
        return 'bg-stone-100 text-stone-600 border-stone-200';
      default:
        return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  const resendRequest = async (id: string) => {
    try {
      const res = await fetch('/api/esignature/send', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ event: 'resend', data: { id } }),
      });
      if (res.ok) {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'sent', sentAt: new Date().toISOString() } : r));
        toast.success('Signature request resent');
      } else {
        toast.error('Failed to resend request');
      }
    } catch {
      toast.error('Failed to resend request');
    }
  };

  const updateRequestStatus = async (id: string, status: string) => {
    try {
      const res = await fetch('/api/esignature/send', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          event: status === 'completed' ? 'envelope-completed' : 'envelope-declined',
          data: { envelopeId: requests.find(r => r.id === id)?.externalId || id },
        }),
      });
      if (res.ok) {
        setRequests(prev => prev.map(r => r.id === id ? {
          ...r,
          status,
          ...(status === 'completed' ? { completedAt: new Date().toISOString(), signedAt: new Date().toISOString() } : {}),
        } : r));
        toast.success(`Status updated to ${status}`);
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const filteredRequests = requests.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'pending') return ['draft', 'sent', 'delivered'].includes(r.status);
    if (filter === 'completed') return ['completed', 'signed'].includes(r.status);
    if (filter === 'declined') return ['declined', 'voided'].includes(r.status);
    return true;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => ['draft', 'sent', 'delivered'].includes(r.status)).length,
    completed: requests.filter(r => ['completed', 'signed'].includes(r.status)).length,
    declined: requests.filter(r => ['declined', 'voided'].includes(r.status)).length,
  };

  return (
    <PageShell>
      <PageHeader 
        icon={FileSignature} 
        title={t('esignature.title') || 'E-Signature'} 
        subtitle={t('esignature.subtitle') || 'Send and track offer letter signatures with DocuSign'}
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label={t('esignature.total') || 'Total'}
          value={stats.total}
          icon={FileText}
          iconClassName="text-brand-600 bg-brand-50"
        />
        <StatCard
          label={t('esignature.pending') || 'Pending'}
          value={stats.pending}
          icon={Clock}
          iconClassName="text-amber-600 bg-amber-50"
        />
        <StatCard
          label={t('esignature.completed') || 'Completed'}
          value={stats.completed}
          icon={CheckCircle}
          iconClassName="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          label={t('esignature.declined') || 'Declined'}
          value={stats.declined}
          icon={XCircle}
          iconClassName="text-violet-600 bg-violet-50"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200">
        {(['all', 'pending', 'completed', 'declined'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              filter === f
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {t(`esignature.${f}`) || f}
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-stone-100 rounded-full">
              {f === 'all' ? stats.total : stats[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Requests List */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden"
      >
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-stone-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <EmptyState 
            message={t('esignature.noRequests') || 'No signature requests yet'} 
            icon={FileSignature}
            subMessage={t('esignature.sendFromOffers') || 'Send offers from the Offers page to initiate e-signatures'}
          />
        ) : (
          <div className="divide-y divide-stone-100">
            {filteredRequests.map((request) => (
              <div key={request.id} className="p-4 sm:p-5 hover:bg-stone-50/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${getStatusColor(request.status)}`}>
                    {getStatusIcon(request.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-stone-900">
                          {request.offerLetter.candidate.name}
                        </h3>
                        <p className="text-sm text-stone-500">{request.offerLetter.candidate.email}</p>
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-lg border ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm font-medium text-stone-700">
                        {request.offerLetter.job.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs text-stone-500">
                      <span className="flex items-center gap-1">
                        <FileSignature className="w-3.5 h-3.5" />
                        {t('esignature.provider') || 'Provider'}: {request.provider}
                      </span>
                      <span className="text-stone-300">|</span>
                      <span>{t('esignature.sent') || 'Sent'}: {request.sentAt ? format(new Date(request.sentAt), 'MMM d, yyyy') : t('common.notSent') || 'Not sent'}</span>
                      {request.expiresAt && (
                        <>
                          <span className="text-stone-300">|</span>
                          <span className="flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {t('esignature.expires') || 'Expires'}: {format(new Date(request.expiresAt), 'MMM d')}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {request.status === 'sent' && request.signUrl && (
                        <a
                          href={request.signUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
                        >
                          <Pen className="w-3.5 h-3.5" />
                          {t('esignature.signNow') || 'Sign Now'}
                        </a>
                      )}
                      {['sent', 'delivered'].includes(request.status) && (
                        <>
                          <button
                            onClick={() => resendRequest(request.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Resend
                          </button>
                          <button
                            onClick={() => updateRequestStatus(request.id, 'completed')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Mark Complete
                          </button>
                          <button
                            onClick={() => updateRequestStatus(request.id, 'voided')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Void
                          </button>
                        </>
                      )}
                      {request.signedDocumentUrl && (
                        <a
                          href={request.signedDocumentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {t('esignature.download') || 'Download'}
                        </a>
                      )}
                      {request.signedAt && (
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          {t('esignature.signedOn') || 'Signed'}: {format(new Date(request.signedAt), 'MMM d, yyyy h:mm a')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* DocuSign Integration Info */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-stone-200/80 bg-gradient-to-r from-brand-50/50 to-emerald-50/50 p-4 sm:p-5"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-white border border-brand-200 flex items-center justify-center flex-shrink-0 shadow-sm">
            <FileCheck className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900">{t('esignature.docusignIntegration') || 'DocuSign Integration'}</h3>
            <p className="text-sm text-stone-600 mt-1">
              {t('esignature.docusignDesc') || 'Secure, legally binding electronic signatures powered by DocuSign. Track status, send reminders, and download signed documents automatically.'}
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-stone-500">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                {t('esignature.legallyBinding') || 'Legally Binding'}
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                {t('esignature.auditTrail') || 'Full Audit Trail'}
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                {t('esignature.autoReminders') || 'Auto Reminders'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </PageShell>
  );
}
