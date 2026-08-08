/**
 * Resume AI Parser Page
 * ======================
 * Enterprise-grade server-side resume parsing.
 * Supports PDF, DOCX, DOC, TXT. Extracts 15+ structured fields including
 * work history, education, certifications, social links, and confidence score.
 */
'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, Sparkles, User, Mail, Phone, Briefcase,
  GraduationCap, CheckCircle, X, Download, AlertTriangle, Plus,
  MapPin, Linkedin, Github, Globe, Award, Clock,
  Building2, Calendar, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';

// ─────────────────────────────────────────────────────────────────────────────
// Types matching the server API response
// ─────────────────────────────────────────────────────────────────────────────
interface WorkItem {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}
interface EduItem {
  degree: string;
  institution: string;
  year: string;
  gpa: string;
}
interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
  currentTitle: string;
  skills: string[];
  experienceYears: number | null;
  workExperience: WorkItem[];
  education: EduItem[];
  certifications: string[];
  languages: string[];
  summary: string;
  _confidence: number;
  _meta?: { parseMethod: string; textLength: number; fileName: string; fileSize: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function confidenceLabel(n: number): { label: string; cls: string; icon: typeof CheckCircle } {
  if (n >= 70) return { label: `High confidence (${n}%)`, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle };
  if (n >= 40) return { label: `Review recommended (${n}%)`, cls: 'text-amber-700 bg-amber-50 border-amber-200', icon: AlertTriangle };
  return { label: `Low quality — edit manually (${n}%)`, cls: 'text-red-700 bg-red-50 border-red-200', icon: AlertTriangle };
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
        <Icon className="w-3.5 h-3.5 text-brand-500" />{label}
      </label>
      {children}
    </div>
  );
}

function WorkSection({ items }: { items: WorkItem[] }) {
  const [open, setOpen] = useState(true);
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-stone-200 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 hover:bg-stone-100 transition-colors"
      >
        <span className="flex items-center gap-2 font-semibold text-stone-800 text-sm">
          <Building2 className="w-4 h-4 text-brand-500" /> Work Experience ({items.length})
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="divide-y divide-stone-100">
              {items.map((w, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-stone-900 text-sm">{w.title || '—'}</p>
                      <p className="text-xs text-stone-500">{w.company || '—'}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-stone-400 whitespace-nowrap">
                      <Calendar className="w-3 h-3" />
                      {w.startDate} – {w.endDate}
                      {w.current && <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">Current</span>}
                    </div>
                  </div>
                  {w.description && <p className="mt-1 text-xs text-stone-500 line-clamp-2">{w.description}</p>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EduSection({ items }: { items: EduItem[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-stone-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-stone-50 font-semibold text-stone-800 text-sm">
        <GraduationCap className="w-4 h-4 text-brand-500" /> Education
      </div>
      <div className="divide-y divide-stone-100">
        {items.map((e, i) => (
          <div key={i} className="px-4 py-3">
            <p className="font-semibold text-stone-900 text-sm">{e.degree || '—'}</p>
            <p className="text-xs text-stone-500">{e.institution}</p>
            {(e.year || e.gpa) && (
              <p className="text-xs text-stone-400 mt-0.5">
                {e.year}{e.year && e.gpa ? ' · ' : ''}{e.gpa ? `GPA ${e.gpa}` : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────────────────────
export default function ResumeParserPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParsedResume | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // ── Upload & parse via server API ──────────────────────────────────────────
  const parseFile = useCallback(async (selected: File) => {
    setFile(selected);
    setResult(null);
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', selected);
      const res = await fetch('/api/resume-parse', { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Parse failed (${res.status})`);
      }
      const data: ParsedResume = await res.json();
      setResult(data);
      if (data._confidence >= 70) {
        toast.success('Resume parsed', 'Review the extracted data below before saving.');
      } else if (data._confidence >= 40) {
        toast.info('Parsed with partial data', 'Some fields may need manual review.');
      } else {
        toast.warning('Low-quality extraction', 'This file may be image-based. Please edit fields manually.');
      }
    } catch (err: any) {
      toast.error('Parse failed', err?.message || 'Try a different file.');
    } finally {
      setParsing(false);
    }
  }, [toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) parseFile(f);
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) parseFile(f);
  }, [parseFile]);

  // ── Edit helpers ───────────────────────────────────────────────────────────
  const set = <K extends keyof ParsedResume>(key: K, value: ParsedResume[K]) => {
    if (result) setResult({ ...result, [key]: value });
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s || !result || result.skills.includes(s)) return;
    set('skills', [...result.skills, s]);
    setNewSkill('');
  };

  // ── Save to candidates database ────────────────────────────────────────────
  const save = async () => {
    if (!result) return;
    if (!result.name.trim() || !result.email.trim()) {
      toast.error('Name and email are required'); return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name:          result.name.trim(),
          email:         result.email.trim(),
          phone:         result.phone || undefined,
          location:      result.location || undefined,
          currentTitle:  result.currentTitle || undefined,
          linkedInUrl:   result.linkedin || undefined,
          githubUrl:     result.github || undefined,
          portfolioUrl:  result.portfolio || undefined,
          skills:        result.skills,
          experience:    result.experienceYears ?? undefined,
          summary:       result.summary || undefined,
          source:        'Resume Parser',
          tags:          result.certifications.slice(0, 5),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Save failed');
      }
      toast.success('Candidate saved', `${result.name} added to your pipeline.`);
    } catch (err: any) {
      toast.error('Save failed', err?.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Export JSON ────────────────────────────────────────────────────────────
  const exportJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.name.replace(/\s+/g, '_')}_parsed.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success('JSON exported');
  };

  const inputCls = 'w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none transition-all bg-white';
  const badge = result ? confidenceLabel(result._confidence) : null;

  const EXTRACT_FIELDS = [
    'Full Name', 'Email & Phone', 'Location', 'Current Job Title',
    'LinkedIn & GitHub', 'Portfolio URL', 'Skills',
    'Work History', 'Years Experience', 'Education',
    'Certifications', 'Languages', 'Summary',
  ] as const;

  const fieldStatus = result
    ? [
        { label: 'Full Name', ok: !!result.name?.trim() },
        { label: 'Email', ok: !!result.email?.trim() },
        { label: 'Phone', ok: !!result.phone?.trim() },
        { label: 'Location', ok: !!result.location?.trim() },
        { label: 'Job Title', ok: !!result.currentTitle?.trim() },
        { label: 'Skills', ok: result.skills.length > 0 },
        { label: 'Work History', ok: result.workExperience.length > 0 },
        { label: 'Education', ok: result.education.length > 0 },
        { label: 'Summary', ok: !!result.summary?.trim() },
      ]
    : [];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <PageShell>
      <PageHeader
        icon={Upload}
        title="Resume AI Parser"
        subtitle="Upload a resume — we extract contact info, skills, work history, and more"
      />

      {/* ── Empty state: full-width upload (no side-panel gap) ── */}
      {!result && (
        <div className="space-y-5">
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="relative overflow-hidden rounded-2xl border-2 border-dashed border-stone-300 bg-gradient-to-br from-stone-50 via-white to-brand-50/40 text-center hover:border-brand-400 transition-colors"
          >
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(13,148,136,0.06),_transparent_55%)]" />
            <div className="relative px-6 py-12 sm:py-16">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center mx-auto mb-5 shadow-sm">
                {parsing ? (
                  <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileText className="w-8 h-8 text-brand-600" />
                )}
              </div>
              <h3 className="text-xl font-semibold text-stone-900 mb-2">
                {parsing ? 'Analysing resume…' : 'Drop a resume to get started'}
              </h3>
              <p className="text-stone-500 text-sm mb-7 max-w-md mx-auto">
                {parsing
                  ? 'Pulling out name, contact details, skills, work history, education, and more'
                  : 'PDF, Word, or text files up to 5 MB. Drag and drop, or choose a file.'}
              </p>
              {!parsing && (
                <label className="inline-flex items-center gap-2 px-7 py-3.5 bg-brand-600 text-white rounded-xl font-semibold cursor-pointer hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/25">
                  <Upload className="w-5 h-5" />
                  Choose File
                  <input type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={handleFileInput} />
                </label>
              )}
              {file && !parsing && (
                <p className="mt-4 text-xs text-stone-400">{file.name} · {fmtBytes(file.size)}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { n: '1', title: 'Upload', desc: 'PDF, DOCX, or TXT' },
              { n: '2', title: 'Extract', desc: 'AI reads the resume' },
              { n: '3', title: 'Review', desc: 'Fix anything needed' },
              { n: '4', title: 'Save', desc: 'Add to your pipeline' },
            ].map(s => (
              <div key={s.n} className="flex items-start gap-3 p-4 rounded-xl bg-white border border-stone-200">
                <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0">{s.n}</div>
                <div>
                  <p className="font-semibold text-stone-900 text-sm">{s.title}</p>
                  <p className="text-xs text-stone-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white border border-stone-200 p-5 sm:p-6">
            <h3 className="font-bold text-stone-900 mb-3 text-sm">What we pull from each resume</h3>
            <div className="flex flex-wrap gap-2">
              {EXTRACT_FIELDS.map(f => (
                <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-stone-50 border border-stone-200 text-stone-700">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {f}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs text-stone-500 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              Best results with text-based PDFs or Word files — not scanned images. Always review before saving.
            </p>
          </div>
        </div>
      )}

      {/* ── Results: form + live field checklist ── */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 xl:grid-cols-3 gap-5"
          >
            <div className="xl:col-span-2 p-6 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-bold text-stone-900 text-sm">AI Extracted Data</p>
                    <p className="text-xs text-stone-400">{file?.name} · {result._meta?.parseMethod}</p>
                  </div>
                </div>
                <button onClick={() => { setResult(null); setFile(null); }} className="p-2 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-red-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {badge && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${badge.cls}`}>
                  <badge.icon className="w-3.5 h-3.5" />
                  {badge.label}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name" icon={User}>
                  <input value={result.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="Candidate name" />
                </Field>
                <Field label="Current Title" icon={Briefcase}>
                  <input value={result.currentTitle} onChange={e => set('currentTitle', e.target.value)} className={inputCls} placeholder="e.g. Senior Engineer" />
                </Field>
                <Field label="Email" icon={Mail}>
                  <input type="email" value={result.email} onChange={e => set('email', e.target.value)} className={inputCls} placeholder="email@example.com" />
                </Field>
                <Field label="Phone" icon={Phone}>
                  <input type="tel" value={result.phone} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder="+1 (555) 000-0000" />
                </Field>
                <Field label="Location" icon={MapPin}>
                  <input value={result.location} onChange={e => set('location', e.target.value)} className={inputCls} placeholder="City, State" />
                </Field>
                <Field label="Experience (years)" icon={Clock}>
                  <input type="number" value={result.experienceYears ?? ''} onChange={e => set('experienceYears', e.target.value ? Number(e.target.value) : null)} className={inputCls} placeholder="e.g. 5" min={0} max={50} />
                </Field>
                <Field label="LinkedIn" icon={Linkedin}>
                  <input value={result.linkedin} onChange={e => set('linkedin', e.target.value)} className={inputCls} placeholder="https://linkedin.com/in/..." />
                </Field>
                <Field label="GitHub" icon={Github}>
                  <input value={result.github} onChange={e => set('github', e.target.value)} className={inputCls} placeholder="https://github.com/..." />
                </Field>
                {result.portfolio && (
                  <Field label="Portfolio" icon={Globe}>
                    <input value={result.portfolio} onChange={e => set('portfolio', e.target.value)} className={inputCls} placeholder="https://..." />
                  </Field>
                )}
              </div>

              <Field label="Skills Detected" icon={Briefcase}>
                <div className="flex flex-wrap gap-1.5 mb-2 min-h-[32px]">
                  {result.skills.map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 text-brand-700 rounded-lg text-xs font-medium border border-brand-200">
                      {s}
                      <button type="button" onClick={() => set('skills', result.skills.filter((_, j) => j !== i))} className="hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {!result.skills.length && <span className="text-xs text-stone-400 italic">No skills detected — add manually</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newSkill}
                    onChange={e => setNewSkill(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                    className={inputCls + ' flex-1'}
                    placeholder="Add skill and press Enter…"
                  />
                  <button type="button" onClick={addSkill} className="px-3 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </Field>

              <WorkSection items={result.workExperience} />
              <EduSection items={result.education} />

              {(result.certifications.length > 0 || result.languages.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {result.certifications.length > 0 && (
                    <div className="p-4 rounded-xl border border-stone-200 bg-stone-50">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase mb-2">
                        <Award className="w-3.5 h-3.5 text-brand-500" /> Certifications
                      </p>
                      <ul className="space-y-1">
                        {result.certifications.map((c, i) => (
                          <li key={i} className="text-xs text-stone-700 flex items-start gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />{c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.languages.length > 0 && (
                    <div className="p-4 rounded-xl border border-stone-200 bg-stone-50">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase mb-2">
                        <Globe className="w-3.5 h-3.5 text-brand-500" /> Languages
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.languages.map((l, i) => (
                          <span key={i} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium border border-indigo-200">{l}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Field label="Professional Summary" icon={FileText}>
                <textarea value={result.summary} onChange={e => set('summary', e.target.value)} rows={4} className={inputCls + ' resize-none'} placeholder="Professional summary…" />
              </Field>

              <div className="flex gap-2 pt-2">
                <motion.button
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={save} disabled={saving}
                  className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-brand-500/20"
                >
                  <CheckCircle className="w-4 h-4" />
                  {saving ? 'Saving…' : 'Save Candidate'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={exportJSON}
                  className="px-4 py-3 border border-stone-200 text-stone-700 rounded-xl font-semibold hover:bg-stone-50 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> JSON
                </motion.button>
                <label className="px-4 py-3 border border-stone-200 text-stone-700 rounded-xl font-semibold hover:bg-stone-50 transition-colors flex items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" /> New
                  <input type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={handleFileInput} />
                </label>
              </div>
            </div>

            <div className="space-y-4 xl:sticky xl:top-4 self-start">
              <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm">
                <h3 className="font-bold text-stone-900 mb-1 text-sm">Extraction checklist</h3>
                <p className="text-xs text-stone-500 mb-4">Green means we found it — edit anything that looks off.</p>
                <div className="space-y-2">
                  {fieldStatus.map(f => (
                    <div key={f.label} className="flex items-center gap-2 text-sm">
                      <CheckCircle className={`w-4 h-4 shrink-0 ${f.ok ? 'text-emerald-500' : 'text-stone-300'}`} />
                      <span className={f.ok ? 'text-stone-700' : 'text-stone-400'}>{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-800 leading-relaxed">
                  Double-check name and email before saving — those are required to add the candidate to your pipeline.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
    </motion.div>
  );
}
