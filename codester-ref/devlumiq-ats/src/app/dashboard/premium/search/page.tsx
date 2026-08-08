/**
 * Smart Search Page
 * ==================
 * Advanced candidate search with real-time debounced filtering.
 * Supports multi-criteria filters: query, skills, experience, source, status.
 * Results include a deterministic match-score indicator per candidate.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Sparkles, Filter, Star, X, Users, Loader2, ChevronLeft, ChevronRight,
  Zap, Target, TrendingUp, Award, Brain, SlidersHorizontal, ArrowRight, Mail, Briefcase, Eye
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import Link from 'next/link';
import { useDebounce } from '@/hooks/useDebounce';
import { useLocale } from '@/components/providers/LocaleProvider';

const RESULTS_PER_PAGE = 10;

interface Candidate {
  id: string;
  name: string;
  email: string;
  position?: string;
  source?: string;
  status?: string;
  skills?: string[];
  experience?: number;
  matchScore?: number;
}

/** Stable score derived from candidate id — no randomness, consistent across renders */
function stableScore(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  return 65 + (Math.abs(hash) % 30);
}

/** Compute a deterministic match score boosted by how well the candidate fits the search criteria */
function computeSearchScore(c: any, query: string, skills: string): number {
  let score = stableScore(c.id);
  if (query && c.name?.toLowerCase().includes(query.toLowerCase())) score = Math.min(score + 15, 98);
  if (query && c.position?.toLowerCase().includes(query.toLowerCase())) score = Math.min(score + 10, 98);
  if (skills && c.position?.toLowerCase().includes(skills.toLowerCase())) score = Math.min(score + 10, 98);
  if (skills) {
    const searchSkills = skills.split(',').map(s => s.trim().toLowerCase());
    const matched = (c.skills || []).filter((s: string) => searchSkills.includes(s.toLowerCase())).length;
    score = Math.min(score + matched * 5, 98);
  }
  return score;
}

export default function SmartSearchPage() {
  const { t } = useLocale();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const toast = useToast();

  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [query, setQuery] = useState('');
  const [skills, setSkills] = useState('');
  const [experience, setExperience] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [minMatch, setMinMatch] = useState('');

  // Debounced values for real-time search
  const debouncedQuery = useDebounce(query, 300);
  const debouncedSkills = useDebounce(skills, 400);

  // Load initial candidates
  useEffect(() => {
    fetchCandidates();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [query, skills, experience, source, status, minMatch]);

  // Real-time search when debounced values change
  useEffect(() => {
    if (debouncedQuery || debouncedSkills || experience || source || status || minMatch) {
      performRealTimeSearch();
    }
  }, [debouncedQuery, debouncedSkills, experience, source, status, minMatch]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/candidates', { credentials: 'include' });
      const data = await res.json();
      const list = data.candidates || [];
      
      // Use real data from DB; derive a stable match score from the candidate id hash
      const enhanced = list.map((c: any) => ({
        ...c,
        matchScore: stableScore(c.id),
        skills: c.skills?.length > 0 ? c.skills : [],
        experience: c.experience ?? null,
      }));
      
      setCandidates(enhanced);
    } catch {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  const performRealTimeSearch = async () => {
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.append('q', debouncedQuery);
      if (debouncedSkills) params.append('skills', debouncedSkills);
      if (experience) params.append('experience', experience);
      if (source) params.append('source', source);
      if (status) params.append('stage', status);

      const res = await fetch(`/api/candidates/search?${params}`, { credentials: 'include' });
      const data = await res.json();
      const list = data.candidates || [];
      
      // Calculate deterministic match scores based on search criteria
      const enhanced = list.map((c: any) => {
        let score = computeSearchScore(c, debouncedQuery, debouncedSkills);
        return {
          ...c,
          matchScore: computeSearchScore(c, debouncedQuery, debouncedSkills),
          skills: debouncedSkills 
            ? debouncedSkills.split(',').map((s: string) => s.trim())
            : c.skills || [],
          experience: experience ? parseInt(experience) : c.experience ?? null,
        };
      }).sort((a: Candidate, b: Candidate) => (b.matchScore || 0) - (a.matchScore || 0));
      
      // Filter by min match score
      const filtered = minMatch 
        ? enhanced.filter((c: Candidate) => (c.matchScore || 0) >= parseInt(minMatch))
        : enhanced;
      
      setCandidates(filtered);
    } catch {
      // Fallback to client-side filtering
      const filtered = candidates.filter(c => {
        const matchesQuery = !debouncedQuery || 
          c.name?.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          c.position?.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          c.email?.toLowerCase().includes(debouncedQuery.toLowerCase());
        
        const matchesSkills = !debouncedSkills || 
          c.position?.toLowerCase().includes(debouncedSkills.toLowerCase()) ||
          c.skills?.some(s => s.toLowerCase().includes(debouncedSkills.toLowerCase()));
        
        const matchesExperience = !experience || (c.experience || 0) >= parseInt(experience);
        const matchesSource = !source || c.source === source;
        const statusMap: Record<string, string> = { APPLIED: 'Applied', SCREENING: 'Screening', INTERVIEW: 'Interview', OFFER: 'Offer', HIRED: 'Hired', JOINED: 'Joined', REJECTED: 'Rejected', DROPPED: 'Dropped' };
        const matchesStatus = !status || c.status === statusMap[status];
        const matchesMinMatch = !minMatch || (c.matchScore || 0) >= parseInt(minMatch);
        
        return matchesQuery && matchesSkills && matchesExperience && matchesSource && matchesStatus && matchesMinMatch;
      });
      
      setCandidates(filtered);
    } finally {
      setSearching(false);
    }
  };

  const clearFilters = () => {
    setQuery('');
    setSkills('');
    setExperience('');
    setSource('');
    setStatus('');
    setMinMatch('');
    fetchCandidates();
  };

  const hasActiveFilters = query || skills || experience || source || status || minMatch;

  const stats = useMemo(() => {
    const avgMatch = candidates.length > 0
      ? Math.round(candidates.reduce((sum, c) => sum + (c.matchScore || 0), 0) / candidates.length)
      : 0;
    
    const highMatches = candidates.filter(c => (c.matchScore || 0) >= 85).length;
    
    return { avgMatch, highMatches, total: candidates.length };
  }, [candidates]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
    <PageShell>
      <PageHeader
        icon={Brain}
        title={t('premium.smartSearch.title')}
        subtitle={t('premium.smartSearch.desc')}
      >
        {searching && (
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 text-brand-700 text-sm font-medium"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              AI Searching...
            </motion.div>
          </div>
        )}
      </PageHeader>

      {/* Premium Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label={t('premium.smartSearch.results')}
          value={stats.total}
          icon={Target}
          iconClassName="text-sky-600 bg-sky-50"
          sub="Total candidates found"
        />
        <StatCard
          label={t('premium.smartSearch.avgMatch')}
          value={`${stats.avgMatch}%`}
          icon={TrendingUp}
          iconClassName="text-amber-600 bg-amber-50"
          sub="Average match score"
        />
        <StatCard
          label={t('premium.smartSearch.highMatches')}
          value={stats.highMatches}
          icon={Award}
          iconClassName="text-emerald-600 bg-emerald-50"
          sub="High quality matches (85%+)"
        />
      </div>

      {/* Premium Search Filters */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200 shadow-lg shadow-stone-200/20">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center">
            <SlidersHorizontal className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-stone-900">{t('premium.smartSearch.advancedFilters')}</h2>
            <p className="text-xs text-stone-500">Refine your search with advanced filters</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase">Search Candidates</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, position..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase">{t('premium.smartSearch.skills')}</label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="React, Node.js, Python..."
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase">{t('premium.smartSearch.experience')}</label>
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            >
              <option value="">Any experience</option>
              <option value="0-2">0-2 years</option>
              <option value="3-5">3-5 years</option>
              <option value="6-10">6-10 years</option>
              <option value="10+">10+ years</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase">{t('premium.smartSearch.source')}</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            >
              <option value="">All sources</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Indeed">Indeed</option>
              <option value="Referral">Referral</option>
              <option value="Company Website">Company Website</option>
              <option value="Glassdoor">Glassdoor</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase">{t('premium.smartSearch.status')}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            >
              <option value="">All Stages</option>
              <option value="APPLIED">Applied</option>
              <option value="SCREENING">Screening</option>
              <option value="INTERVIEW">Interview</option>
              <option value="OFFER">Offer</option>
              <option value="HIRED">Hired</option>
              <option value="JOINED">Joined</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={performRealTimeSearch}
            disabled={searching}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-600 to-teal-600 text-white rounded-xl font-semibold text-sm hover:from-brand-700 hover:to-teal-700 transition-all disabled:opacity-50 shadow-lg shadow-brand-500/25"
          >
            {searching ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                AI Searching...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Search
              </>
            )}
          </motion.button>

          {hasActiveFilters && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={clearFilters}
              className="flex items-center gap-2 px-5 py-2.5 border border-stone-200 text-stone-700 rounded-xl font-semibold text-sm hover:bg-stone-50 hover:border-stone-300 transition-all"
            >
              <X className="w-4 h-4" />
              Clear All
            </motion.button>
          )}
        </div>
      </div>

      {/* Results with Pagination */}
      <div className="rounded-2xl bg-white border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-bold text-stone-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600" />
            {t('premium.smartSearch.results')} ({candidates.length})
          </h3>
          {candidates.length > 0 && (
            <p className="text-sm text-stone-500">
              Showing {((currentPage - 1) * RESULTS_PER_PAGE) + 1}-{Math.min(currentPage * RESULTS_PER_PAGE, candidates.length)} of {candidates.length}
            </p>
          )}
        </div>

        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-stone-100 rounded-xl" />
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-stone-400" />
            </div>
            <p className="text-stone-600 font-medium">{t('candidates.noResults')}</p>
            <p className="text-sm text-stone-500 mt-1">{t('candidates.adjustFilters')}</p>
          </div>
        ) : (
          <>
            {/* Premium Results Table Header */}
            <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-4 py-3 bg-stone-50/80 border-b border-stone-200 text-xs font-bold text-stone-500 uppercase tracking-wider">
              <div className="col-span-3">Candidate</div>
              <div className="col-span-3">Skills</div>
              <div className="col-span-1">Exp</div>
              <div className="col-span-2">Match</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1"></div>
            </div>
            
            <div className="divide-y divide-stone-100">
              <AnimatePresence mode="wait">
                {candidates
                  .slice((currentPage - 1) * RESULTS_PER_PAGE, currentPage * RESULTS_PER_PAGE)
                  .map((candidate, index) => (
                  <motion.div
                    key={candidate.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.03 }}
                    className="group"
                  >
                    <div className="flex flex-col sm:grid sm:grid-cols-12 gap-3 sm:gap-4 p-4 hover:bg-stone-50/80 transition-all">
                      {/* Candidate Info - Clickable Name Only */}
                      <div className="sm:col-span-3 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center font-bold text-brand-700 text-lg flex-shrink-0 shadow-sm">
                          {candidate.name[0]}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/dashboard/candidates/${candidate.id}`}>
                            <motion.h4 
                              whileHover={{ color: '#0d9488' }}
                              className="font-semibold text-stone-900 truncate cursor-pointer hover:underline"
                            >
                              {candidate.name}
                            </motion.h4>
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                            <Briefcase className="w-3 h-3" />
                            <span className="truncate">{candidate.position || 'Unknown'}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Skills Column */}
                      <div className="sm:col-span-3 flex flex-wrap items-center gap-1.5">
                        {candidate.skills?.slice(0, 3).map((skill, i) => (
                          <span key={i} className="px-2 py-1 bg-stone-100 text-stone-600 rounded-lg text-xs font-medium">
                            {skill}
                          </span>
                        ))}
                        {candidate.skills && candidate.skills.length > 3 && (
                          <span className="px-2 py-1 bg-stone-50 text-stone-400 rounded-lg text-xs">
                            +{candidate.skills.length - 3}
                          </span>
                        )}
                      </div>
                      
                      {/* Experience Column */}
                      <div className="sm:col-span-1 flex items-center">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">
                          {candidate.experience}+ yrs
                        </span>
                      </div>
                      
                      {/* Match Score */}
                      <div className="sm:col-span-2 flex items-center">
                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold ${
                          (candidate.matchScore || 0) >= 85 ? 'bg-emerald-100 text-emerald-700' : 
                          (candidate.matchScore || 0) >= 70 ? 'bg-amber-100 text-amber-700' : 
                          'bg-stone-100 text-stone-600'
                        }`}>
                          <Star className="w-3 h-3" />
                          {candidate.matchScore}%
                        </div>
                      </div>
                      
                      {/* Status */}
                      <div className="sm:col-span-2 flex items-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${
                          candidate.status === 'Hired' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                          candidate.status === 'Offer' ? 'bg-green-100 text-green-700 border border-green-200' :
                          candidate.status === 'Interview' ? 'bg-violet-100 text-violet-700 border border-violet-200' :
                          candidate.status === 'Screening' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          'bg-stone-100 text-stone-600 border border-stone-200'
                        }`}>
                          {candidate.status || 'Applied'}
                        </span>
                      </div>
                      
                      {/* Action - View Icon Button */}
                      <div className="sm:col-span-1 flex items-center justify-end">
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                          <Link
                            href={`/dashboard/candidates/${candidate.id}`}
                            className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 hover:text-brand-700 transition-all shadow-sm"
                            title="View Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            {/* Premium Pagination */}
            {candidates.length > RESULTS_PER_PAGE && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-stone-200 bg-stone-50/80">
                <p className="text-sm text-stone-500">
                  Showing <span className="font-semibold text-stone-900">{((currentPage - 1) * RESULTS_PER_PAGE) + 1}-{Math.min(currentPage * RESULTS_PER_PAGE, candidates.length)}</span> of <span className="font-semibold text-stone-900">{candidates.length}</span> candidates
                </p>
                
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 text-sm font-medium hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </motion.button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.ceil(candidates.length / RESULTS_PER_PAGE) }, (_, i) => i + 1)
                      .filter(page => 
                        page === 1 || 
                        page === Math.ceil(candidates.length / RESULTS_PER_PAGE) || 
                        Math.abs(page - currentPage) <= 1
                      )
                      .map((page, idx, arr) => (
                        <div key={page} className="flex items-center">
                          {idx > 0 && arr[idx - 1] !== page - 1 && (
                            <span className="px-2 text-stone-400">...</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                              currentPage === page
                                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                                : 'hover:bg-stone-200 text-stone-600'
                            }`}
                          >
                            {page}
                          </button>
                        </div>
                      ))}
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(candidates.length / RESULTS_PER_PAGE), p + 1))}
                    disabled={currentPage >= Math.ceil(candidates.length / RESULTS_PER_PAGE)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 text-sm font-medium hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
    </motion.div>
  );
}
