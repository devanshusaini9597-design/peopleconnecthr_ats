import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Trash2, Edit2, RefreshCw, Save, X, Search, ChevronLeft, ChevronRight, Upload, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import Layout from './Layout';
import BASE_API_URL from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { useToast } from './Toast';
import ConfirmationModal from './ConfirmationModal';
import { ctcRanges, expectedCtcOptions, noticePeriodOptions } from '../utils/ctcRanges';
import { formatNameForInput } from '../utils/textFormatter';

const RECORDS_PER_PAGE = 50;

const PendingReviewPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOriginals, setShowOriginals] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [editData, setEditData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [stats, setStats] = useState({ review: 0, blocked: 0, total: 0 });
  const [selectedIds, setSelectedIds] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [importSingleConfirm, setImportSingleConfirm] = useState(false);
  const [positions, setPositions] = useState([]);
  const [clients, setClients] = useState([]);
  const [sources, setSources] = useState([]);
  const [editFormErrors, setEditFormErrors] = useState({});

  const fetchPendingCandidates = async (page = 1, category = activeTab, search = searchQuery) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: RECORDS_PER_PAGE.toString(),
        ...(category !== 'all' && { category }),
        ...(search && { search })
      });

      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/pending?${params}`);
      if (isUnauthorized(response)) { handleUnauthorized(); return; }

      const data = await response.json();
      if (data.success) {
        setCandidates(data.candidates || []);
        setTotalRecords(data.total || 0);
        setStats(data.stats || { review: 0, blocked: 0, total: 0 });
      }
    } catch (error) {
      toast.error('Failed to load pending records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPendingCandidates(); }, []);

  useEffect(() => {
    const fetchMaster = async () => {
      try {
        const [pRes, cRes, sRes] = await Promise.all([
          authenticatedFetch(`${BASE_API_URL}/api/positions`),
          authenticatedFetch(`${BASE_API_URL}/api/clients`),
          authenticatedFetch(`${BASE_API_URL}/api/sources`)
        ]);
        if (pRes.ok) setPositions(await pRes.json().catch(() => []));
        if (cRes.ok) setClients(await cRes.json().catch(() => []));
        if (sRes.ok) setSources(await sRes.json().catch(() => []));
      } catch (_) {}
    };
    fetchMaster();
  }, []);

  // Refetch when user returns to this tab (e.g. after sending from Auto Import)
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'visible') fetchPendingCandidates(currentPage, activeTab, searchQuery); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [currentPage, activeTab, searchQuery]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSelectedIds([]);
    fetchPendingCandidates(1, tab, searchQuery);
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    fetchPendingCandidates(1, activeTab, e.target.value);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchPendingCandidates(page, activeTab, searchQuery);
  };

  const handleEdit = (candidate) => {
    setEditingCandidate(candidate);
    setEditData({ ...candidate });
    setEditFormErrors({});
  };

  const validateEditForm = () => {
    const err = {};
    const name = (editData?.name || '').trim();
    if (!name) err.name = 'Name is required';
    else if (name.length < 2) err.name = 'Name must be at least 2 characters';
    else if (!/^[a-zA-Z\s.'\-]+$/.test(name)) err.name = 'Name can only contain letters, spaces, hyphens';

    const email = (editData?.email || '').trim().toLowerCase();
    if (!email) err.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) err.email = 'Please enter a valid email address';

    const contact = (editData?.contact || '').trim().replace(/\D/g, '');
    if (!contact) err.contact = 'Contact number is required';
    else if (contact.length < 10) err.contact = 'Enter a valid 10-digit mobile number';

    if (!(editData?.companyName || '').trim()) err.companyName = 'Company is required';
    if (!(editData?.ctc || '').trim()) err.ctc = 'Current CTC is required';

    setEditFormErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSaveFromModal = async () => {
    if (!editingCandidate || !editData) return;
    if (!validateEditForm()) {
      toast.warning('Please fix the errors before saving');
      return;
    }
    const id = editingCandidate._id;
    try {
      setIsSaving(true);
      setEditFormErrors({});
      const payload = {
        name: (editData.name || '').trim(),
        email: (editData.email || '').trim().toLowerCase(),
        contact: (editData.contact || '').trim(),
        position: editData.position || '',
        companyName: (editData.companyName || '').trim(),
        location: (editData.location || '').trim(),
        ctc: editData.ctc || '',
        expectedCtc: editData.expectedCtc || '',
        experience: editData.experience != null && editData.experience !== '' ? String(editData.experience) : '',
        noticePeriod: editData.noticePeriod || '',
        status: editData.status || 'Applied',
        source: editData.source || '',
        client: editData.client || '',
        spoc: (editData.spoc || '').trim(),
        remark: (editData.remark || '').trim(),
        fls: editData.fls || '',
        date: editData.date || ''
      };
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/pending/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to save');
      setEditingCandidate(null);
      setEditData(null);
      setEditFormErrors({});
      toast.success('Record updated');
      fetchPendingCandidates(currentPage, activeTab, searchQuery);
    } catch (error) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getOriginalFromPending = (c, fieldKey) => {
    const o = c?.originalData || {};
    const keyMap = {
      name: ['name', 'candidate', 'candidate name', 'full name', 'fls', 'non fls'],
      email: ['email', 'e-mail', 'mail', 'mail id'],
      contact: ['contact', 'phone', 'mobile', 'number', 'contact no'],
      position: ['position', 'designation', 'role', 'job title'],
      companyName: ['company', 'company name', 'current company', 'employer'],
      location: ['location', 'city', 'place'],
      ctc: ['ctc', 'current ctc', 'salary'],
      expectedCtc: ['expected', 'expected ctc', 'expected salary'],
      experience: ['experience', 'exp', 'years'],
      noticePeriod: ['notice', 'notice period', 'np'],
      status: ['status', 'candidate status'],
      source: ['source', 'source of cv'],
      client: ['client', 'client name'],
      spoc: ['spoc', 'hr', 'poc'],
      remark: ['remark', 'remarks', 'notes'],
      date: ['date', 'created', 'created date']
    };
    const keys = keyMap[fieldKey] || [fieldKey];
    for (const k of keys) {
      const lower = k.toLowerCase();
      const found = Object.entries(o).find(([key]) => key.toLowerCase().trim() === lower);
      if (found && found[1] != null && String(found[1]).trim() !== '') return found[1];
    }
    if (o[fieldKey] != null && String(o[fieldKey]).trim() !== '') return o[fieldKey];
    return null;
  };

  const handleDelete = (ids) => {
    const count = Array.isArray(ids) ? ids.length : 1;
    const idsArray = Array.isArray(ids) ? ids : [ids];

    setConfirmModal({
      isOpen: true, type: 'delete',
      title: `Delete ${count} Record${count > 1 ? 's' : ''}`,
      message: `Are you sure you want to delete ${count} pending record${count > 1 ? 's' : ''}? This cannot be undone.`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          const res = await authenticatedFetch(`${BASE_API_URL}/candidates/pending/delete`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: idsArray })
          });
          const data = await res.json();
          if (data.success) {
            toast.success(`Deleted ${data.deletedCount} record(s)`);
            setSelectedIds([]);
            fetchPendingCandidates(currentPage, activeTab, searchQuery);
          }
        } catch { toast.error('Failed to delete'); }
        finally { setConfirmModal({ isOpen: false }); }
      }
    });
  };

  const handleImportSelected = () => {
    if (selectedIds.length === 0) { toast.warning('Select records to import'); return; }

    setConfirmModal({
      isOpen: true, type: 'success',
      title: `Import ${selectedIds.length} Record${selectedIds.length > 1 ? 's' : ''}`,
      message: `Import ${selectedIds.length} selected record${selectedIds.length > 1 ? 's' : ''} to the main candidate database? Records with missing required fields may fail.`,
      confirmText: `Import ${selectedIds.length}`,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false });
        setIsImporting(true);
        try {
          const res = await authenticatedFetch(`${BASE_API_URL}/candidates/pending/import`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedIds })
          });
          const data = await res.json();
          if (data.success) {
            toast.success(`Imported ${data.imported} records to database`);
            if (data.failed > 0) toast.warning(`${data.failed} records failed to import`);
            setSelectedIds([]);
            fetchPendingCandidates(currentPage, activeTab, searchQuery);
          } else {
            toast.error(data.message || 'Import failed');
          }
        } catch { toast.error('Import failed'); }
        finally { setIsImporting(false); }
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === candidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(candidates.map(c => c._id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const totalPages = Math.ceil(totalRecords / RECORDS_PER_PAGE);

  const fields = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'contact', label: 'Contact' },
    { key: 'position', label: 'Position' },
    { key: 'companyName', label: 'Company' },
    { key: 'location', label: 'Location' },
    { key: 'ctc', label: 'CTC' },
    { key: 'experience', label: 'Exp' },
    { key: 'noticePeriod', label: 'NP' }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-[var(--bg-secondary)] p-4 sm:p-6">
        <div className="max-w-full mx-auto">
          {/* Page header - enterprise style */}
          <div className="bg-[var(--bg-primary)] rounded-xl shadow-[var(--shadow-sm)] border border-[var(--border-light)] p-6 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <AlertTriangle className="text-[var(--warning-main)]" size={28} />
                  Pending Review
                </h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Records from auto import that need review or have issues. Fix and import when ready.
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  Data stays here until you import to All Candidates or delete. Importing the same email again updates the existing candidate (no duplicates).
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {candidates.length > 0 && (
                  <button onClick={() => setShowOriginals(!showOriginals)}
                    className="px-4 py-2 border border-[var(--border-main)] rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2 transition-colors">
                    {showOriginals ? <EyeOff size={16} /> : <Eye size={16} />}
                    {showOriginals ? 'Hide Original Values' : 'Show Original Values'}
                  </button>
                )}
                <button onClick={() => fetchPendingCandidates(currentPage, activeTab, searchQuery)}
                  className="px-4 py-2 border border-[var(--border-main)] rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2 transition-colors">
                  <RefreshCw size={16} /> Refresh
                </button>
                {totalRecords > 0 && (
                  <button onClick={() => setClearAllConfirm(true)}
                    className="px-4 py-2 border border-[var(--error-main)]/40 text-[var(--error-main)] rounded-lg text-sm font-medium hover:bg-[var(--error-bg)] flex items-center gap-2 transition-colors"
                    title="Remove all pending records (entire list)">
                    <Trash2 size={16} /> Clear all ({totalRecords.toLocaleString()})
                  </button>
                )}
              </div>
            </div>

            {/* Stats pills - design system */}
            <div className="flex flex-wrap gap-3 mt-5">
              <div className="flex items-center gap-2 px-4 py-2 bg-[var(--warning-bg)] border border-amber-200 rounded-lg">
                <div className="w-2.5 h-2.5 bg-[var(--warning-main)] rounded-full" />
                <span className="text-sm font-medium text-amber-800">Review: {stats.review.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-[var(--error-bg)] border border-red-200 rounded-lg">
                <div className="w-2.5 h-2.5 bg-[var(--error-main)] rounded-full" />
                <span className="text-sm font-medium text-red-800">Blocked: {stats.blocked.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg">
                <span className="text-sm font-medium text-[var(--text-secondary)]">Total: {stats.total.toLocaleString()}</span>
              </div>
            </div>

            {/* Tabs + Search */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-5 pt-5 border-t border-[var(--border-light)]">
              <div className="flex gap-0.5 bg-[var(--bg-tertiary)] rounded-lg p-1">
                {[
                  { key: 'all', label: `All (${stats.total.toLocaleString()})` },
                  { key: 'review', label: `Review (${stats.review.toLocaleString()})` },
                  { key: 'blocked', label: `Blocked (${stats.blocked.toLocaleString()})` }
                ].map(tab => (
                  <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-white shadow-[var(--shadow-xs)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input type="text" value={searchQuery} onChange={handleSearch}
                  placeholder="Search records..."
                  className="w-full pl-9 pr-4 py-2 border border-[var(--border-main)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-main)]/30 focus:border-[var(--primary-main)]" />
              </div>
            </div>
          </div>

          {/* Selection action bar - only selected on this page; delete/import those, not whole data */}
          {selectedIds.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 px-4 py-3 bg-[var(--primary-lighter)] border border-[var(--primary-main)]/20 rounded-xl shadow-[var(--shadow-sm)]">
              <span className="text-sm font-medium text-[var(--primary-dark)]">
                {selectedIds.length} selected on this page
              </span>
              <span className="text-xs text-[var(--text-secondary)]">Delete or import only these — not the entire list.</span>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={() => setSelectedIds([])} className="px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-main)] rounded-lg hover:bg-white/60 transition-colors">
                  Clear selection
                </button>
                <button onClick={() => handleDelete(selectedIds)} className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--error-main)] hover:bg-red-600 rounded-lg flex items-center gap-1.5 transition-colors">
                  <Trash2 size={14} /> Delete {selectedIds.length}
                </button>
                <button onClick={handleImportSelected} disabled={isImporting}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--success-main)] hover:bg-green-600 rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors">
                  {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Import {selectedIds.length} to Database
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-[var(--bg-primary)] rounded-xl shadow-[var(--shadow-sm)] border border-[var(--border-light)] overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 size={32} className="animate-spin text-[var(--primary-main)]" />
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-20">
                <CheckCircle size={48} className="mx-auto text-[var(--success-main)] mb-3" />
                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">No pending records</h2>
                <p className="text-sm text-[var(--text-secondary)]">All records have been resolved or there are no auto-imported review/blocked records.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[var(--bg-tertiary)] border-b border-[var(--border-light)]">
                        <th className="px-3 py-3 text-left w-10">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={selectedIds.length === candidates.length && candidates.length > 0}
                              onChange={toggleSelectAll} className="rounded border-[var(--border-main)] text-[var(--primary-main)] focus:ring-[var(--primary-main)]" />
                            <span className="text-xs font-medium text-[var(--text-secondary)]" title="Select all rows on this page only">Page</span>
                          </label>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Actions</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Category</th>
                        {fields.map(f => (
                          <th key={f.key} className="px-3 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{f.label}</th>
                        ))}
                        <th className="px-3 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-light)]">
                      {candidates.map(c => (
                        <React.Fragment key={c._id}>
                          <tr className={`hover:bg-[var(--bg-secondary)] ${selectedIds.includes(c._id) ? 'bg-[var(--primary-lighter)]/50' : ''}`}>
                            <td className="px-3 py-2.5">
                              <input type="checkbox" checked={selectedIds.includes(c._id)}
                                onChange={() => toggleSelect(c._id)} className="rounded border-[var(--border-main)] text-[var(--primary-main)] focus:ring-[var(--primary-main)]" />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleEdit(c)} className="p-1.5 text-[var(--primary-main)] hover:bg-[var(--primary-lighter)] rounded" title="Edit">
                                  <Edit2 size={14} />
                                </button>
                                <button onClick={() => handleDelete(c._id)} className="p-1.5 text-[var(--error-main)] hover:bg-[var(--error-bg)] rounded" title="Delete">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${c.category === 'review' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                {c.category === 'review' ? 'Review' : 'Blocked'}
                              </span>
                            </td>
                            {fields.map(f => (
                              <td key={f.key} className="px-3 py-2.5 text-xs text-[var(--text-primary)] max-w-[150px] truncate" title={c[f.key] || ''}>
                                {c[f.key] || <span className="text-[var(--text-tertiary)]">-</span>}
                              </td>
                            ))}
                            <td className="px-3 py-2.5">
                              {(c.validationErrors?.length > 0) && (
                                <span className="text-xs text-[var(--error-main)]" title={c.validationErrors.map(e => e.message || e).join(', ')}>
                                  {c.validationErrors.length} error{c.validationErrors.length > 1 ? 's' : ''}
                                </span>
                              )}
                            </td>
                          </tr>
                          {showOriginals && (c.originalData && Object.keys(c.originalData).length > 0) && (
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                              <td className="px-3 py-1.5 text-[10px] text-slate-400 font-medium">orig</td>
                              <td className="px-3 py-1.5" />
                              <td className="px-3 py-1.5" />
                              {fields.map(f => {
                                const origVal = getOriginalFromPending(c, f.key);
                                const currVal = c[f.key] || '';
                                const isDifferent = origVal != null && currVal && String(origVal).toLowerCase().trim() !== String(currVal).toLowerCase().trim();
                                return (
                                  <td key={f.key} className={`px-3 py-1.5 text-[10px] max-w-[150px] truncate ${isDifferent ? 'text-orange-600 font-medium' : 'text-slate-500'}`}>
                                    {origVal != null ? String(origVal).substring(0, 40) : '-'}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-1.5" />
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-wrap justify-between items-center gap-2 px-4 py-3 border-t border-[var(--border-light)] bg-[var(--bg-secondary)]/50">
                    <p className="text-xs text-[var(--text-secondary)]">
                      Showing {((currentPage - 1) * RECORDS_PER_PAGE) + 1}-{Math.min(currentPage * RECORDS_PER_PAGE, totalRecords)} of {totalRecords.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}
                        className="p-2 border border-[var(--border-main)] rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-[var(--text-primary)] transition-colors">
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;
                        return (
                          <button key={pageNum} onClick={() => handlePageChange(pageNum)}
                            className={`min-w-[2rem] h-8 px-2 text-xs font-medium rounded-lg transition-colors ${pageNum === currentPage ? 'bg-[var(--primary-main)] text-white' : 'border border-[var(--border-main)] hover:bg-white text-[var(--text-primary)]'}`}>
                            {pageNum}
                          </button>
                        );
                      })}
                      <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages}
                        className="p-2 border border-[var(--border-main)] rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-[var(--text-primary)] transition-colors">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Help - design system */}
          <div className="mt-6 bg-[var(--info-bg)] border border-[var(--info-main)]/20 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">How to use this page</h3>
            <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 list-disc ml-4">
              <li>These records were flagged during auto import as needing review or having missing data.</li>
              <li>Click <strong>Edit</strong> to open a modal with current and original values; fix fields and save.</li>
              <li>Use <strong>Show Original Values</strong> to see original Excel values in a row under each record.</li>
              <li>Use the <strong>Page</strong> checkbox to select rows, then <strong>Delete X</strong> or <strong>Import to Database</strong>.</li>
              <li><strong>Clear all</strong> removes the entire pending list.</li>
            </ul>
          </div>
        </div>

        {/* Edit Record Modal - original + current values (like Auto Import) */}
        {editingCandidate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)] sticky top-0 bg-white z-10">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Edit Record {editingCandidate.rowIndex != null ? `- Row ${editingCandidate.rowIndex}` : ''} {editingCandidate.name ? `(${editingCandidate.name})` : ''}
                </h3>
                <button onClick={() => { setEditingCandidate(null); setEditData(null); setEditFormErrors({}); }} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
                  <X size={18} className="text-[var(--text-secondary)]" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                  {[
                    { field: 'name', label: 'Name', type: 'text' },
                    { field: 'email', label: 'Email', type: 'email' },
                    { field: 'contact', label: 'Contact', type: 'text' },
                    { field: 'position', label: 'Position', type: 'select-position' },
                    { field: 'experience', label: 'Experience', type: 'select-experience' },
                    { field: 'ctc', label: 'CTC (LPA)', type: 'select-ctc' },
                    { field: 'expectedCtc', label: 'Expected CTC', type: 'select-ctc' },
                    { field: 'noticePeriod', label: 'Notice Period', type: 'select-np' },
                    { field: 'companyName', label: 'Company', type: 'text' },
                    { field: 'location', label: 'Location', type: 'text' },
                    { field: 'client', label: 'Client', type: 'select-client' },
                    { field: 'source', label: 'Source', type: 'select-source' },
                    { field: 'spoc', label: 'SPOC', type: 'text' },
                    { field: 'date', label: 'Date', type: 'date' },
                    { field: 'status', label: 'Status', type: 'select-status' },
                    { field: 'remark', label: 'Remark', type: 'text' }
                  ].map(({ field, label, type }) => {
                    const origVal = getOriginalFromPending(editingCandidate, field);
                    const origStr = origVal != null ? String(origVal).trim() : '';
                    const fixedVal = editData?.[field] ?? '';
                    const fixedStr = String(fixedVal).trim();
                    const isDifferent = origStr && fixedStr && origStr.toLowerCase() !== fixedStr.toLowerCase();
                    const hasOriginal = origStr && origStr !== '-';
                    const err = editFormErrors[field];
                    const inputClass = `w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary-main)]/20 focus:border-[var(--primary-main)] outline-none ${err ? 'border-red-400 bg-red-50/50' : isDifferent ? 'border-orange-300 bg-orange-50/30' : 'border-[var(--border-main)]'}`;
                    const renderInput = () => {
                      if (type === 'select-status') {
                        const statusOpts = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined', 'Rejected', 'Dropped', 'Hold', 'Interested', 'Interested and scheduled'];
                        return (
                          <select value={fixedVal} onChange={(e) => { setEditData(prev => ({ ...prev, [field]: e.target.value })); setEditFormErrors(prev => ({ ...prev, [field]: '' })); }} className={inputClass}>
                            <option value="">Select</option>
                            {statusOpts.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        );
                      }
                      if (type === 'select-ctc') {
                        const opts = field === 'expectedCtc' ? expectedCtcOptions : ctcRanges;
                        return (
                          <select value={fixedVal} onChange={(e) => { setEditData(prev => ({ ...prev, [field]: e.target.value })); setEditFormErrors(prev => ({ ...prev, [field]: '' })); }} className={inputClass}>
                            <option value="">Select</option>
                            {opts.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        );
                      }
                      if (type === 'select-np') {
                        return (
                          <select value={fixedVal} onChange={(e) => setEditData(prev => ({ ...prev, [field]: e.target.value }))} className={inputClass}>
                            <option value="">Select</option>
                            {noticePeriodOptions.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        );
                      }
                      if (type === 'select-position') {
                        return (
                          <select value={fixedVal} onChange={(e) => setEditData(prev => ({ ...prev, [field]: e.target.value }))} className={inputClass}>
                            <option value="">Select Position</option>
                            {positions.filter(p => p.isActive !== false).map(p => <option key={p._id} value={p.name}>{p.name}</option>)}
                          </select>
                        );
                      }
                      if (type === 'select-client') {
                        return (
                          <select value={fixedVal} onChange={(e) => setEditData(prev => ({ ...prev, [field]: e.target.value }))} className={inputClass}>
                            <option value="">Select Client</option>
                            {clients.filter(c => c.isActive !== false).map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                          </select>
                        );
                      }
                      if (type === 'select-source') {
                        return (
                          <select value={fixedVal} onChange={(e) => setEditData(prev => ({ ...prev, [field]: e.target.value }))} className={inputClass}>
                            <option value="">Select Source</option>
                            {sources.filter(s => s.isActive !== false).map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
                          </select>
                        );
                      }
                      if (type === 'select-experience') {
                        return (
                          <select value={fixedVal} onChange={(e) => setEditData(prev => ({ ...prev, [field]: e.target.value }))} className={inputClass}>
                            <option value="">Select</option>
                            <option value="Fresher">Fresher</option>
                            {[...Array(31).keys()].slice(1).map(n => <option key={n} value={n}>{n} {n === 1 ? 'year' : 'years'}</option>)}
                          </select>
                        );
                      }
                      if (type === 'date') {
                        return <input type="date" value={fixedVal} onChange={(e) => setEditData(prev => ({ ...prev, [field]: e.target.value }))} className={inputClass} />;
                      }
                      const isFormattedText = ['name', 'companyName', 'location', 'spoc', 'remark'].includes(field);
                      return (
                        <input type={type === 'email' ? 'email' : 'text'} value={fixedVal}
                          onChange={(e) => {
                            const val = type === 'email' ? e.target.value : (isFormattedText ? formatNameForInput(e.target.value) : e.target.value);
                            setEditData(prev => ({ ...prev, [field]: val }));
                            setEditFormErrors(prev => ({ ...prev, [field]: '' }));
                          }}
                          className={inputClass} />
                      );
                    };
                    return (
                      <div key={field}>
                        <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                          {label}
                          {isDifferent && <span className="text-orange-500 normal-case font-medium ml-1">(was: {origStr.substring(0, 25)})</span>}
                        </label>
                        {renderInput()}
                        {err && <p className="text-xs text-red-600 mt-0.5">{err}</p>}
                        {hasOriginal && !isDifferent && fixedStr && !err && (
                          <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5">Original: {origStr.substring(0, 50)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {editingCandidate.originalData && Object.keys(editingCandidate.originalData).length > 0 && (
                  <div className="mb-5 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs font-bold text-slate-700 mb-2">Original Excel Row Data:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(editingCandidate.originalData).filter(([k, v]) => v != null && String(v).trim() !== '' && String(v).trim() !== '-').map(([key, value]) => (
                        <div key={key} className="text-[11px]">
                          <span className="text-slate-500 font-medium">{key}:</span>{' '}
                          <span className="text-slate-800">{String(value).substring(0, 50)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editingCandidate.validationErrors?.length > 0 && (
                  <div className="mb-5 p-4 bg-[var(--error-bg)] rounded-lg border border-red-200">
                    <p className="text-xs font-bold text-red-700 mb-1">Validation issues:</p>
                    {editingCandidate.validationErrors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600"><AlertCircle size={10} className="inline mr-1" />
                        {typeof e === 'object' && e?.field ? `${e.field}: ${e.message || ''}` : (e?.message || String(e))}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button onClick={handleSaveFromModal} disabled={isSaving}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--success-main)] text-white rounded-lg text-sm font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors">
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
                  </button>
                  <button onClick={() => setImportSingleConfirm(true)}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--primary-main)] text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors">
                    <Upload size={16} /> Import
                  </button>
                  <button onClick={() => { setEditingCandidate(null); setEditData(null); setEditFormErrors({}); }}
                    className="flex-1 min-w-[100px] px-4 py-2.5 bg-white border border-[var(--border-main)] text-[var(--text-primary)] rounded-lg text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirm: Import single record from edit modal to All Candidates */}
        {importSingleConfirm && editingCandidate && (
          <ConfirmationModal
            isOpen={true}
            type="success"
            title="Import to All Candidates"
            message={`Import "${editingCandidate.name || editingCandidate.email || 'this record'}" to the All Candidates list? A success message will show and you can continue editing more records here.`}
            confirmText="Import"
            onConfirm={async () => {
              const id = editingCandidate._id;
              try {
                const res = await authenticatedFetch(`${BASE_API_URL}/candidates/pending/import`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ids: [id] })
                });
                const data = await res.json();
                if (data.success && data.imported > 0) {
                  toast.success('Candidate has been imported successfully to All Candidates list.');
                  setImportSingleConfirm(false);
                  setEditingCandidate(null);
                  setEditData(null);
                  fetchPendingCandidates(currentPage, activeTab, searchQuery);
                } else {
                  toast.error(data.message || 'Import failed');
                }
              } catch (e) {
                toast.error('Import failed');
              }
            }}
            onClose={() => setImportSingleConfirm(false)}
          />
        )}

        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          type={confirmModal.type}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal({ isOpen: false })}
        />

        {clearAllConfirm && (
          <ConfirmationModal
            isOpen={true}
            type="delete"
            title="Clear all pending records"
            message={`Are you sure you want to delete all ${totalRecords} pending records? This cannot be undone. Use this to clean up old batches (e.g. after re-uploading the same file many times).`}
            confirmText="Clear all"
            onConfirm={async () => {
              try {
                const res = await authenticatedFetch(`${BASE_API_URL}/candidates/pending/clear-all`, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                  toast.success(data.message || `Cleared ${data.deletedCount} records.`);
                  setClearAllConfirm(false);
                  fetchPendingCandidates(1, 'all', '');
                  setTotalRecords(0);
                  setStats({ review: 0, blocked: 0, total: 0 });
                  setSelectedIds([]);
                } else {
                  toast.error(data.message || 'Failed to clear');
                }
              } catch (e) {
                toast.error('Failed to clear pending records');
              }
              setClearAllConfirm(false);
            }}
            onCancel={() => setClearAllConfirm(false)}
          />
        )}
      </div>
    </Layout>
  );
};

export default PendingReviewPage;
