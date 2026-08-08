'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Search, MapPin, Building2, Clock, ArrowRight,
  Briefcase, Filter, X, Globe, Sparkles,
  Users, ChevronRight, ExternalLink, Mail,
  ChevronLeft,
} from 'lucide-react';
import { CareersChatbot } from '@/components/careers/CareersChatbot';

const DEPT_COLORS: Record<string, string> = {
  Engineering:   'bg-blue-100 text-blue-700 border-blue-200',
  Design:        'bg-violet-100 text-violet-700 border-violet-200',
  Marketing:     'bg-pink-100 text-pink-700 border-pink-200',
  Sales:         'bg-amber-100 text-amber-700 border-amber-200',
  Product:       'bg-teal-100 text-teal-700 border-teal-200',
  Operations:    'bg-orange-100 text-orange-700 border-orange-200',
  Finance:       'bg-emerald-100 text-emerald-700 border-emerald-200',
  HR:            'bg-rose-100 text-rose-700 border-rose-200',
  Legal:         'bg-slate-100 text-slate-700 border-slate-200',
};
const deptColor = (dept: string) => DEPT_COLORS[dept] ?? 'bg-stone-100 text-stone-600 border-stone-200';

const TYPE_DOTS: Record<string, string> = {
  'Full-time':  'bg-emerald-500',
  'Part-time':  'bg-amber-500',
  'Contract':   'bg-blue-500',
  'Internship': 'bg-violet-500',
  'Remote':     'bg-teal-500',
};

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  postedAt: string;
  applicants: number;
}

interface Filters {
  departments: string[];
  locations: string[];
  types: string[];
}

interface CompanyInfo {
  name: string;
  logoUrl?: string;
  heroTitle: string;
  heroSubtitle?: string;
  heroBackground?: string;
  primaryColor: string;
  secondaryColor: string;
  description?: string;
  website?: string;
  showBenefits: boolean;
  showTeamPhotos: boolean;
  benefits: { icon: string; title: string; description: string }[];
  teamMembers: { name: string; role: string; photoUrl?: string; bio?: string }[];
  socialLinks: { platform: string; url: string }[];
}

interface CareersClientProps {
  initialJobs: Job[];
  initialFilters: Filters;
  company?: CompanyInfo | null;
  companySlug?: string;
}

export default function CareersClient({ initialJobs, initialFilters, company, companySlug }: CareersClientProps) {
  const JOBS_PER_PAGE = 8;
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [filters] = useState<Filters>(initialFilters);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (companySlug) params.set('company', companySlug);
      if (searchQuery) params.set('search', searchQuery);
      if (selectedDepartment !== 'all') params.set('department', selectedDepartment);
      if (selectedLocation !== 'all') params.set('location', selectedLocation);
      if (selectedType !== 'all') params.set('type', selectedType);

      const res = await fetch(`/api/careers/jobs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedDepartment, selectedLocation, selectedType, companySlug]);

  useEffect(() => {
    const timer = setTimeout(fetchJobs, 300);
    return () => clearTimeout(timer);
  }, [fetchJobs]);

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const clearFilters = () => {
    setSelectedDepartment('all');
    setSelectedLocation('all');
    setSelectedType('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const hasActiveFilters = selectedDepartment !== 'all' || selectedLocation !== 'all' || selectedType !== 'all';

  const totalPages = Math.ceil(jobs.length / JOBS_PER_PAGE);
  const paginatedJobs = jobs.slice((currentPage - 1) * JOBS_PER_PAGE, currentPage * JOBS_PER_PAGE);

  const heroBg = company?.heroBackground
    ? company.heroBackground
    : `linear-gradient(135deg, ${company?.primaryColor ?? '#0d9488'} 0%, ${company?.secondaryColor ?? '#14b8a6'} 100%)`;

  return (
    <div className="bg-white">


      {/* ── Hero Section ───────────────────────────────────────────── */}
      <section
        id="hero"
        className="relative overflow-hidden text-white"
        style={{ background: heroBg }}
      >
        {/* Fine dot-grid */}
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        {/* Glow blobs */}
        <div className="absolute -top-32 -left-16 w-[500px] h-[500px] rounded-full bg-white/8 blur-3xl" />
        <div className="absolute top-1/2 -right-24 w-72 h-72 rounded-full bg-black/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-t from-black/20 to-transparent" />
        {/* Subtle grid lines */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '80px 80px' }} />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <div className="text-center">

            {/* Company logo */}
            {company?.logoUrl && (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.05, duration: 0.4 }} className="mb-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={company.logoUrl} alt={company.name} className="h-14 mx-auto object-contain drop-shadow-2xl" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </motion.div>
            )}

            {/* Hiring badge */}
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 border border-white/25 backdrop-blur-md text-white text-xs font-bold mb-8 shadow-xl"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              {jobs.length > 0 ? `${jobs.length} open role${jobs.length !== 1 ? 's' : ''} · Apply today` : (company?.name ? `${company.name} is Hiring` : "We're Hiring")}
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.55 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight mb-6 leading-[1.02]"
            >
              {company?.heroTitle ?? 'Join Our Team'}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, duration: 0.5 }}
              className="text-base sm:text-lg lg:text-xl text-white/75 mb-10 leading-relaxed max-w-2xl mx-auto font-medium"
            >
              {company?.heroSubtitle ?? company?.description ?? "We build things that matter. Join a team of passionate people who love their craft and ship great products."}
            </motion.p>

            {/* Single strong CTA */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16"
            >
              <a
                href="#jobs"
                className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-white font-extrabold text-stone-900 shadow-2xl shadow-black/25 hover:shadow-black/40 hover:scale-[1.03] transition-all text-sm"
              >
                View Open Positions
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
              {company?.showBenefits && (
                <a
                  href="#benefits"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/12 backdrop-blur-sm border border-white/25 font-semibold text-white hover:bg-white/20 transition-all text-sm"
                >
                  Life & Benefits
                </a>
              )}
            </motion.div>

            {/* Stats strip */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52, duration: 0.5 }}
              className="flex items-center justify-center gap-0 max-w-lg mx-auto rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm overflow-hidden"
            >
              {[
                { value: jobs.length || '—', label: 'Open Roles', icon: Briefcase },
                { value: filters.departments.length || '—', label: 'Departments', icon: Building2 },
                { value: 'Remote OK', label: 'Work Style', icon: Globe },
              ].map(({ value, label, icon: Icon }, i) => (
                <div key={label} className={`flex-1 flex flex-col items-center py-4 px-2 ${i < 2 ? 'border-r border-white/15' : ''}`}>
                  <Icon className="w-3.5 h-3.5 text-white/50 mb-1.5" />
                  <p className="text-xl sm:text-2xl font-black text-white leading-none">{value}</p>
                  <p className="text-[10px] sm:text-[11px] text-white/55 mt-1 font-semibold tracking-wide uppercase">{label}</p>
                </div>
              ))}
            </motion.div>

            {/* Scroll cue */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.5 }}
              className="mt-12 flex flex-col items-center gap-1.5 opacity-40"
            >
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white">Scroll to explore</span>
              <motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}>
                <ChevronRight className="w-4 h-4 text-white rotate-90" />
              </motion.div>
            </motion.div>

          </div>
        </div>

        {/* Smooth wave bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 72" fill="white" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-10 sm:h-16 lg:h-[72px]">
            <path d="M0,72 C240,20 480,60 720,36 C960,12 1200,52 1440,28 L1440,72 Z" />
          </svg>
        </div>
      </section>

      {/* Search & Filters */}
      <section id="jobs" className="sticky top-[68px] z-30 bg-white/90 backdrop-blur-xl border-b border-stone-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <input
                type="text"
                placeholder="Search by title, department, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none transition-all text-stone-900 placeholder:text-stone-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-stone-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-stone-500" />
                </button>
              )}
            </div>

            {/* Desktop Filters */}
            <div className="hidden lg:flex items-center gap-3">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none transition-all text-stone-900 min-w-[160px]"
              >
                <option value="all">All Departments</option>
                {filters.departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>

              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none transition-all text-stone-900 min-w-[160px]"
              >
                <option value="all">All Locations</option>
                {filters.locations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none transition-all text-stone-900 min-w-[140px]"
              >
                <option value="all">All Types</option>
                {filters.types.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Mobile Filter Button */}
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="lg:hidden flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 font-medium text-stone-700"
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-brand-500" />
              )}
            </button>
          </div>

          {/* Mobile Filters */}
          <AnimatePresence>
            {showMobileFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="lg:hidden overflow-hidden"
              >
                <div className="pt-4 space-y-3">
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 outline-none text-stone-900"
                  >
                    <option value="all">All Departments</option>
                    {filters.departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>

                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 outline-none text-stone-900"
                  >
                    <option value="all">All Locations</option>
                    {filters.locations.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>

                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-brand-500 outline-none text-stone-900"
                  >
                    <option value="all">All Types</option>
                    {filters.types.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-100">
              <span className="text-sm text-stone-500">Active filters:</span>
              {selectedDepartment !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-sm font-medium">
                  {selectedDepartment}
                  <button onClick={() => setSelectedDepartment('all')} className="hover:bg-brand-100 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedLocation !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-sm font-medium">
                  {selectedLocation}
                  <button onClick={() => setSelectedLocation('all')} className="hover:bg-brand-100 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedType !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-sm font-medium">
                  {selectedType}
                  <button onClick={() => setSelectedType('all')} className="hover:bg-brand-100 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-sm text-stone-500 hover:text-brand-600 underline ml-2"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Jobs List */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-stone-100 animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center mx-auto mb-5 shadow-inner">
              <Briefcase className="w-9 h-9 text-stone-400" />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2">No open positions found</h3>
            <p className="text-stone-500 max-w-md mx-auto text-sm leading-relaxed">
              We don&apos;t have positions matching your criteria right now.
              Check back soon or clear your filters.
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-6 px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors">
                Clear Filters
              </button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold text-stone-500">
                <span className="text-stone-900 font-extrabold text-base">{jobs.length}</span> open position{jobs.length !== 1 ? 's' : ''}
              </p>
              {totalPages > 1 && (
                <p className="text-sm text-stone-400">Page {currentPage} of {totalPages}</p>
              )}
            </div>

            {paginatedJobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Link href={`/careers/${job.id}`}>
                  <div className="group relative bg-white rounded-2xl border border-stone-200/80 overflow-hidden hover:border-stone-300 hover:shadow-xl hover:shadow-stone-200/60 transition-all duration-300 cursor-pointer">
                    {/* Left accent bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl opacity-70 group-hover:opacity-100 transition-opacity"
                      style={{ background: `linear-gradient(to bottom, ${company?.primaryColor ?? '#0d9488'}, ${company?.secondaryColor ?? '#14b8a6'})` }}
                    />
                    <div className="pl-6 pr-5 sm:pr-7 py-5 sm:py-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Badges row */}
                          <div className="flex flex-wrap items-center gap-2 mb-2.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${deptColor(job.department)}`}>
                              <Building2 className="w-3 h-3" />
                              {job.department}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-600">
                              <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOTS[job.type] ?? 'bg-stone-400'}`} />
                              {job.type}
                            </span>
                          </div>
                          {/* Title */}
                          <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 group-hover:text-brand-600 transition-colors leading-tight mb-2">
                            {job.title}
                          </h3>
                          {/* Meta */}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 font-medium">
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5" />{job.location}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />Posted {formatTimeAgo(job.postedAt)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5" />{job.applicants} applicant{job.applicants !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        {/* Apply CTA */}
                        <div className="flex-shrink-0">
                          <motion.div
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-md group-hover:shadow-lg transition-all"
                            style={{ background: `linear-gradient(135deg, ${company?.primaryColor ?? '#0d9488'}, ${company?.secondaryColor ?? '#14b8a6'})` }}
                            whileHover={{ scale: 1.04 }}
                          >
                            Apply Now
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
        {/* ── Pagination ─────────────────────────────────────────── */}
        {totalPages > 1 && !isLoading && jobs.length > 0 && (
          <div className="flex items-center justify-center gap-2 mt-8 pt-6 border-t border-stone-100">
            <button
              onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              disabled={currentPage === 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 text-sm font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                const isActive = page === currentPage;
                const isNearby = Math.abs(page - currentPage) <= 1 || page === 1 || page === totalPages;
                if (!isNearby && (page === 2 || page === totalPages - 1)) {
                  return <span key={page} className="px-1 text-stone-400 text-sm">…</span>;
                }
                if (!isNearby) return null;
                return (
                  <button
                    key={page}
                    onClick={() => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${
                      isActive
                        ? 'text-white shadow-md shadow-brand-500/30'
                        : 'text-stone-600 border border-stone-200 hover:bg-stone-50'
                    }`}
                    style={isActive ? { background: `linear-gradient(135deg, ${company?.primaryColor ?? '#0d9488'}, ${company?.secondaryColor ?? '#14b8a6'})` } : {}}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 text-sm font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>

      {/* Benefits Section */}
      {company?.showBenefits && company.benefits.length > 0 && (
        <section id="benefits" className="py-20 sm:py-24 bg-gradient-to-b from-stone-50 to-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, #0d9488 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="text-center mb-12"
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold uppercase tracking-widest mb-4">
                <Sparkles className="w-3.5 h-3.5" /> Why join us
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-stone-900 mb-3">Built for people who care</h2>
              <p className="text-stone-500 max-w-xl mx-auto">
                We invest in our team because great work comes from happy people.
              </p>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {company.benefits.map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="group bg-white rounded-2xl border border-stone-200/80 p-6 hover:shadow-lg hover:border-brand-200 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <span className="text-4xl mb-4 block">{b.icon}</span>
                  <h3 className="font-extrabold text-stone-900 mb-2 text-base">{b.title}</h3>
                  <p className="text-sm text-stone-500 leading-relaxed">{b.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Team Section */}
      {company?.showTeamPhotos && company.teamMembers.length > 0 && (
        <section id="team" className="py-20 sm:py-24 bg-stone-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="text-center mb-12"
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold uppercase tracking-widest mb-4">
                <Users className="w-3.5 h-3.5" /> Our people
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-stone-900 mb-3">Meet the team</h2>
              <p className="text-stone-500 max-w-xl mx-auto">Talented people passionate about what they build</p>
            </motion.div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
              {company.teamMembers.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.93 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="group text-center"
                >
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl mx-auto mb-3 overflow-hidden border-2 border-stone-200 bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center group-hover:scale-105 transition-transform duration-300 shadow-sm">
                    {m.photoUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      : <span className="text-2xl font-black" style={{ color: company?.primaryColor ?? '#0d9488' }}>{m.name.charAt(0)}</span>}
                  </div>
                  <p className="font-extrabold text-stone-900 text-sm">{m.name}</p>
                  <p className="text-xs text-stone-500 mt-0.5 font-medium">{m.role}</p>
                  {m.bio && <p className="text-xs text-stone-400 mt-1.5 line-clamp-2 leading-relaxed">{m.bio}</p>}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section
        className="relative text-white py-20 sm:py-28 overflow-hidden"
        style={{ background: heroBg }}
      >
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center mx-auto mb-6">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Don&apos;t see the right fit?</h2>
            <p className="text-white/75 max-w-lg mx-auto mb-8 text-lg leading-relaxed">
              We&apos;re always looking for talented people. Send us your resume and we&apos;ll keep you in mind for future opportunities.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={company?.website ? `mailto:careers@${new URL(company.website.startsWith('http') ? company.website : 'https://' + company.website).hostname}` : 'mailto:careers@devlumiq.com'}
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-white text-stone-900 font-extrabold hover:bg-white/90 hover:scale-[1.02] transition-all shadow-xl shadow-black/25 text-sm"
              >
                <Mail className="w-4 h-4" />
                Send General Application
              </a>
              {company?.website && (
                <a
                  href={company.website} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/30 text-white font-bold hover:bg-white/25 transition-all text-sm"
                >
                  <Globe className="w-4 h-4" />
                  Visit Website
                </a>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      <CareersChatbot companySlug={companySlug} />
    </div>
  );
}
