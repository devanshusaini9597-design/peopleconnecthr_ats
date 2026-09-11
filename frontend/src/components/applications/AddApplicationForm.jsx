import React, { useEffect, useRef, useState } from 'react';
import {
  User, Mail, Phone, Briefcase, Search, Loader2, X, Upload, FileText, Check,
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../../utils/fetchUtils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import EmptyState from '../ui/EmptyState';
import PremiumSelect from '../ui/PremiumSelect';
import { SOURCE_OPTIONS } from './constants';

function personPhone(c) {
  return c?.phone || c?.contact || '';
}

export default function AddApplicationForm({ addForm, setAddForm, jobOptions }) {
  const toast = useToast();
  const { user } = useAuth();
  const view = user?.role === 'freelancer' ? 'mine' : 'all';
  const fileRef = useRef(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [fromPool, setFromPool] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [resumeName, setResumeName] = useState('');

  useEffect(() => {
    if (addForm.mode !== 'existing') return undefined;
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const q = query.trim();
        const jobId = addForm.jobId;
        if (jobId) {
          const poolRes = await authenticatedFetch(
            `/api/talent-pools/reusable?jobId=${encodeURIComponent(jobId)}&limit=12${q ? `&q=${encodeURIComponent(q)}` : ''}`
          );
          const poolData = await readApiJson(poolRes);
          const poolPeople = poolData?.data?.candidates;
          if (poolRes.ok && poolData.success && Array.isArray(poolPeople) && poolPeople.length) {
            setResults(poolPeople);
            setFromPool(true);
            return;
          }
        }
        const url = q
          ? `/candidates?search=${encodeURIComponent(q)}&limit=12&view=${view}`
          : `/candidates?limit=8&view=${view}`;
        const res = await authenticatedFetch(url);
        const data = await readApiJson(res);
        setResults(Array.isArray(data.data) ? data.data : []);
        setFromPool(false);
      } catch {
        setResults([]);
        setFromPool(false);
      } finally {
        setSearching(false);
      }
    }, query.trim() ? 280 : 0);
    return () => clearTimeout(handle);
  }, [query, view, addForm.jobId, addForm.mode]);

  const pickCandidate = (c) => {
    setAddForm({
      ...addForm,
      mode: 'existing',
      candidateId: c._id,
      name: c.name || '',
      email: c.email || '',
      phone: personPhone(c),
      source: addForm.source || c.source || 'Direct',
    });
    setQuery('');
  };

  const clearCandidate = () => {
    setAddForm({
      ...addForm,
      candidateId: '',
      name: '',
      email: '',
      phone: '',
    });
  };

  const setMode = (mode) => {
    setAddForm({
      ...addForm,
      mode,
      candidateId: mode === 'existing' ? addForm.candidateId : '',
      name: mode === 'new' ? addForm.name : addForm.candidateId ? addForm.name : '',
      email: mode === 'new' ? addForm.email : addForm.candidateId ? addForm.email : '',
      phone: mode === 'new' ? addForm.phone : addForm.candidateId ? addForm.phone : '',
    });
    setResumeName('');
  };

  const parseResume = async (file) => {
    if (!file) return;
    setParsing(true);
    setResumeName(file.name);
    try {
      const fd = new FormData();
      fd.append('resume', file);
      const res = await authenticatedFetch('/api/candidates/parse-logic', { method: 'POST', body: fd });
      const data = await readApiJson(res);
      if (!res.ok || data.error) throw new Error(data.error || data.message || 'Could not read resume');
      setAddForm({
        ...addForm,
        mode: 'new',
        candidateId: '',
        name: data.name || addForm.name,
        email: data.email || addForm.email,
        phone: data.contact || data.phone || addForm.phone,
      });
      toast.success('Resume parsed — review the fields, then add to the job.');
    } catch (err) {
      toast.error(err.message || 'Resume parsing failed');
      setResumeName('');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const selected = addForm.mode === 'existing' && addForm.candidateId;

  return (
    <div className="space-y-5">
      <div>
        <label className="label-ats">Job *</label>
        <PremiumSelect
          variant="list"
          value={addForm.jobId}
          onChange={(v) => setAddForm({ ...addForm, jobId: v })}
          options={jobOptions}
          placeholder="Select a job"
          icon={Briefcase}
          searchable
          searchPlaceholder="Search jobs…"
          emptyLabel="No jobs found"
        />
      </div>

      <div>
        <label className="label-ats">Candidate *</label>
        <div className="flex h-[42px] items-center rounded-xl border border-stone-200 bg-stone-50 p-1 gap-1 mb-3">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`flex-1 h-full inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold px-2.5 transition-all ${
              addForm.mode === 'existing'
                ? 'bg-white text-brand-700 shadow-sm border border-stone-200/80'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            From talent pool
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`flex-1 h-full inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold px-2.5 transition-all ${
              addForm.mode === 'new'
                ? 'bg-white text-brand-700 shadow-sm border border-stone-200/80'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            New person
          </button>
        </div>

        {addForm.mode === 'existing' ? (
          selected ? (
            <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-3 py-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {(addForm.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-stone-900 truncate">{addForm.name}</p>
                <p className="text-xs text-stone-500 truncate">{addForm.email}{addForm.phone ? ` · ${addForm.phone}` : ''}</p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-700 bg-white border border-brand-200 rounded-md px-1.5 py-0.5">
                <Check size={10} /> In database
              </span>
              <button type="button" onClick={clearCandidate} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-white" aria-label="Clear candidate">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div>
              <div className="relative mb-2">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={addForm.jobId ? 'Optional — suggested people are below' : 'Search name, email, or phone…'}
                  className="input-ats input-ats-icon"
                  autoComplete="off"
                />
              </div>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-stone-200 bg-white">
                {searching ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-brand-600 animate-spin" /></div>
                ) : results.length === 0 ? (
                  <EmptyState
                    icon={query ? Search : User}
                    tone={query ? 'amber' : 'brand'}
                    compact
                    message={query ? 'No match' : (addForm.jobId ? 'No matching pool members yet' : 'Select a job first')}
                    subMessage={query ? 'Try another name, or switch to New person.' : 'Rejects from similar roles appear here automatically.'}
                  />
                ) : (
                  <>
                    {fromPool && !query && (
                      <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 bg-brand-50/70 border-b border-stone-100">
                        Suggested from talent pools
                      </p>
                    )}
                    {results.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => pickCandidate(c)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-brand-50/60 border-b border-stone-100 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {(c.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-stone-900 truncate">{c.name}</p>
                        <p className="text-xs text-stone-500 truncate">
                          {c.email}{c.position ? ` · ${c.position}` : ''}
                          {c.poolNames?.length ? ` · ${c.poolNames.join(', ')}` : ''}
                        </p>
                      </div>
                    </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <label
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-4 text-center cursor-pointer transition-colors ${
                parsing ? 'border-brand-300 bg-brand-50/40' : 'border-stone-200 hover:border-brand-300 hover:bg-stone-50'
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                parseResume(e.dataTransfer.files?.[0]);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.rtf,application/pdf"
                className="sr-only"
                onChange={(e) => parseResume(e.target.files?.[0])}
              />
              {parsing ? (
                <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-stone-400" />
              )}
              <span className="text-sm font-semibold text-stone-700">
                {parsing ? 'Reading resume…' : resumeName || 'Drop a resume to fill details'}
              </span>
              <span className="text-xs text-stone-500">PDF, DOC, DOCX — or type below if you don’t have a file</span>
            </label>

            <div>
              <label className="label-ats">Candidate Name *</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                <input
                  required={addForm.mode === 'new'}
                  type="text"
                  className="field-premium field-premium-icon"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="Full name"
                  autoComplete="name"
                />
              </div>
            </div>
            <div>
              <label className="label-ats">Email *</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                <input
                  required={addForm.mode === 'new'}
                  type="email"
                  className="field-premium field-premium-icon"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="name@email.com"
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <label className="label-ats">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                <input
                  type="tel"
                  className="field-premium field-premium-icon"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="Optional"
                  autoComplete="tel"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="label-ats">Source</label>
        <PremiumSelect
          variant="list"
          value={addForm.source}
          onChange={(v) => setAddForm({ ...addForm, source: v || 'Direct' })}
          options={SOURCE_OPTIONS}
          placeholder="Select source"
          icon={FileText}
        />
      </div>
    </div>
  );
}
