import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, ThumbsUp, ThumbsDown, Loader2, Edit2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from './ui/PageHeader';
import Modal from './ui/Modal';
import { BASE_API_URL } from '../config';
import { authenticatedFetch } from '../utils/fetchUtils';
import { useToast } from './Toast';

const PARSING_SESSION_KEY = 'resumeParsingSession';

const ResumeParsing = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [approvedIdx, setApprovedIdx] = useState(new Set()); // indexes of approved
  const [editBuffer, setEditBuffer] = useState({
    name: '',
    email: '',
    contact: '',
    position: '',
    company: '',
    experience: '',
    location: '',
    skills: '',
    education: ''
  });

  // Restore parsing session when returning from Add Candidate (so list doesn't disappear)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PARSING_SESSION_KEY);
      if (raw) {
        const { results: r, uploadedFiles: f } = JSON.parse(raw);
        if (Array.isArray(r) && r.length > 0) {
          setResults(r);
          setUploadedFiles(Array.isArray(f) ? f : []);
          setApprovedIdx(new Set(r.map((_, i) => i).filter(i => r[i].success)));
          toast.success('Previous parsing session restored. You can add more or add all as candidates.');
        }
        sessionStorage.removeItem(PARSING_SESSION_KEY);
      }
    } catch (_) { /* ignore */ }
  }, [toast]);

  // Handle file selection
  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    setParsing(true);
    setError('');
    setResults([]);

    try {
      const newResults = [];


      for (const file of files) {
        const formData = new FormData();
        formData.append('resume', file);

        try {
          // Add 60s timeout per resume to handle large/complex files
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);

          const parseUrl = `${BASE_API_URL}/candidates/parse-logic`;
          console.log('📄 Resume parse request:', { url: parseUrl, fileName: file.name, fileSize: file.size, fileType: file.type, hasToken: !!localStorage.getItem('token') });

          const response = await authenticatedFetch(parseUrl, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            let backendError = 'Failed to parse resume';
            try {
              const errorData = await response.json();
              backendError = errorData?.error || errorData?.message || backendError;
              // Print full backend error to console for debugging
              console.error('Resume parsing backend error:', JSON.stringify(errorData, null, 2));
              console.error('Resume parsing error details:', errorData?.details || 'No details');
              console.error('Resume parsing suggestion:', errorData?.suggestion || 'None');
            } catch (jsonErr) {
              // Print raw response if not JSON
              const text = await response.text();
              console.error('Resume parsing backend error (non-JSON):', text);
            }
            newResults.push({
              fileName: file.name,
              success: false,
              error: backendError,
              data: null,
            });
            continue;
          }

          const result = await response.json();
          newResults.push({
            fileName: file.name,
            success: true,
            error: null,
            data: {
              name: result.parsed?.name || result.name || '',
              email: result.parsed?.email || result.email || '',
              contact: result.parsed?.contact || result.contact || '',
              position: result.parsed?.position || result.position || '',
              company: result.parsed?.company || result.company || '',
              experience: result.parsed?.experience || result.experience || '',
              location: result.parsed?.location || result.location || '',
              skills: result.parsed?.skills || result.skills || '',
              education: result.parsed?.education || result.education || ''
            },
            confidence: result.parsed?.confidence || result.confidence || {},
            metadata: result.metadata || {}
          });
        } catch (err) {
          // Detailed fetch/network error to console
          console.error('❌ Resume parsing fetch error:', {
            name: err.name,
            message: err.message,
            url: `${BASE_API_URL}/candidates/parse-logic`,
            fileName: file.name,
            stack: err.stack
          });
          const errorMsg = err.name === 'AbortError'
            ? 'Request timed out. This resume may be scanned/image-based. Please try a text-based PDF or DOCX.'
            : err.message;
          newResults.push({
            fileName: file.name,
            success: false,
            error: errorMsg,
            data: null,
          });
        }

        // Delay between files to let server finish processing
        if (files.length > 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      setUploadedFiles(files.map(f => ({ name: f.name, size: f.size })));
      setResults(newResults);
    } catch (err) {
      setError('Error processing files: ' + err.message);
    } finally {
      setParsing(false);
    }
  };


  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  // Get confidence color and label
  const getConfidenceColor = (score) => {
    if (score >= 85) return { bg: 'bg-green-100', text: 'text-green-700', label: 'High' };
    if (score >= 70) return { bg: 'bg-sky-100', text: 'text-sky-700', label: 'Medium' };
    if (score >= 50) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Low' };
    return { bg: 'bg-red-100', text: 'text-red-700', label: 'Very Low' };
  };

  // Start editing a result
  const handleEdit = (idx) => {
    setEditingIdx(idx);
    setEditBuffer({
      name: results[idx].data?.name || '',
      email: results[idx].data?.email || '',
      contact: results[idx].data?.contact || '',
      position: results[idx].data?.position || '',
      company: results[idx].data?.company || '',
      experience: results[idx].data?.experience || '',
      location: results[idx].data?.location || '',
      skills: results[idx].data?.skills || '',
      education: results[idx].data?.education || ''
    });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingIdx(null);
    setEditBuffer({
      name: '',
      email: '',
      contact: '',
      position: '',
      company: '',
      experience: '',
      location: '',
      skills: '',
      education: ''
    });
  };

  // Save edited data
  const handleSaveEdit = (idx) => {
    setResults(prev => prev.map((r, i) =>
      i === idx ? { ...r, data: { ...r.data, ...editBuffer } } : r
    ));
    setEditingIdx(null);
    setEditBuffer({ name: '', email: '', contact: '', position: '', company: '', experience: '', location: '', skills: '', education: '' });
  };

  // Handle edit buffer change
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditBuffer(prev => ({ ...prev, [name]: value }));
  };

  // Add single candidate (navigate to add-candidate with prefill); persist results so they're restored on return
  const addToCandidate = (resultData) => {
    try {
      sessionStorage.setItem(PARSING_SESSION_KEY, JSON.stringify({ results, uploadedFiles }));
    } catch (_) { /* ignore */ }
    localStorage.setItem('parsedResumeData', JSON.stringify(resultData));
    navigate('/ats');
  };

  // Add all successfully parsed resumes as candidates at once
  const [addingAll, setAddingAll] = useState(false);
  const [confirmAddAllOpen, setConfirmAddAllOpen] = useState(false);
  const [addSuccessModal, setAddSuccessModal] = useState(null); // { created, skipped, errors }
  const successfulResults = results.filter(r => r.success && r.data);
  const approvedDataList = results.filter((r, i) => r.success && r.data && approvedIdx.has(i)).map(r => r.data);

  const openConfirmAddAll = () => {
    if (!approvedDataList.length) {
      toast.error('No approved resumes to add. Approve at least one.');
      return;
    }
    setConfirmAddAllOpen(true);
  };

  const addAllAsCandidates = async () => {
    setConfirmAddAllOpen(false);
    const toAdd = approvedDataList;
    if (!toAdd.length) return;

    const candidates = toAdd.map(c => ({
      name: c.name || '',
      email: c.email || '',
      contact: c.contact || '',
      position: c.position || '',
      company: c.company || c.companyName || '',
      experience: c.experience || '',
      location: c.location || '',
      skills: c.skills || '',
      education: c.education || '',
      ctc: c.ctc || 'Not disclosed'
    }));

    setAddingAll(true);
    try {
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/bulk-from-parsed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to add candidates');

      const { created = 0, skipped = 0, errors: errCount = 0 } = data;
      setAddSuccessModal({ created, skipped, errors: errCount });
    } catch (err) {
      toast.error(err.message || 'Failed to add candidates');
    } finally {
      setAddingAll(false);
    }
  };

  return (
    <div className="page-shell-ats">
      <PageHeader
        icon={FileText}
        title="Resume Parsing"
        subtitle="Upload resumes — extract contact info, skills, and experience for review"
        gradientTitle
      />

      {/* Upload zone */}
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-dashed border-stone-300 bg-gradient-to-br from-stone-50 via-white to-brand-50/40 hover:border-brand-400 transition-colors"
      >
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(13,148,136,0.06),_transparent_55%)]" />
        <label className={`relative block px-6 py-12 sm:py-16 text-center cursor-pointer ${parsing ? 'opacity-70 pointer-events-none' : ''}`}>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center mx-auto mb-5 shadow-sm border border-brand-200/60">
            {parsing ? (
              <Loader2 size={28} className="text-brand-600 animate-spin" />
            ) : (
              <Upload size={28} className="text-brand-600" strokeWidth={1.75} />
            )}
          </div>
          <h3 className="text-xl font-semibold text-stone-900 mb-2 tracking-tight">
            {parsing ? 'Analysing resumes…' : 'Drop resumes to get started'}
          </h3>
          <p className="text-stone-500 text-sm mb-6 max-w-md mx-auto">
            {parsing
              ? 'Pulling out name, contact, skills, and experience'
              : 'PDF files up to 10 MB. Drag and drop, or choose files.'}
          </p>
          {!parsing && (
            <span className="inline-flex items-center gap-2 px-7 py-3.5 bg-brand-600 text-white rounded-xl font-semibold shadow-lg shadow-brand-500/25 pointer-events-none">
              <Upload size={18} /> Choose files
            </span>
          )}
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx"
            onChange={handleFileSelect}
            disabled={parsing}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>

        {error && (
          <div className="mx-6 mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* How it works — only when idle */}
      {results.length === 0 && !parsing && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { n: '1', title: 'Upload', desc: 'PDF or Word resumes' },
              { n: '2', title: 'Extract', desc: 'AI reads each file' },
              { n: '3', title: 'Review', desc: 'Approve or edit fields' },
              { n: '4', title: 'Save', desc: 'Add to Candidates' },
            ].map((s) => (
              <div key={s.n} className="flex items-start gap-3 p-4 rounded-xl bg-white border border-stone-200 shadow-[var(--shadow-card)]">
                <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0">{s.n}</div>
                <div>
                  <p className="font-semibold text-stone-900 text-sm">{s.title}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white border border-stone-200 p-5 sm:p-6 shadow-[var(--shadow-card)]">
            <h3 className="font-bold text-stone-900 mb-3 text-sm flex items-center gap-2">
              <Sparkles size={14} className="text-brand-600" /> What we pull from each resume
            </h3>
            <div className="flex flex-wrap gap-2">
              {['Name', 'Email', 'Phone', 'Position', 'Company', 'Experience', 'Location', 'Education', 'Skills'].map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-stone-50 border border-stone-200 text-stone-700">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {f}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs text-stone-500 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              Best results with text-based PDFs — not scanned images. Always review before saving.
            </p>
          </div>
        </>
      )}

      {uploadedFiles.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-[var(--shadow-card)]">
          <h3 className="text-sm font-bold text-stone-900 mb-3">Uploaded files</h3>
          <div className="space-y-2">
            {uploadedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0 border border-brand-100">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 truncate">{file.name}</p>
                    <p className="text-xs text-stone-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                {parsing && (
                  <span className="text-xs font-medium text-brand-600 flex items-center gap-1.5">
                    <Loader2 size={14} className="animate-spin" /> Processing…
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {parsing && results.length === 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-[var(--shadow-card)]">
          <Loader2 size={36} className="animate-spin text-brand-600 mx-auto mb-3" />
          <p className="text-stone-700 font-semibold">Parsing resumes…</p>
          <p className="text-xs text-stone-400 mt-1">This can take a moment for larger files</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-5 animate-slide-up">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <h2 className="text-lg font-bold text-stone-900 tracking-tight">Parsing results</h2>
              <p className="text-xs text-stone-500 mt-0.5">{approvedDataList.length} approved · {successfulResults.length} parsed successfully</p>
            </div>
            <button
              type="button"
              onClick={openConfirmAddAll}
              disabled={addingAll || approvedDataList.length === 0}
              className="btn-primary"
            >
              {addingAll ? (<><Loader2 size={18} className="animate-spin" /> Adding…</>) : (<>Add {approvedDataList.length} approved</>)}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-stone-200 bg-white p-4 border-l-4 border-l-emerald-500 shadow-[var(--shadow-card)]">
              <p className="text-2xl font-bold text-emerald-700 tabular-nums">{results.filter(r => r.success).length}</p>
              <p className="text-xs font-semibold text-emerald-600 mt-0.5">Parsed</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-4 border-l-4 border-l-red-400 shadow-[var(--shadow-card)]">
              <p className="text-2xl font-bold text-red-700 tabular-nums">{results.filter(r => !r.success).length}</p>
              <p className="text-xs font-semibold text-red-600 mt-0.5">Failed</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-4 border-l-4 border-l-brand-500 shadow-[var(--shadow-card)]">
              <p className="text-2xl font-bold text-brand-700 tabular-nums">{approvedDataList.length}</p>
              <p className="text-xs font-semibold text-brand-600 mt-0.5">Approved</p>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between mb-5">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-100 text-stone-600 border border-stone-200">
                {currentSlide + 1} of {results.length}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCurrentSlide(s => Math.max(0, s - 1))} disabled={currentSlide === 0} className="btn-secondary !p-2.5 !px-2.5" aria-label="Previous">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" onClick={() => setCurrentSlide(s => Math.min(results.length - 1, s + 1))} disabled={currentSlide === results.length - 1} className="btn-secondary !p-2.5 !px-2.5" aria-label="Next">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            {(() => {
              const result = results[currentSlide];
              const isApproved = approvedIdx.has(currentSlide);
              const isEditing = editingIdx === currentSlide;
              const fields = [
                { key: 'name', label: 'Name', type: 'text' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'contact', label: 'Contact', type: 'tel' },
                { key: 'position', label: 'Position', type: 'text' },
                { key: 'company', label: 'Company', type: 'text' },
                { key: 'experience', label: 'Experience', type: 'text' },
                { key: 'location', label: 'Location', type: 'text' },
                { key: 'education', label: 'Education', type: 'text' },
                { key: 'skills', label: 'Skills', type: 'text' }
              ];
              return (
                <div className={`rounded-2xl border p-5 transition-all ${result.success ? 'bg-stone-50/50 border-stone-200' : 'bg-red-50/60 border-red-200'}`}>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 border border-brand-200/60 flex items-center justify-center flex-shrink-0">
                        <Sparkles size={18} className="text-brand-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-stone-900 truncate">{result.fileName}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{result.success ? 'AI extracted data — review before saving' : 'Parse failed'}</p>
                        {!result.success && result.error && (
                          <p className="mt-2 text-sm text-red-700 font-medium">{result.error}</p>
                        )}
                      </div>
                    </div>
                    {result.success && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        {!isEditing && (
                          <button type="button" onClick={() => handleEdit(currentSlide)} className="p-2.5 rounded-xl bg-white border border-stone-200 text-stone-600 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors" title="Edit">
                            <Edit2 size={16} />
                          </button>
                        )}
                        <button type="button" onClick={() => setApprovedIdx(prev => { const n = new Set(prev); n.add(currentSlide); return n; })} className={`p-2.5 rounded-xl border transition-colors ${isApproved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white border-stone-200 text-stone-500 hover:bg-emerald-50'}`} title="Approve">
                          <ThumbsUp size={16} />
                        </button>
                        <button type="button" onClick={() => setApprovedIdx(prev => { const n = new Set(prev); n.delete(currentSlide); return n; })} className={`p-2.5 rounded-xl border transition-colors ${!isApproved ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white border-stone-200 text-stone-500 hover:bg-red-50'}`} title="Reject">
                          <ThumbsDown size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  {result.success && result.data && (
                    <>
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            {fields.map(({ key: k, label, type }) => (
                              <div key={k} className={k === 'skills' ? 'sm:col-span-2' : ''}>
                                <label className="label-ats">{label}</label>
                                {k === 'skills' ? (
                                  <textarea name={k} value={editBuffer[k] || ''} onChange={handleEditChange} rows={2} className="textarea-ats" placeholder={label} />
                                ) : (
                                  <input type={type} name={k} value={editBuffer[k] || ''} onChange={handleEditChange} className="input-ats" placeholder={label} />
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2 pt-3 border-t border-stone-200">
                            <button type="button" onClick={() => handleSaveEdit(currentSlide)} className="btn-primary !py-2">Save</button>
                            <button type="button" onClick={handleCancelEdit} className="btn-secondary !py-2">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          {fields.map(({ key: k, label }) => {
                            const confidence = result.confidence?.[k] || 0;
                            const confidenceColor = confidence >= 85 ? 'badge-success' : confidence >= 70 ? 'badge-info' : confidence >= 50 ? 'badge-warning' : 'badge-danger';
                            return (
                              <div key={k} className="rounded-xl border border-stone-200 px-3 py-2.5 bg-white flex items-start justify-between gap-2 hover:border-brand-200 transition-colors">
                                <div className="min-w-0 flex-1">
                                  <span className="text-stone-500 text-[10px] font-bold uppercase tracking-wide block mb-0.5">{label}</span>
                                  <span className="text-stone-900 font-medium break-words">{result.data[k] || '—'}</span>
                                </div>
                                {confidence > 0 && (
                                  <span className={`shrink-0 ${confidenceColor}`}>{Math.round(confidence)}%</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {!isEditing && (
                        <div className="mt-5 pt-4 border-t border-stone-200 flex flex-wrap justify-center gap-2">
                          <button type="button" onClick={() => addToCandidate(result.data)} className="btn-primary min-w-[200px]">
                            Add as Candidate
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <Modal
        open={confirmAddAllOpen}
        onClose={() => setConfirmAddAllOpen(false)}
        title="Add candidates to database"
        description={`Add ${approvedDataList.length} candidate(s) from the parsed resumes to your Candidates list? Duplicates (same email/phone) will be skipped.`}
        footer={
          <>
            <button type="button" onClick={() => setConfirmAddAllOpen(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={addAllAsCandidates} disabled={addingAll} className="btn-primary">
              {addingAll ? <Loader2 size={18} className="animate-spin" /> : null}
              Add candidates
            </button>
          </>
        }
      />

      <Modal
        open={!!addSuccessModal}
        onClose={() => setAddSuccessModal(null)}
        title="Candidates added"
        description={addSuccessModal ? `${addSuccessModal.created} candidate(s) added to your database.${addSuccessModal.skipped || addSuccessModal.errors ? ` ${addSuccessModal.skipped || 0} skipped · ${addSuccessModal.errors || 0} failed.` : ''}` : ''}
        footer={
          <>
            <button type="button" onClick={() => setAddSuccessModal(null)} className="btn-secondary">Stay here</button>
            <button type="button" onClick={() => { setAddSuccessModal(null); navigate('/ats'); }} className="btn-primary">Go to Candidates</button>
          </>
        }
      >
        <div className="flex justify-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <CheckCircle size={28} className="text-emerald-600" />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ResumeParsing;
