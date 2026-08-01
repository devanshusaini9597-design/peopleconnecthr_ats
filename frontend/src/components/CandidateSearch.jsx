import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import API_URL from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { ctcRanges } from '../utils/ctcRanges';
import PageHeader from './ui/PageHeader';

const CandidateSearch = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    position: '',
    companyName: '',
    location: '',
    expMin: '',
    expMax: '',
    ctcMin: '',
    ctcMax: '',
    expectedCtcMin: '',
    expectedCtcMax: '',
    date: ''
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    pageSize: 50,
    hasMore: false
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const buildQuery = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (String(value).trim() !== '') params.append(key, value.trim());
    });
    return params.toString();
  };

  const hasAnyFilter = () => Object.values(filters).some(v => String(v).trim() !== '');

  const handleSearch = async (e, pageNum = 1) => {
    e.preventDefault();
    if (!hasAnyFilter()) {
      setResults([]);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const query = buildQuery();
      const pageParam = `page=${pageNum}&limit=50`;
      const res = await authenticatedFetch(`${API_URL}/candidates?${query}&${pageParam}`);
      
      if (isUnauthorized(res)) {
        handleUnauthorized();
        return;
      }
      
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Search failed');
        setResults([]);
        return;
      }
      setResults(data.data || []);
      setPagination(data.pagination || {});
      setCurrentPage(pageNum);
    } catch (err) {
      setError('Server error. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFilters({
      position: '',
      companyName: '',
      location: '',
      expMin: '',
      expMax: '',
      ctcMin: '',
      ctcMax: '',
      expectedCtcMin: '',
      expectedCtcMax: '',
      date: ''
    });
    setResults([]);
    setError('');
    setCurrentPage(1);
    setPagination({
      currentPage: 1,
      totalPages: 1,
      totalCount: 0,
      pageSize: 50,
      hasMore: false
    });
  };

  return (
    <div className="page-shell-ats">
      <PageHeader
        icon={Search}
        title="Advanced Candidate Search"
        subtitle="Filter by role, company, location, experience, and CTC ranges."
        gradientTitle
      >
        <button type="button" onClick={() => navigate('/ats')} className="btn-secondary">
          <ArrowLeft size={16} /> Back to Candidates
        </button>
      </PageHeader>

      <form onSubmit={handleSearch} className="card-ats-bordered p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            ['position', 'Position', 'text', 'Role / Position'],
            ['location', 'City', 'text', 'City / Location'],
            ['companyName', 'Company Name', 'text', 'Company'],
            ['date', 'Date', 'date', ''],
            ['expMin', 'Experience (Min)', 'text', 'e.g. 1'],
            ['expMax', 'Experience (Max)', 'text', 'e.g. 5'],
          ].map(([name, label, type, placeholder]) => (
            <div key={name}>
              <label className="label-ats">{label}</label>
              <input
                type={type}
                name={name}
                value={filters[name]}
                onChange={handleChange}
                className="input-ats"
                placeholder={placeholder || undefined}
              />
            </div>
          ))}
          {[
            ['ctcMin', 'CTC (Min)', 'Select Min CTC'],
            ['ctcMax', 'CTC (Max)', 'Select Max CTC'],
            ['expectedCtcMin', 'Expected CTC (Min)', 'Select Min Expected CTC'],
            ['expectedCtcMax', 'Expected CTC (Max)', 'Select Max Expected CTC'],
          ].map(([name, label, empty]) => (
            <div key={name}>
              <label className="label-ats">{label}</label>
              <select name={name} value={filters[name]} onChange={handleChange} className="input-ats">
                <option value="">{empty}</option>
                {ctcRanges.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search
          </button>
          <button type="button" onClick={handleReset} className="btn-secondary">
            <RefreshCw size={16} /> Reset
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 animate-fade-in">
          {error}
        </div>
      )}

      <div className="table-shell-ats">
        <div className="p-4 text-sm text-stone-600 font-semibold flex flex-wrap justify-between items-center gap-2 border-b border-stone-100">
          <span>
            Results: <span className="text-stone-900 tabular-nums">{pagination.totalCount}</span>
            {' '}({currentPage} of {pagination.totalPages} pages)
          </span>
          {pagination.totalCount > 0 && (
            <span className="text-xs text-stone-500">Showing {results.length} per page</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50/80 text-stone-500">
              <tr>
                {['Position', 'City', 'Company', 'Experience', 'CTC', 'Expected CTC'].map((h) => (
                  <th key={h} className="p-3 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((c) => (
                <tr key={c._id} className="border-t border-stone-100 hover:bg-brand-50/30 transition-colors">
                  <td className="p-3 font-medium text-stone-900 whitespace-nowrap">{c.position || '—'}</td>
                  <td className="p-3 text-stone-600 whitespace-nowrap">{c.location || '—'}</td>
                  <td className="p-3 text-stone-600 whitespace-nowrap">{c.companyName || '—'}</td>
                  <td className="p-3 text-stone-600 whitespace-nowrap">{c.experience || '—'}</td>
                  <td className="p-3 text-stone-600 whitespace-nowrap">{c.ctc || '—'}</td>
                  <td className="p-3 text-stone-600 whitespace-nowrap">{c.expectedCtc || '—'}</td>
                </tr>
              ))}
              {!loading && results.length === 0 && (
                <tr>
                  <td className="p-10 text-center text-stone-400" colSpan={6}>No candidates found. Adjust filters and search again.</td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="p-10 text-center text-stone-500" colSpan={6}>
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Loader2 size={18} className="animate-spin text-brand-600" /> Searching…
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalCount > 0 && (
          <div className="p-4 border-t border-stone-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={(e) => handleSearch(e, currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="btn-secondary"
            >
              Previous
            </button>

            <div className="flex gap-1.5 items-center justify-center flex-wrap">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const pageNum = currentPage <= 3 ? i + 1 : currentPage + i - 2;
                if (pageNum > pagination.totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={(e) => handleSearch(e, pageNum)}
                    disabled={loading}
                    className={`min-w-[36px] h-9 px-2.5 rounded-xl text-sm font-semibold transition-all ${
                      currentPage === pageNum
                        ? 'bg-gradient-to-r from-brand-600 to-teal-600 text-white shadow-md shadow-brand-500/25'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    } disabled:opacity-50`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={(e) => handleSearch(e, currentPage + 1)}
              disabled={!pagination.hasMore || loading}
              className="btn-secondary"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CandidateSearch;
