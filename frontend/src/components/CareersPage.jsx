import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Search, MapPin, Briefcase, Clock, Building2, ArrowRight, Sparkles,
  ChevronLeft, ChevronRight, Filter, IndianRupee,
} from 'lucide-react';
import API_URL from '../config';
import { employmentLabel } from './jobs/jobsConstants';
import CareersChatbotWidget from './CareersChatbotWidget';
import PublicAnnouncementBanner from './PublicAnnouncementBanner';
import PremiumSelect from './ui/PremiumSelect';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { resolveOrgLogoSrc } from '../utils/orgLogo';

const PAGE_SIZE = 12;

function priorityRank(p) {
  const key = String(p || '').toLowerCase();
  if (key === 'urgent') return 0;
  if (key === 'high') return 1;
  if (key === 'medium') return 2;
  return 3;
}

function postedDate(job) {
  return job.openedAt || job.publishedAt || job.createdAt || job.updatedAt;
}

function formatPosted(job) {
  const d = postedDate(job);
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

function displayTitle(str) {
  return String(str || '').trim() || 'Untitled role';
}

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured first' },
  { value: 'newest', label: 'Newest first' },
  { value: 'title', label: 'Title A–Z' },
];

const CareersPage = () => {
  const { orgSlug } = useParams();
  const [orgData, setOrgData] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [locFilter, setLocFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchCareers = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/careers/${orgSlug}`);
        if (!res.ok) throw new Error('Careers page not found');
        const data = await res.json();
        const payload = data.data || data;
        setOrgData(payload.organization || {});
        setJobs(payload.jobs || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCareers();
  }, [orgSlug]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, deptFilter, locFilter, typeFilter, sortBy]);

  const brand = orgData?.brandColor || '#0d9488';
  const logoSrc = resolveOrgLogoSrc(orgData?.logo);
  const pageTitle = orgData?.careersPageTitle
    || orgData?.settings?.careersPageTitle
    || `Careers · ${orgData?.name || 'Openings'}`;
  const pageDesc = orgData?.careersPageDescription
    || orgData?.settings?.careersPageDescription
    || 'Explore current openings and submit your application online.';

  const featuredCount = useMemo(
    () => jobs.filter((j) => String(j.priority || '').toLowerCase() === 'urgent').length,
    [jobs],
  );

  const departmentOptions = useMemo(() => [
    { value: '', label: 'All departments' },
    ...[...new Set(jobs.map((j) => j.department).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((d) => ({ value: d, label: d })),
  ], [jobs]);

  const locationOptions = useMemo(() => [
    { value: '', label: 'All locations' },
    ...[...new Set(jobs.map((j) => j.location).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((l) => ({ value: l, label: l })),
  ], [jobs]);

  const typeOptions = useMemo(() => [
    { value: '', label: 'All employment types' },
    ...[...new Set(jobs.map((j) => j.employmentType).filter(Boolean))]
      .map((t) => ({ value: t, label: employmentLabel(t) })),
  ], [jobs]);

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let filtered = jobs.filter((job) => {
      const hay = `${job.title || ''} ${job.location || ''} ${job.department || ''} ${job.industry || ''} ${job.clientName || ''} ${(job.skills || []).join(' ')}`.toLowerCase();
      const matchesSearch = !q || hay.includes(q);
      const matchesDept = deptFilter ? job.department === deptFilter : true;
      const matchesLoc = locFilter ? job.location === locFilter : true;
      const matchesType = typeFilter ? job.employmentType === typeFilter : true;
      return matchesSearch && matchesDept && matchesLoc && matchesType;
    });

    filtered = [...filtered];
    if (sortBy === 'title') {
      filtered.sort((a, b) => displayTitle(a.title).localeCompare(displayTitle(b.title)));
    } else if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(postedDate(b) || 0) - new Date(postedDate(a) || 0));
    } else {
      filtered.sort((a, b) => {
        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;
        return new Date(postedDate(b) || 0) - new Date(postedDate(a) || 0);
      });
    }
    return filtered;
  }, [jobs, searchQuery, deptFilter, locFilter, typeFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageJobs = filteredJobs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = !!(searchQuery || deptFilter || locFilter || typeFilter);
  const pageBlocks = orgData?.pageBlocks || [];

  const clearFilters = () => {
    setSearchQuery('');
    setDeptFilter('');
    setLocFilter('');
    setTypeFilter('');
  };

  const brandStyle = { ['--careers-brand']: brand };

  const cardBorder = {
    borderColor: `${brand}28`,
    boxShadow: `0 1px 2px rgba(15,23,42,0.04), 0 0 0 1px ${brand}10`,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f5f7]" style={brandStyle}>
        <div className="w-full px-4 sm:px-6 lg:px-10 py-8 space-y-4">
          <div className="h-28 rounded-2xl skeleton-ats" />
          <div className="h-36 rounded-2xl skeleton-ats" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-2xl skeleton-ats" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f5f7] px-4" style={brandStyle}>
        <div className="card-ats-bordered p-8 text-center max-w-md w-full relative overflow-hidden" style={cardBorder}>
          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: brand }} />
          <Building2 className="h-12 w-12 text-stone-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-stone-900 mb-2">Page unavailable</h2>
          <p className="text-stone-600 mb-6">{error}</p>
          <Link to="/" className="font-semibold" style={{ color: brand }}>Return home</Link>
        </div>
      </div>
    );
  }

  const renderBlock = (block, idx) => {
    if (!block?.type) return null;
    switch (block.type) {
      case 'hero':
        return (
          <div key={idx} className="card-ats-bordered p-6 text-center relative overflow-hidden" style={cardBorder}>
            <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: brand }} />
            <h2 className="text-xl font-bold text-stone-900">{block.title || 'We are hiring'}</h2>
            {block.subtitle ? <p className="text-stone-500 mt-2 text-sm">{block.subtitle}</p> : null}
          </div>
        );
      case 'text':
        return (
          <div key={idx} className="prose prose-stone max-w-none text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content || '') }} />
        );
      case 'testimonials':
        return (
          <div key={idx} className="grid md:grid-cols-2 gap-4">
            {(block.items || []).map((item, i) => (
              <blockquote key={i} className="card-ats-bordered p-4 text-sm text-stone-600 italic" style={cardBorder}>
                &ldquo;{item.quote}&rdquo; — <span className="font-semibold not-italic text-stone-800">{item.author}</span>
              </blockquote>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-stone-900 flex flex-col" style={brandStyle}>
      <PublicAnnouncementBanner orgSlug={orgSlug} />

      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/80">
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${brand}, #2dd4bf, ${brand})` }} />
        <div className="w-full px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {logoSrc ? (
              <img src={logoSrc} alt={orgData?.name || ''} className="h-9 w-auto object-contain max-w-[10rem]" />
            ) : (
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center text-white shadow-sm"
                style={{ backgroundColor: brand }}
              >
                <Briefcase size={16} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">Careers</p>
              <p className="text-sm font-bold text-stone-900 truncate">{orgData?.name}</p>
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold tabular-nums"
            style={{ borderColor: `${brand}40`, backgroundColor: `${brand}12`, color: brand }}
          >
            <Sparkles size={12} /> {jobs.length} openings
          </span>
        </div>
      </div>

      <main className="flex-grow w-full px-4 sm:px-6 lg:px-10 py-6 sm:py-8 space-y-5 animate-page-enter">
        {/* Hero */}
        <div className="card-ats-bordered relative overflow-hidden p-5 sm:p-7" style={cardBorder}>
          <div
            className="absolute -top-28 -right-20 h-64 w-64 rounded-full blur-3xl opacity-25 pointer-events-none"
            style={{ backgroundColor: brand }}
          />
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${brand}, #2dd4bf)` }} />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-white shadow-lg ring-1 ring-white/20"
              style={{ background: `linear-gradient(135deg, ${brand}, #0f766e)` }}
            >
              <Briefcase size={22} strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900" style={{ letterSpacing: '-0.025em' }}>
                {pageTitle}
              </h1>
              <p className="mt-1.5 text-sm sm:text-[15px] font-medium text-stone-500 leading-relaxed max-w-3xl">
                {pageDesc}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 px-2.5 py-1 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {jobs.length} open positions
                </span>
                {featuredCount > 0 ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold"
                    style={{ borderColor: `${brand}40`, backgroundColor: `${brand}12`, color: brand }}
                  >
                    <Sparkles size={11} /> {featuredCount} featured
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {pageBlocks.length > 0 ? (
          <section className="space-y-4">{pageBlocks.map((block, idx) => renderBlock(block, idx))}</section>
        ) : null}

        {/* Filters — full width */}
        <div className="card-ats-bordered p-4 sm:p-5 relative overflow-hidden" style={cardBorder}>
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${brand}, #2dd4bf)` }} />
          <div className="flex items-center gap-2 mb-4">
            <span
              className="h-7 w-7 rounded-lg inline-flex items-center justify-center border"
              style={{ backgroundColor: `${brand}12`, color: brand, borderColor: `${brand}28` }}
            >
              <Filter size={13} strokeWidth={2} />
            </span>
            <div>
              <p className="text-xs font-bold text-stone-800">Find openings</p>
              <p className="text-[11px] text-stone-400">Filter by department, location, or employment type</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3 sm:gap-4">
            <div className="sm:col-span-2 xl:col-span-4 min-w-0">
              <label className="label-ats">Search</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none z-[1]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, location, or skills…"
                  className="input-ats input-ats-icon"
                />
              </div>
            </div>
            <div className="xl:col-span-2 min-w-0">
              <label className="label-ats">Department</label>
              <PremiumSelect
                variant="list"
                value={deptFilter}
                onChange={setDeptFilter}
                options={departmentOptions}
                placeholder="All departments"
                searchable={departmentOptions.length > 8}
              />
            </div>
            <div className="xl:col-span-3 min-w-0">
              <label className="label-ats">Location</label>
              <PremiumSelect
                variant="list"
                value={locFilter}
                onChange={setLocFilter}
                options={locationOptions}
                placeholder="All locations"
                searchable={locationOptions.length > 8}
              />
            </div>
            <div className="xl:col-span-3 min-w-0">
              <label className="label-ats">Employment type</label>
              <PremiumSelect
                variant="list"
                value={typeFilter}
                onChange={setTypeFilter}
                options={typeOptions}
                placeholder="All employment types"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-stone-100">
            <span className="text-[11px] font-bold uppercase tracking-wide text-stone-400">Sort by</span>
            <div className="min-w-[11rem] max-w-xs">
              <PremiumSelect
                variant="list"
                compact
                value={sortBy}
                onChange={setSortBy}
                options={SORT_OPTIONS}
                placeholder="Sort"
              />
            </div>
            <span className="text-[12px] text-stone-500 ml-auto tabular-nums">
              <span className="font-semibold text-stone-800">{filteredJobs.length}</span> results
            </span>
            {hasFilters ? (
              <button type="button" onClick={clearFilters} className="text-xs font-semibold" style={{ color: brand }}>
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        {/* Two-column job cards */}
        {pageJobs.length > 0 ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {pageJobs.map((job) => {
                const featured = String(job.priority || '').toLowerCase() === 'urgent';
                const title = displayTitle(job.title);
                return (
                  <article
                    key={job._id}
                    className="card-ats-bordered relative overflow-hidden group p-4 sm:p-5 transition-all duration-300 hover:-translate-y-0.5"
                    style={cardBorder}
                  >
                    <div
                      className="absolute inset-y-0 left-0 w-1"
                      style={{
                        background: featured
                          ? `linear-gradient(180deg, ${brand}, #2dd4bf)`
                          : `linear-gradient(180deg, ${brand}cc, ${brand}55)`,
                      }}
                    />
                    <div
                      className="absolute inset-x-0 top-0 h-px opacity-80"
                      style={{ background: `linear-gradient(90deg, ${brand}55, transparent 70%)` }}
                    />

                    <div className="pl-2 flex flex-col h-full min-h-[9.5rem]">
                      <div className="flex items-start gap-3">
                        <div
                          className="hidden sm:flex w-10 h-10 rounded-xl border items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: `${brand}12`,
                            borderColor: `${brand}28`,
                            color: brand,
                          }}
                        >
                          <Briefcase size={17} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Open
                            </span>
                            {featured ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border"
                                style={{ backgroundColor: `${brand}12`, color: brand, borderColor: `${brand}35` }}
                              >
                                <Sparkles size={10} /> Featured
                              </span>
                            ) : null}
                            {job.industry ? (
                              <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border border-stone-200 bg-white text-stone-500 uppercase tracking-wide truncate max-w-[9rem]">
                                {job.industry}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="text-[15px] sm:text-base font-bold text-stone-900 tracking-tight leading-snug uppercase">
                            <Link
                              to={`/careers/${orgSlug}/jobs/${job._id}`}
                              className="hover:underline underline-offset-2"
                              style={{ textDecorationColor: `${brand}40` }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = brand; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = ''; }}
                            >
                              {title}
                            </Link>
                          </h3>
                          {(job.clientName || job.jobCode) ? (
                            <p className="mt-0.5 text-[12px] text-stone-500 truncate">
                              {[job.clientName, job.jobCode].filter(Boolean).join(' · ')}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-stone-600">
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <MapPin size={12} className="text-stone-400 flex-shrink-0" />
                          <span className="truncate font-medium">{job.location || 'Location TBD'}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <Clock size={12} className="text-stone-400 flex-shrink-0" />
                          <span className="truncate">{job.employmentType ? employmentLabel(job.employmentType) : 'Full-time'}</span>
                        </span>
                        {job.experience ? (
                          <span className="inline-flex items-center gap-1 min-w-0">
                            <Building2 size={12} className="text-stone-400 flex-shrink-0" />
                            <span className="truncate">{job.experience}</span>
                          </span>
                        ) : null}
                        {job.ctc ? (
                          <span className="inline-flex items-center gap-1 min-w-0 font-semibold text-stone-800">
                            <IndianRupee size={12} className="text-stone-400 flex-shrink-0" />
                            <span className="truncate">{job.ctc}</span>
                          </span>
                        ) : null}
                      </div>

                      {Array.isArray(job.skills) && job.skills.length > 0 ? (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {job.skills.slice(0, 4).map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex max-w-[10rem] truncate px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                              style={{ backgroundColor: `${brand}10`, color: brand, borderColor: `${brand}25` }}
                            >
                              {skill}
                            </span>
                          ))}
                          {job.skills.length > 4 ? (
                            <span className="text-[10px] font-semibold text-stone-500">+{job.skills.length - 4}</span>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-auto pt-4 flex items-center justify-between gap-3 border-t border-stone-100/90">
                        <span className="text-[11px] font-medium text-stone-400 truncate">
                          {formatPosted(job) ? `Posted ${formatPosted(job)}` : 'Open position'}
                        </span>
                        <Link
                          to={`/careers/${orgSlug}/jobs/${job._id}`}
                          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[13px] font-bold text-white shadow-sm transition-transform group-hover:translate-x-0.5"
                          style={{ backgroundColor: brand }}
                        >
                          View role <ArrowRight size={14} />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {totalPages > 1 ? (
              <div className="card-ats-bordered px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3" style={cardBorder}>
                <p className="text-sm text-stone-500">
                  Showing{' '}
                  <span className="font-semibold text-stone-800">
                    {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredJobs.length)}
                  </span>
                  {' '}of <span className="font-semibold text-stone-800">{filteredJobs.length}</span>
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-9 px-3 inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <ChevronLeft size={15} /> Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((n) => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                    .reduce((acc, n, idx, arr) => {
                      if (idx > 0 && n - arr[idx - 1] > 1) acc.push('…');
                      acc.push(n);
                      return acc;
                    }, [])
                    .map((n, idx) => (
                      n === '…' ? (
                        <span key={`e-${idx}`} className="px-1 text-stone-400 text-sm">…</span>
                      ) : (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPage(n)}
                          className={`h-9 min-w-[2.25rem] px-2 rounded-xl text-sm font-bold border transition ${
                            n === currentPage ? 'text-white border-transparent shadow-sm' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                          }`}
                          style={n === currentPage ? { backgroundColor: brand } : undefined}
                        >
                          {n}
                        </button>
                      )
                    ))}
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-9 px-3 inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Next <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="card-ats-bordered p-12 text-center relative overflow-hidden" style={cardBorder}>
            <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: brand }} />
            <Search className="h-8 w-8 text-stone-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-stone-900 mb-1">No matching openings</h3>
            <p className="text-sm text-stone-500 mb-4">Adjust your filters or check back later for new roles.</p>
            {hasFilters ? (
              <button type="button" onClick={clearFilters} className="btn-secondary">Clear filters</button>
            ) : null}
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-stone-200 bg-white py-5">
        <div className="w-full px-4 sm:px-6 lg:px-10 text-center text-sm text-stone-500">
          © {orgData?.name}
          {!orgData?.hidePoweredBy ? (
            <>
              <span className="mx-2 text-stone-300">·</span>
              Powered by <a href="/" className="font-semibold text-stone-800 hover:opacity-80">People Connect HR</a>
            </>
          ) : null}
        </div>
      </footer>

      <CareersChatbotWidget orgSlug={orgSlug} />
    </div>
  );
};

export default CareersPage;
