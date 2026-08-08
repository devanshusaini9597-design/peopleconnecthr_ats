'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Sparkles, X, CheckCircle, Briefcase, GraduationCap, Mail, User, Phone, MapPin, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface ParsedData {
  name: string;
  email: string;
  phone: string;
  location: string;
  currentTitle: string;
  skills: string[];
  experienceYears: number | null;
  summary: string;
  _confidence: number;
  education: { degree: string; institution: string; year: string; gpa: string }[];
}

interface ResumeParserProps {
  candidateId: string;
  onParsed?: (data: ParsedData) => void;
}

export function ResumeParserPanel({ candidateId: _candidateId, onParsed }: ResumeParserProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      parseResume(selected);
    }
    e.target.value = '';
  };

  const parseResume = async (selectedFile: File) => {
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      const res = await fetch('/api/resume-parse', { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Parse failed (${res.status})`);
      }
      const data: ParsedData = await res.json();
      setParsed(data);
      onParsed?.(data);
      toast.success('Resume parsed', data._confidence >= 70 ? 'High-confidence extraction.' : 'Review extracted data carefully.');
    } catch (err: any) {
      toast.error('Failed to parse resume', err?.message);
    } finally {
      setParsing(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setParsed(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {!parsed ? (
        <div className="rounded-xl border-2 border-dashed border-stone-200 bg-stone-50/50 p-8 sm:p-12 text-center">
          <motion.div initial={{ scale: 1 }} animate={{ scale: parsing ? 0.95 : 1 }} className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-100 to-teal-100 flex items-center justify-center mx-auto mb-4">
              {parsing ? (
                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-8 h-8 text-brand-600" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-stone-900 mb-2">
              {parsing ? 'Analysing resume…' : 'Upload Resume'}
            </h3>
            <p className="text-stone-500 text-sm mb-6 max-w-xs mx-auto">
              {parsing
                ? 'Extracting name, contact info, skills, experience & education'
                : 'PDF, DOCX, DOC, or TXT supported (max 5 MB).'}
            </p>
            {!parsing && (
              <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-semibold text-sm cursor-pointer hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/25">
                <FileText className="w-4 h-4" />
                Choose File
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={handleFileSelect} />
              </label>
            )}
          </motion.div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900">AI Parsed Data</h3>
                <p className="text-xs text-stone-500">{file?.name} · confidence {parsed._confidence}%</p>
              </div>
            </div>
            <button onClick={clearFile} className="p-2 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-red-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Data grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { Icon: User,     label: 'Name',          val: parsed.name },
              { Icon: Mail,     label: 'Email',         val: parsed.email },
              { Icon: Phone,    label: 'Phone',         val: parsed.phone },
              { Icon: MapPin,   label: 'Location',      val: parsed.location },
              { Icon: Briefcase,label: 'Current Title', val: parsed.currentTitle },
              { Icon: Clock,    label: 'Experience',    val: parsed.experienceYears ? `${parsed.experienceYears} yrs` : '' },
            ].filter(r => r.val).map(({ Icon, label, val }) => (
              <div key={label} className="p-3 rounded-xl border border-stone-200 bg-white">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3.5 h-3.5 text-brand-500" />
                  <span className="text-xs font-semibold text-stone-500 uppercase">{label}</span>
                </div>
                <p className="font-semibold text-stone-900 text-sm truncate">{val}</p>
              </div>
            ))}
          </div>

          {/* Skills */}
          {parsed.skills.length > 0 && (
            <div className="p-4 rounded-xl border border-stone-200 bg-white">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="w-4 h-4 text-brand-500" />
                <span className="text-xs font-semibold text-stone-500 uppercase">Skills ({parsed.skills.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {parsed.skills.map((skill, i) => (
                  <span key={i} className="px-2.5 py-1 bg-gradient-to-r from-brand-100 to-teal-100 text-brand-700 rounded-lg text-xs font-semibold border border-brand-200/60">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {parsed.education.length > 0 && (
            <div className="p-4 rounded-xl border border-stone-200 bg-white">
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="w-4 h-4 text-brand-500" />
                <span className="text-xs font-semibold text-stone-500 uppercase">Education</span>
              </div>
              {parsed.education.map((e, i) => (
                <div key={i} className="mb-1 last:mb-0">
                  <p className="font-semibold text-stone-900 text-sm">{e.degree}</p>
                  <p className="text-xs text-stone-500">{e.institution}{e.year ? ` · ${e.year}` : ''}</p>
                </div>
              ))}
            </div>
          )}

          {/* Confidence */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
            parsed._confidence >= 70 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : parsed._confidence >= 40 ? 'text-amber-700 bg-amber-50 border-amber-200'
              : 'text-red-700 bg-red-50 border-red-200'
          }`}>
            <CheckCircle className="w-3.5 h-3.5" />
            {parsed._confidence >= 70 ? 'High confidence' : parsed._confidence >= 40 ? 'Review recommended' : 'Low quality — edit manually'} ({parsed._confidence}%)
          </div>
        </motion.div>
      )}
    </div>
  );
}
