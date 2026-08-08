'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle, Clock, XCircle, AlertTriangle, FileSearch, User, Calendar, ExternalLink, ShieldCheck, Crown, Plus, MoreHorizontal, Send, Trash2, Eye, X, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import { useLocale } from '@/components/providers/LocaleProvider';
import { format } from 'date-fns';

// ============================================
// TYPES
// ============================================
type BackgroundCheck = {
  id: string;
  provider: string;
  externalId: string | null;
  status: string;
  checkTypes: string[];
  resultSummary: string | null;
  completedAt: string | null;
  reportUrl: string | null;
  consentObtained: boolean;
  consentDate: string | null;
  adverseActionRequired: boolean;
  createdAt: string;
  candidate: {
    id: string;
    name: string;
    email: string;
  };
  application?: {
    job: {
      title: string;
    };
  };
};

type CandidateOption = { id: string; name: string; email: string };
type FilterType = 'all' | 'pending' | 'clear' | 'consider';

// ============================================
// STATUS HELPERS
// ============================================
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'clear':
    case 'complete':
      return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    case 'pending':
      return <Clock className="w-5 h-5 text-amber-500" />;
    case 'in_progress':
      return <FileSearch className="w-5 h-5 text-blue-500" />;
    case 'consider':
      return <AlertTriangle className="w-5 h-5 text-orange-500" />;
    case 'suspended':
      return <XCircle className="w-5 h-5 text-red-500" />;
    default:
      return <Shield className="w-5 h-5 text-stone-400" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'clear':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'complete':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'pending':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'in_progress':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'consider':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'suspended':
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-stone-100 text-stone-600 border-stone-200';
  }
};

const getCheckTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    criminal: 'Criminal',
    employment: 'Employment',
    education: 'Education',
    identity: 'Identity',
    credit: 'Credit',
    motor_vehicle: 'Motor Vehicle',
    drug: 'Drug',
  };
  return labels[type] || type;
};

// ============================================
// CHECK TYPE OPTIONS (outside component to prevent re-creation)
// ============================================
const checkTypeOptions = [
  { id: 'criminal', label: 'Criminal Background', icon: Shield },
  { id: 'employment', label: 'Employment Verification', icon: User },
  { id: 'education', label: 'Education Verification', icon: FileSearch },
  { id: 'identity', label: 'Identity Check', icon: CheckCircle },
  { id: 'credit', label: 'Credit Check', icon: AlertTriangle },
  { id: 'motor_vehicle', label: 'Motor Vehicle', icon: ExternalLink },
  { id: 'drug', label: 'Drug Screening', icon: AlertTriangle },
];

// ============================================
// REQUEST CHECK MODAL (separate memoized component - prevents flickering)
// ============================================
interface RequestCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: CandidateOption[];
  onSubmit: (candidateId: string, checkTypes: string[]) => Promise<void>;
}

const RequestCheckModal = memo(function RequestCheckModal({ isOpen, onClose, candidates, onSubmit }: RequestCheckModalProps) {
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [selectedCheckTypes, setSelectedCheckTypes] = useState<string[]>(['criminal', 'employment']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedCandidate('');
      setSelectedCheckTypes(['criminal', 'employment']);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const toggleCheckType = useCallback((typeId: string) => {
    setSelectedCheckTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId]
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedCandidate) return;
    setIsSubmitting(true);
    try {
      await onSubmit(selectedCandidate, selectedCheckTypes);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedCandidate, selectedCheckTypes, onSubmit, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          key="modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-stone-200 bg-gradient-to-r from-emerald-50 to-teal-50 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-stone-900">Request Background Check</h2>
                <p className="text-sm text-stone-500">Select candidate and check types</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/80 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-stone-500" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="p-6 space-y-5 overflow-y-auto">
            {/* Candidate Select */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Select Candidate <span className="text-red-500">*</span>
              </label>
              {candidates.length === 0 ? (
                <div className="p-4 bg-stone-50 rounded-xl text-center">
                  <p className="text-sm text-stone-500">No candidates available</p>
                  <p className="text-xs text-stone-400 mt-1">Add candidates first</p>
                </div>
              ) : (
                <select
                  value={selectedCandidate}
                  onChange={(e) => setSelectedCandidate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                >
                  <option value="">Select a candidate...</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} ({candidate.email})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Check Types Grid */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-3">
                Check Types <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {checkTypeOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selectedCheckTypes.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      onClick={() => toggleCheckType(option.id)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition-all duration-150 ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-stone-400'}`} />
                      <span className="font-medium truncate">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notice */}
            <div className="p-4 bg-amber-50 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-stone-900">Important Notice</p>
                  <p className="text-xs text-stone-500 mt-1">
                    Candidate consent is required before initiating background checks. An email will be sent to the candidate for authorization.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-stone-200 bg-stone-50 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-stone-600 hover:text-stone-800 font-medium text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedCandidate || selectedCheckTypes.length === 0 || isSubmitting || candidates.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Request Check
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

// ============================================
// FILTER TABS COMPONENT
// ============================================
interface FilterTabsProps {
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  stats: { total: number; pending: number; clear: number; consider: number };
}

const FilterTabs = memo(function FilterTabs({ filter, setFilter, stats }: FilterTabsProps) {
  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'clear', label: 'Clear' },
    { key: 'consider', label: 'Consider' },
  ];

  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="flex items-center gap-1 sm:gap-2 border-b border-stone-200 min-w-max">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              filter === f.key
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {f.label}
            <span className="ml-1.5 sm:ml-2 px-1.5 py-0.5 text-xs bg-stone-100 rounded-full">
              {f.key === 'all' ? stats.total : stats[f.key]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
});

// ============================================
// CHECK ITEM COMPONENT
// ============================================
interface CheckItemProps {
  check: BackgroundCheck;
  onDelete: (id: string) => void;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
}

const CheckItem = memo(function CheckItem({ check, onDelete, isMenuOpen, onToggleMenu }: CheckItemProps) {
  return (
    <div className="p-4 sm:p-5 hover:bg-stone-50/50 transition-colors">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${getStatusColor(check.status)}`}>
          {getStatusIcon(check.status)}
        </div>
        <div className="flex-1 min-w-0">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-stone-900 truncate">{check.candidate.name}</h3>
              <p className="text-sm text-stone-500 truncate">{check.candidate.email}</p>
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded-lg border flex-shrink-0 ${getStatusColor(check.status)}`}>
              {check.status.replace('_', ' ')}
            </span>
          </div>
          
          {/* Job Title */}
          {check.application && (
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm font-medium text-stone-700 truncate">
                {check.application.job.title}
              </span>
            </div>
          )}

          {/* Check Types */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-3">
            {check.checkTypes.map((type) => (
              <span key={type} className="px-2 py-0.5 text-xs bg-stone-100 text-stone-600 rounded">
                {getCheckTypeLabel(type)}
              </span>
            ))}
          </div>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-stone-500">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              Provider: {check.provider}
            </span>
            <span className="hidden sm:inline text-stone-300">|</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Requested: {format(new Date(check.createdAt), 'MMM d, yyyy')}
            </span>
            {check.completedAt && (
              <>
                <span className="hidden sm:inline text-stone-300">|</span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Completed: {format(new Date(check.completedAt), 'MMM d, yyyy')}
                </span>
              </>
            )}
          </div>

          {/* Actions Row */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {!check.consentObtained && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5" />
                Consent Required
              </span>
            )}
            {check.consentObtained && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg">
                <CheckCircle className="w-3.5 h-3.5" />
                Consent Obtained
              </span>
            )}
            {check.reportUrl && (
              <a
                href={check.reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Report
              </a>
            )}
            
            {/* Dropdown Menu */}
            <div className="relative ml-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMenu();
                }}
                className="p-2 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-600 transition-all"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-stone-200 z-50 py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onDelete(check.id)}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export default function BackgroundChecksPage() {
  const toast = useToast();
  const { t } = useLocale();
  const [checks, setChecks] = useState<BackgroundCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);

  // Fetch checks on mount
  useEffect(() => {
    fetchChecks();
  }, []);

  // Click outside to close menu
  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  const fetchChecks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/background-checks/request', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setChecks(data || []);
      }
    } catch (error) {
      console.error('Error fetching background checks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await fetch('/api/candidates', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
      }
    } catch (error) {
      console.error('Error fetching candidates:', error);
    }
  }, []);

  const handleOpenModal = useCallback(() => {
    setShowRequestModal(true);
    fetchCandidates();
  }, [fetchCandidates]);

  const handleCloseModal = useCallback(() => {
    setShowRequestModal(false);
  }, []);

  const handleRequestCheck = useCallback(async (candidateId: string, checkTypes: string[]) => {
    try {
      const res = await fetch('/api/background-checks/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          checkTypes,
          requestedById: 'current-user',
        }),
      });
      if (res.ok) {
        toast.success('Background check requested successfully');
        fetchChecks();
      } else {
        toast.error('Failed to request background check');
      }
    } catch (error) {
      toast.error('Something went wrong');
    }
  }, [fetchChecks, toast]);

  const handleDeleteCheck = useCallback(async (checkId: string) => {
    if (!confirm('Are you sure you want to delete this background check?')) return;
    try {
      const res = await fetch(`/api/background-checks/request/${checkId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Background check deleted');
        fetchChecks();
      } else {
        toast.error('Failed to delete background check');
      }
    } catch (error) {
      toast.error('Something went wrong');
    }
    setOpenMenuId(null);
  }, [fetchChecks, toast]);

  const filteredChecks = checks.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'pending') return ['pending', 'in_progress'].includes(c.status);
    if (filter === 'clear') return c.status === 'clear' || c.resultSummary === 'clear';
    if (filter === 'consider') return c.status === 'consider' || c.resultSummary === 'consider';
    return true;
  });

  const stats = {
    total: checks.length,
    pending: checks.filter(c => ['pending', 'in_progress'].includes(c.status)).length,
    clear: checks.filter(c => c.status === 'clear' || c.resultSummary === 'clear').length,
    consider: checks.filter(c => c.status === 'consider' || c.resultSummary === 'consider').length,
  };

  return (
    <PageShell>
      {/* Header */}
      <PageHeader icon={Shield} title={t('bgChecks.title')} subtitle={t('bgChecks.subtitle')}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleOpenModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 btn-primary !text-sm w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          {t('bgChecks.requestCheck')}
        </motion.button>
      </PageHeader>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={Shield}
          label="Total"
          value={stats.total}
          iconClassName="text-brand-600 bg-brand-50"
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={stats.pending}
          iconClassName="text-amber-600 bg-amber-50"
        />
        <StatCard
          icon={CheckCircle}
          label="Clear"
          value={stats.clear}
          iconClassName="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          icon={AlertTriangle}
          label="Consider"
          value={stats.consider}
          iconClassName="text-violet-600 bg-violet-50"
        />
      </div>

      {/* Filter Tabs */}
      <FilterTabs filter={filter} setFilter={setFilter} stats={stats} />

      {/* Checks List */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden"
      >
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-stone-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredChecks.length === 0 ? (
          <EmptyState 
            message="No background checks requested yet" 
            icon={Shield}
            subMessage="Request checks from candidate profiles or click the button above"
          />
        ) : (
          <div className="divide-y divide-stone-100">
            {filteredChecks.map((check) => (
              <CheckItem
                key={check.id}
                check={check}
                onDelete={handleDeleteCheck}
                isMenuOpen={openMenuId === check.id}
                onToggleMenu={() => setOpenMenuId(openMenuId === check.id ? null : check.id)}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Checkr Integration Info */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-stone-200/80 bg-gradient-to-r from-brand-50/50 to-emerald-50/50 p-4 sm:p-5"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-white border border-brand-200 flex items-center justify-center flex-shrink-0 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-brand-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-stone-900">Checkr Integration</h3>
            <p className="text-sm text-stone-600 mt-1">
              Fast, compliant background checks powered by Checkr. Includes criminal, employment, education, and identity verification with automated compliance workflows.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-stone-500">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                FCRA Compliant
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                24-48 Hour Results
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                Adverse Action Support
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Request Background Check Modal - SEPARATE COMPONENT (no flicker) */}
      <RequestCheckModal
        isOpen={showRequestModal}
        onClose={handleCloseModal}
        candidates={candidates}
        onSubmit={handleRequestCheck}
      />
    </PageShell>
  );
}
