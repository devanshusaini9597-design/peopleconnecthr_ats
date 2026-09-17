import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Search, MapPin, Briefcase, Clock, Building, ArrowRight, AlertTriangle,
  ChevronLeft, ChevronRight, Sparkles,
} from 'lucide-react';
import API_URL from '../config';
import { employmentLabel } from './jobs/jobsConstants';
import CareersChatbotWidget from './CareersChatbotWidget';
import PublicAnnouncementBanner from './PublicAnnouncementBanner';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { resolveOrgLogoSrc } from '../utils/orgLogo';

const PAGE_SIZE = 9;

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

function titleCaseWords(str) {
  const s = String(str || '').trim();
  if (!s) return '';
  // Keep short ALL-CAPS acronyms (BAM, AVP) but soften long all-caps titles
  if (s === s.toUpperCase() && s.length > 4 && !/^[A-Z]{2,6}$/.test(s)) {
    return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return s;
}

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
        if (!res.ok) throw new Error('Organization or careers page not found');
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
    || `Careers at ${orgData?.name || 'our company'}`;
  const pageDesc = orgData?.careersPageDescription
    || orgData?.settings?.careersPageDescription
    || 'Explore open roles and apply directly. Your application reaches our hiring team.';

  const departments = useMemo(() => [...new Set(jobs.map((j) => j.department).filter(Boolean))], [jobs]);
  const locations = useMemo(() => [...new Set(jobs.map((j) => j.location).filter(Boolean))], [jobs]);
  const types = useMemo(() => [...new Set(jobs.map((j) => j.employmentType).filter(Boolean))], [jobs]);

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let filtered = jobs.filter((job) => {
      const hay = `${job.title || ''} ${job.location || ''} ${job.department || ''} ${job.industry || ''} ${(job.skills || []).join(' ')}`.toLowerCase();
      const matchesSearch = !q || hay.includes(q);
      const matchesDept = deptFilter ? job.department === deptFilter : true;
      const matchesLoc = locFilter ? job.location === locFilter : true;
      const matchesType = typeFilter ? job.employmentType === typeFilter : true;
      return matchesSearch && matchesDept && matchesLoc && matchesType;
    });

    filtered = [...filtered];
    if (sortBy === 'title') {
      filtered.sort((a, b) => titleCaseWords(a.title).localeCompare(titleCaseWords(b.title)));
    } else if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(postedDate(b) || 0) - new Date(postedDate(a) || 0));
    } else {
      // featured: urgent first, then newest
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

  const selectClass =
    'bg-white border border-stone-200 text-stone-700 py-2 px-3 rounded-xl shadow-sm focus:outline-none focus:ring-2 text-sm font-medium min-w-[9.5rem]';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f7f9]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="animate-pulse flex flex-col items-center space-y-4 mb-12">
            <div className="h-16 w-40 bg-stone-200 rounded-xl" />
            <div className="h-8 w-72 bg-stone-200 rounded" />
            <div className="h-4 w-96 max-w-full bg-stone-200 rounded" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-stone-200 animate-pulse h-52" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f7f9] px-4">
        <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-stone-200 max-w-md w-full">
          <Building className="h-12 w-12 text-stone-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-stone-900 mb-2">Page not found</h2>
          <p className="text-stone-600 mb-6">{error}</p>
          <Link to="/" className="font-semibold hover:underline" style={{ color: brand }}>
            ← Return home
          </Link>
        </div>
      </div>
    );
  }

  const pageBlocks = orgData?.pageBlocks || [];

  const renderBlock = (block, idx) => {
    if (!block?.type) return null;
    switch (block.type) {
      case 'hero':
        return (
          <div key={idx} className="text-center py-8 px-4 rounded-2xl mb-8 border border-stone-200/80" style={{ backgroundColor: `${brand}12` }}>
            <h2 className="text-2xl font-bold text-stone-900">{block.title || 'We are hiring'}</h2>
            {block.subtitle ? <p className="text-stone-600 mt-2 max-w-xl mx-auto">{block.subtitle}</p> : null}
          </div>
        );
      case 'text':
        return (
          <div key={idx} className="prose prose-stone max-w-3xl mx-auto mb-8" dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content || '') }} />
        );
      case 'testimonials':
        return (
          <div key={idx} className="grid md:grid-cols-2 gap-4 mb-8 max-w-4xl mx-auto">
            {(block.items || []).map((item, i) => (
              <blockquote key={i} className="p-5 bg-white rounded-xl border border-stone-200 text-stone-600 italic">
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
    <div className="min-h-screen bg-[#f6f7f9] text-stone-900 flex flex-col">
      <PublicAnnouncementBanner orgSlug={orgSlug} />

      {/* Org-branded hero */}
      <header className="relative overflow-hidden border-b border-stone-200/80 bg-white flex-shrink-0">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% -10%, ${brand}, transparent 70%)`,
          }}
        />
        <div className="absolute top-0 inset-x-0 h-1" style={{ backgroundColor: brand }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 text-center">
          {logoSrc ? (
            <img src={logoSrc} alt={orgData?.name || 'Organization'} className="h-14 sm:h-16 w-auto mx-auto mb-6 object-contain" />
          ) : (
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-sm"
              style={{ backgroundColor: brand }}
            >
              <Building className="h-7 w-7" />
            </div>
          )}
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400 mb-2">
            {orgData?.name || 'Careers'}
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-bold tracking-tight text-stone-900 mb-3 leading-tight">
            {pageTitle}
          </h1>
          <p className="text-[15px] sm:text-base text-stone-500 max-w-2xl mx-auto mb-8 leading-relaxed">
            {pageDesc}
          </p>

          <div
            className="relative max-w-2xl mx-auto flex items-center rounded-2xl overflow-hidden border border-stone-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-within:ring-2"
            style={{ ['--tw-ring-color']: `${brand}40` }}
          >
            <div className="pl-4 text-stone-400">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="search"
              placeholder="Search by title, location, or skill…"
              className="w-full py-3.5 px-3 outline-none text-stone-800 bg-transparent text-sm font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[12px] font-semibold text-stone-500">
            <span
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1"
              style={{ borderColor: `${brand}35`, backgroundColor: `${brand}10`, color: brand }}
            >
              <Sparkles size={12} /> {jobs.length} open {jobs.length === 1 ? 'role' : 'roles'}
            </span>
            {jobs.some((j) => String(j.priority || '').toLowerCase() === 'urgent') ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-2.5 py-1">
                <AlertTriangle size={12} /> Urgent hiring live
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full">
        {pageBlocks.length > 0 ? (
          <section className="mb-8">
            {pageBlocks.map((block, idx) => renderBlock(block, idx))}
          </section>
        ) : null}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <select
              className={selectClass}
              style={{ accentColor: brand }}
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="">All departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              className={selectClass}
              value={locFilter}
              onChange={(e) => setLocFilter(e.target.value)}
            >
              <option value="">All locations</option>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select
              className={selectClass}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All job types</option>
              {types.map((t) => <option key={t} value={t}>{employmentLabel(t)}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Sort</span>
            <select
              className={selectClass}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="featured">Featured (urgent first)</option>
              <option value="newest">Newest first</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-stone-500">
            Showing{' '}
            <span className="font-semibold text-stone-800">
              {filteredJobs.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}
              –
              {Math.min(currentPage * PAGE_SIZE, filteredJobs.length)}
            </span>
            {' '}of <span className="font-semibold text-stone-800">{filteredJobs.length}</span>
          </p>
        </div>

        {pageJobs.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pageJobs.map((job) => {
                const urgent = String(job.priority || '').toLowerCase() === 'urgent';
                return (
                  <article
                    key={job._id}
                    className="group relative bg-white rounded-2xl border border-stone-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:border-stone-300 transition-all duration-200 flex flex-col overflow-hidden"
                  >
                    <div className="h-1 w-full" style={{ backgroundColor: urgent ? '#e11d48' : brand }} />
                    <div className="p-5 sm:p-6 flex flex-col flex-1">
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="inline-flex items-center rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          Open
                        </span>
                        {urgent ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            <AlertTriangle size={10} strokeWidth={2.5} /> Urgent hiring
                          </span>
                        ) : null}
                        {job.industry ? (
                          <span className="inline-flex items-center rounded-md bg-stone-50 text-stone-600 border border-stone-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider truncate max-w-[10rem]">
                            {job.industry}
                          </span>
                        ) : null}
                      </div>

                      <h3 className="text-lg font-bold text-stone-900 leading-snug tracking-tight mb-3 group-hover:opacity-90">
                        {titleCaseWords(job.title)}
                      </h3>

                      <div className="space-y-1.5 mb-4 flex-grow text-[13px] text-stone-600">
                        {job.department ? (
                          <div className="flex items-start gap-2">
                            <Briefcase className="h-3.5 w-3.5 mt-0.5 text-stone-400 shrink-0" />
                            <span>{job.department}</span>
                          </div>
                        ) : null}
                        {job.location ? (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 text-stone-400 shrink-0" />
                            <span className="line-clamp-2">{job.location}</span>
                          </div>
                        ) : null}
                        {job.employmentType ? (
                          <div className="flex items-start gap-2">
                            <Clock className="h-3.5 w-3.5 mt-0.5 text-stone-400 shrink-0" />
                            <span>{employmentLabel(job.employmentType)}</span>
                          </div>
                        ) : null}
                        {job.clientName ? (
                          <div className="flex items-start gap-2">
                            <Building className="h-3.5 w-3.5 mt-0.5 text-stone-400 shrink-0" />
                            <span>{job.clientName}</span>
                          </div>
                        ) : null}
                      </div>

                      {Array.isArray(job.skills) && job.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {job.skills.slice(0, 3).map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border"
                              style={{ backgroundColor: `${brand}12`, color: brand, borderColor: `${brand}28` }}
                            >
                              {skill}
                            </span>
                          ))}
                          {job.skills.length > 3 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-50 text-stone-500 border border-stone-200">
                              +{job.skills.length - 3}
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-auto flex items-center justify-between pt-4 border-t border-stone-100 gap-3">
                        <span className="text-[11px] font-medium text-stone-400 truncate">
                          {formatPosted(job) ? `Posted ${formatPosted(job)}` : 'Open role'}
                        </span>
                        <Link
                          to={`/careers/${orgSlug}/jobs/${job._id}`}
                          className="inline-flex items-center gap-1 text-sm font-bold shrink-0 transition-transform group-hover:translate-x-0.5"
                          style={{ color: brand }}
                        >
                          View & apply <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {totalPages > 1 ? (
              <nav className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4" aria-label="Job list pagination">
                <p className="text-sm text-stone-500">
                  Page <span className="font-semibold text-stone-800">{currentPage}</span> of{' '}
                  <span className="font-semibold text-stone-800">{totalPages}</span>
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-9 px-3 inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <ChevronLeft size={15} /> Prev
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
                            n === currentPage
                              ? 'text-white border-transparent shadow-sm'
                              : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
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
              </nav>
            ) : null}
          </>
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl border border-stone-200 shadow-sm">
            <div className="mx-auto h-16 w-16 bg-stone-50 rounded-full flex items-center justify-center mb-4 border border-stone-100">
              <Search className="h-7 w-7 text-stone-300" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 mb-1">No open positions found</h3>
            <p className="text-stone-500 text-sm mb-4">Try adjusting filters or search, or check back later.</p>
            {(searchQuery || deptFilter || locFilter || typeFilter) ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDeptFilter('');
                  setLocFilter('');
                  setTypeFilter('');
                }}
                className="font-semibold text-sm hover:underline"
                style={{ color: brand }}
              >
                Clear all filters
              </button>
            ) : null}
          </div>
        )}
      </main>

      {!orgData?.hidePoweredBy ? (
        <footer className="bg-white border-t border-stone-200 py-6 flex-shrink-0">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-stone-500">
            © {orgData?.name}
            <span className="mx-2 text-stone-300">·</span>
            Powered by <a href="/" className="font-semibold text-stone-800 hover:opacity-80">People Connect HR</a>
          </div>
        </footer>
      ) : (
        <footer className="bg-white border-t border-stone-200 py-5 flex-shrink-0">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-stone-500">
            © {orgData?.name}
          </div>
        </footer>
      )}

      <CareersChatbotWidget orgSlug={orgSlug} />
    </div>
  );
};

export default CareersPage;
