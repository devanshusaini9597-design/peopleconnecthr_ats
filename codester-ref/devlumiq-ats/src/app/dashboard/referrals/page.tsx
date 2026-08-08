'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Gift, DollarSign, CheckCircle, Clock, XCircle, Star, UserPlus, TrendingUp,
  Sparkles, Crown, Plus, Search, Filter, MoreHorizontal, ArrowRight, Award,
  Share2, Building2, Zap, Target, Percent
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useToast } from '@/components/ui/Toast';
import { format } from 'date-fns';

type Referral = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  relationship: string | null;
  status: string;
  rewardStatus: string;
  rewardAmount: number | null;
  rewardCurrency: string;
  referrer: { name: string; email: string };
  program: { name: string; rewardAmount: number; rewardCurrency: string };
  createdAt: string;
  updatedAt: string;
};

type ReferralProgram = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  rewardType: string;
  rewardAmount: number;
  rewardCurrency: string;
  rewardTiming: string;
  minDaysEmployed: number;
};

export default function ReferralsPage() {
  const { t } = useLocale();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'referrals' | 'programs'>('referrals');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [programs, setPrograms] = useState<ReferralProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchReferrals();
    fetchPrograms();
  }, []);

  const fetchReferrals = async () => {
    try {
      const res = await fetch('/api/referrals', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setReferrals(data || []);
      }
    } catch (error) {
      console.error('Error fetching referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrograms = async () => {
    try {
      const res = await fetch('/api/referrals/programs', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPrograms(data.programs || []);
      }
    } catch (error) {
      console.error('Error fetching programs:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'hired':
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'interviewing':
      case 'contacted':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hired':
      case 'paid':
        return 'bg-emerald-100 text-emerald-700';
      case 'interviewing':
        return 'bg-blue-100 text-blue-700';
      case 'contacted':
        return 'bg-brand-100 text-brand-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  };

  const totalRewards = referrals.reduce((sum, r) => sum + (r.rewardAmount || 0), 0);
  const pendingRewards = referrals.filter(r => r.rewardStatus === 'pending').length;
  const hiredCount = referrals.filter(r => r.status === 'hired').length;
  const conversionRate = referrals.length > 0 ? Math.round((hiredCount / referrals.length) * 100) : 0;

  const filteredReferrals = referrals.filter(r => {
    const matchesSearch = r.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         r.candidateEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         r.referrer.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = [
    { id: 'all', name: 'All Status', count: referrals.length },
    { id: 'submitted', name: 'Submitted', count: referrals.filter(r => r.status === 'submitted').length },
    { id: 'contacted', name: 'Contacted', count: referrals.filter(r => r.status === 'contacted').length },
    { id: 'interviewing', name: 'Interviewing', count: referrals.filter(r => r.status === 'interviewing').length },
    { id: 'hired', name: 'Hired', count: hiredCount },
    { id: 'rejected', name: 'Rejected', count: referrals.filter(r => r.status === 'rejected').length },
  ];

  const [newProgram, setNewProgram] = useState({
    name: '',
    description: '',
    rewardType: 'cash',
    rewardAmount: 1000,
    rewardCurrency: 'USD',
    rewardTiming: 'hire',
    minDaysEmployed: 90,
  });
  const [creatingProgram, setCreatingProgram] = useState(false);

  const createProgram = async () => {
    if (!newProgram.name) {
      toast.warning('Please enter a program name');
      return;
    }
    setCreatingProgram(true);
    try {
      const res = await fetch('/api/referrals/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newProgram),
      });
      if (res.ok) {
        const data = await res.json();
        setPrograms(prev => [data.program, ...prev]);
        setShowCreateModal(false);
        setNewProgram({ name: '', description: '', rewardType: 'cash', rewardAmount: 1000, rewardCurrency: 'USD', rewardTiming: 'hire', minDaysEmployed: 90 });
        toast.success('Program created', newProgram.name + ' is now active');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to create program');
      }
    } catch {
      toast.error('Failed to create program');
    } finally {
      setCreatingProgram(false);
    }
  };

  const updateReferralStatus = async (id: string, status: string) => {
    try {
      const res = await fetch('/api/referrals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setReferrals(prev => prev.map(r => r.id === id ? { ...r, status } : r));
        toast.success('Status updated');
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <PageShell>
      {/* Create Program Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-stone-100">
                <h2 className="text-xl font-bold text-stone-900">Create Referral Program</h2>
                <p className="text-sm text-stone-500 mt-1">Set up a new employee referral program</p>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Program Name *</label>
                  <input
                    type="text"
                    value={newProgram.name}
                    onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
                    placeholder="e.g., Engineering Referral Program"
                    className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Description</label>
                  <textarea
                    value={newProgram.description}
                    onChange={(e) => setNewProgram({ ...newProgram, description: e.target.value })}
                    placeholder="Describe the referral program..."
                    rows={3}
                    className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Reward Type</label>
                    <select
                      value={newProgram.rewardType}
                      onChange={(e) => setNewProgram({ ...newProgram, rewardType: e.target.value })}
                      className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none"
                    >
                      <option value="cash">Cash Bonus</option>
                      <option value="gift_card">Gift Card</option>
                      <option value="pto">Extra PTO</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Reward Amount</label>
                    <input
                      type="number"
                      value={newProgram.rewardAmount}
                      onChange={(e) => setNewProgram({ ...newProgram, rewardAmount: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Currency</label>
                    <select
                      value={newProgram.rewardCurrency}
                      onChange={(e) => setNewProgram({ ...newProgram, rewardCurrency: e.target.value })}
                      className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="INR">INR (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Reward Timing</label>
                    <select
                      value={newProgram.rewardTiming}
                      onChange={(e) => setNewProgram({ ...newProgram, rewardTiming: e.target.value })}
                      className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none"
                    >
                      <option value="hire">On Hire</option>
                      <option value="probation_end">After Probation</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Min Days Employed</label>
                  <input
                    type="number"
                    value={newProgram.minDaysEmployed}
                    onChange={(e) => setNewProgram({ ...newProgram, minDaysEmployed: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none"
                  />
                  <p className="text-xs text-stone-400 mt-1">Minimum days the referred candidate must be employed before reward is paid</p>
                </div>
              </div>
              <div className="p-6 border-t border-stone-100 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 border border-stone-200 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createProgram}
                  disabled={creatingProgram}
                  className="px-5 py-2.5 bg-gradient-to-r from-brand-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-brand-500/25 transition-all disabled:opacity-50"
                >
                  {creatingProgram ? 'Creating...' : 'Create Program'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageHeader
        icon={Users}
        title="Employee Referrals"
        subtitle="Track and manage your employee referral program"
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 rounded-lg text-xs font-bold">
            <Crown className="w-3 h-3 inline mr-1" />
            Premium
          </span>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="btn-primary !px-4 !py-2.5 !text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Program
          </motion.button>
        </div>
      </PageHeader>

      {/* Premium Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Referrals"
          value={referrals.length}
          icon={UserPlus}
          iconClassName="text-brand-600 bg-brand-50"
        />
        <StatCard
          label="Successfully Hired"
          value={hiredCount}
          icon={CheckCircle}
          iconClassName="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          label="Conversion Rate"
          value={`${conversionRate}%`}
          icon={Percent}
          iconClassName="text-amber-600 bg-amber-50"
        />
        <StatCard
          label="Total Paid Out"
          value={`$${totalRewards.toLocaleString()}`}
          icon={DollarSign}
          iconClassName="text-sky-600 bg-sky-50"
        />
      </div>

      {/* Search & Filter Bar */}
      {activeTab === 'referrals' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <input
                type="text"
                placeholder="Search referrals, candidates, or employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusOptions.map((status) => (
              <button
                key={status.id}
                onClick={() => setStatusFilter(status.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  statusFilter === status.id
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/25'
                    : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'
                }`}
              >
                {status.name}
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  statusFilter === status.id ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                }`}>
                  {status.count}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Premium Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200">
        <button
          onClick={() => setActiveTab('referrals')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'referrals'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          <Users className="w-4 h-4" />
          All Referrals
          <span className="ml-1.5 px-2 py-0.5 text-xs bg-stone-100 text-stone-600 rounded-full">
            {referrals.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('programs')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'programs'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          <Award className="w-4 h-4" />
          Programs
          {programs.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 text-xs bg-brand-100 text-brand-700 rounded-full font-semibold">
              {programs.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden"
      >
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-stone-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : activeTab === 'referrals' ? (
          <div className="divide-y divide-stone-100">
            {filteredReferrals.length === 0 ? (
              <EmptyState
                message={searchQuery || statusFilter !== 'all' ? 'No referrals match your filters' : 'No referrals submitted yet'}
                icon={Users}
                subMessage={searchQuery || statusFilter !== 'all' ? 'Try adjusting your search' : 'Employees can submit referrals from their dashboard'}
              />
            ) : (
              filteredReferrals.map((referral, index) => (
                <motion.div
                  key={referral.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 sm:p-5 hover:bg-stone-50/50 transition-colors group cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      referral.status === 'hired'
                        ? 'bg-emerald-50 border border-emerald-200'
                        : referral.status === 'rejected'
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-brand-50 border border-brand-100'
                    }`}>
                      <Gift className={`w-5 h-5 ${
                        referral.status === 'hired'
                          ? 'text-emerald-600'
                          : referral.status === 'rejected'
                          ? 'text-red-600'
                          : 'text-brand-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-stone-900 group-hover:text-brand-600 transition-colors">{referral.candidateName}</h3>
                            {referral.status === 'hired' && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                                <CheckCircle className="w-3 h-3 inline mr-1" />
                                Hired
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-stone-500">{referral.candidateEmail}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg ${getStatusColor(referral.status)}`}>
                            {getStatusIcon(referral.status)}
                            <span className="capitalize">{referral.status}</span>
                          </span>
                          <button className="p-2 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-600 opacity-0 group-hover:opacity-100 transition-all">
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-stone-500">
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-md">
                          <Users className="w-3.5 h-3.5" />
                          Referred by: <span className="font-medium text-stone-700">{referral.referrer.name}</span>
                        </span>
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-md">
                          <Award className="w-3.5 h-3.5" />
                          {referral.program.name}
                        </span>
                        {referral.relationship && (
                          <span className="flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-md">
                            <Share2 className="w-3.5 h-3.5" />
                            {referral.relationship}
                          </span>
                        )}
                        <span className="text-stone-400">
                          {format(new Date(referral.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                      {referral.rewardAmount !== null && (
                        <div className="flex items-center gap-2 mt-3">
                          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                            referral.rewardStatus === 'paid'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {referral.rewardStatus === 'paid' ? (
                              <><CheckCircle className="w-3.5 h-3.5" /> Reward Paid: {referral.rewardCurrency} {referral.rewardAmount}</>
                            ) : (
                              <><Clock className="w-3.5 h-3.5" /> Reward Pending: {referral.rewardCurrency} {referral.rewardAmount}</>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {programs.length === 0 ? (
              <EmptyState
                message="No referral programs active"
                icon={Award}
                subMessage="Create a referral program to incentivize employee recommendations"
              />
            ) : (
              programs.map((program, index) => (
                <motion.div
                  key={program.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 sm:p-5 hover:bg-stone-50/50 transition-colors group cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      program.isActive
                        ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200'
                        : 'bg-stone-50 border border-stone-200'
                    }`}>
                      <Award className={`w-5 h-5 ${program.isActive ? 'text-emerald-600' : 'text-stone-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-stone-900 group-hover:text-brand-600 transition-colors">{program.name}</h3>
                            {program.isActive && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                                <Zap className="w-3 h-3 inline mr-1" />
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-stone-500">{program.description || 'No description'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${
                            program.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'
                          }`}>
                            {program.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <button className="p-2 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-600 opacity-0 group-hover:opacity-100 transition-all">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-stone-500">
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-md">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span className="font-medium text-stone-700">{program.rewardCurrency} {program.rewardAmount}</span>
                          <span>reward</span>
                        </span>
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-md capitalize">
                          <Gift className="w-3.5 h-3.5" />
                          {program.rewardType}
                        </span>
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-md capitalize">
                          <Clock className="w-3.5 h-3.5" />
                          {program.rewardTiming}
                        </span>
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-md">
                          <Building2 className="w-3.5 h-3.5" />
                          {program.minDaysEmployed} days min
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </motion.div>

      {/* Quick Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
          <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center mb-3">
            <Target className="w-5 h-5 text-emerald-600" />
          </div>
          <h4 className="font-semibold text-stone-900 mb-1">Higher Quality Candidates</h4>
          <p className="text-sm text-stone-500">Referred candidates are 5x more likely to be hired</p>
        </div>
        <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
          <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <h4 className="font-semibold text-stone-900 mb-1">Faster Hiring</h4>
          <p className="text-sm text-stone-500">Referrals move through the pipeline 55% faster</p>
        </div>
        <div className="p-5 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100">
          <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <h4 className="font-semibold text-stone-900 mb-1">Better Retention</h4>
          <p className="text-sm text-stone-500">Referred employees stay 70% longer on average</p>
        </div>
      </motion.div>
    </PageShell>
  );
}
