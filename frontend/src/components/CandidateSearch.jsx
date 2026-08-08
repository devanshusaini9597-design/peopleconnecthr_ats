import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, RefreshCw, Loader2, Users, BookmarkPlus, Trash2, Bell } from 'lucide-react';
import API_URL from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized, readApiJson } from '../utils/fetchUtils';
import { ctcRanges } from '../utils/ctcRanges';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import ConfirmationModal from './ConfirmationModal';
import { planHasFeature } from '../config/planFeatures';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';

const CandidateSearch = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { organization } = useAuth();
  const canSave = planHasFeature(organization?.plan, 'candidates.savedSearches');
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
  const [saved, setSaved] = useState([]);
  const [saveName, setSaveName] = useState('');
  const [alertFrequency, setAlertFrequency] = useState('none');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadSaved = useCallback(async () => {
    if (!canSave) return;
    try {
      const res = await authenticatedFetch('/api/saved-searches');
      const data = await readApiJson(res);
      if (data.success) setSaved(data.data || []);
    } catch { /* optional */ }
  }, [canSave]);

  useEffect(() => { loadSaved(); }, [loadSaved]);

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
    if (e?.preventDefault) e.preventDefault();
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
    } catch {
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

  const saveSearch = async () => {
    if (!saveName.trim() || !hasAnyFilter()) {
      toast.error('Add filters and a name to save');
      return;
    }
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName.trim(),
          query: filters.position || filters.location || '',
          filters,
          alertFrequency
        })
      });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      toast.success('Search saved');
      setSaveName('');
      loadSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const runSaved = async (id) => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/saved-searches/${id}/run`, { method: 'POST' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message);
      const row = data.data?.saved;
      if (row?.filters) setFilters((prev) => ({ ...prev, ...row.filters }));
      setResults(data.data?.results || []);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalCount: data.data?.count || 0,
        pageSize: 50,
        hasMore: false
      });
      toast.success(`Found ${data.data?.count || 0} candidates`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteSaved = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authenticatedFetch(`/api/saved-searches/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await readApiJson(res);
      if (!data.success) throw new Error(data.message || 'Failed to delete');
      toast.success('Saved search deleted');
      setDeleteTarget(null);
      loadSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Search}
        title="Advanced Candidate Search"
        subtitle="Filter by role, company, location, experience, and CTC ranges. Save alerts for later."
        gradientTitle
      >
        <button type="button" onClick={() => navigate('/ats')} className="btn-secondary w-full sm:w-auto">
          <ArrowLeft size={16} /> Back to Candidates
        </button>
      </PageHeader>

      {canSave && (
        <div className="card-ats-bordered p-4 sm:p-5 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="font-semibold text-stone-900 text-sm">Saved searches</h3>
              <p className="text-xs text-stone-500 mt-0.5">Run a saved filter set or set alert frequency when saving below.</p>
            </div>
          </div>
          {saved.length === 0 ? (
            <EmptyState icon={BookmarkPlus} tone="brand" compact message="No saved searches yet" subMessage="Run a search, then save it with a name." />
          ) : (
            <div className="flex flex-wrap gap-2">
              {saved.map((s) => (
                <div key={s._id} className="inline-flex items-center gap-1 max-w-full rounded-xl border border-stone-200 bg-stone-50 pl-3 pr-1 py-1 min-w-0">
                  <button type="button" className="text-sm font-semibold text-brand-700 hover:underline truncate max-w-[12rem] sm:max-w-[16rem]" onClick={() => runSaved(s._id)}>
                    {s.name}
                  </button>
                  {s.alertFrequency && s.alertFrequency !== 'none' && (
                    <Bell className="w-3 h-3 text-amber-500 flex-shrink-0" title={`Alert: ${s.alertFrequency}`} />
                  )}
                  <button type="button" className="p-1.5 text-stone-400 hover:text-red-500 flex-shrink-0" onClick={() => setDeleteTarget(s)} aria-label="Delete saved search">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

        {canSave && (
          <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <label className="label-ats">Save this search</label>
              <input className="input-ats" placeholder="e.g. React Bangalore 3–5 yrs" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
            </div>
            <div>
              <label className="label-ats">Alert</label>
              <select className="input-ats" value={alertFrequency} onChange={(e) => setAlertFrequency(e.target.value)}>
                <option value="none">No alert</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <button type="button" className="btn-secondary" disabled={saving} onClick={saveSearch}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <BookmarkPlus size={16} />}
              Save
            </button>
          </div>
        )}
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
            {' '}({currentPage} of {pagination.totalPages || 1} pages)
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
                  <td className="p-3 font-medium text-stone-900 max-w-[10rem] truncate">{c.position || '—'}</td>
                  <td className="p-3 text-stone-600 max-w-[8rem] truncate">{c.location || '—'}</td>
                  <td className="p-3 text-stone-600 max-w-[10rem] truncate">{c.companyName || '—'}</td>
                  <td className="p-3 text-stone-600 whitespace-nowrap">{c.experience || '—'}</td>
                  <td className="p-3 text-stone-600 whitespace-nowrap">{c.ctc || '—'}</td>
                  <td className="p-3 text-stone-600 whitespace-nowrap">{c.expectedCtc || '—'}</td>
                </tr>
              ))}
              {!loading && results.length === 0 && (
                <tr>
                  <td className="p-4" colSpan={6}>
                    <EmptyState
                      icon={Users}
                      tone="amber"
                      compact
                      message="No candidates found"
                      subMessage="Adjust filters and search again."
                    />
                  </td>
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

        {pagination.totalCount > 0 && pagination.totalPages > 1 && (
          <div className="p-4 border-t border-stone-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={(e) => handleSearch(e, currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="btn-secondary w-full sm:w-auto"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={(e) => handleSearch(e, currentPage + 1)}
              disabled={!pagination.hasMore || loading}
              className="btn-secondary w-full sm:w-auto"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteSaved}
        title="Delete saved search?"
        message={`Delete “${deleteTarget?.name || 'this search'}”?`}
        confirmText="Delete"
        type="delete"
        isLoading={deleting}
      />
    </div>
  );
};

export default CandidateSearch;
