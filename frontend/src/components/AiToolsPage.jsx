import React, { useState } from 'react';
import {
  Sparkles, FileText, MessageSquare, Search, Mail, AlertTriangle,
  Loader2, Copy, Check, Lock
} from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import FeatureGate from './FeatureGate';

const TABS = [
  { id: 'jd', label: 'JD Generator', icon: FileText, feature: 'ai.jdGenerator' },
  { id: 'interview', label: 'Interview Qs', icon: MessageSquare, feature: 'ai.interviewQuestions' },
  { id: 'boolean', label: 'Boolean Search', icon: Search, feature: 'ai.booleanGenerator' },
  { id: 'email', label: 'Email Draft', icon: Mail, feature: 'ai.emailDrafting' },
  { id: 'bias', label: 'Bias Check', icon: AlertTriangle, feature: 'ai.biasFlagging' },
  { id: 'semantic', label: 'Semantic Search', icon: Sparkles, feature: 'ai.semanticSearch' },
];

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  if (!text) return null;
  return (
    <button type="button" onClick={handleCopy} className="btn-secondary text-xs py-1.5 px-2.5 flex-shrink-0">
      {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
    </button>
  );
};

const ResultPanel = ({ label, children, copyText }) => (
  <div className="mt-4 card-ats-bordered p-4 sm:p-5 relative overflow-hidden">
    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
    <div className="flex justify-between items-start gap-3 mb-3">
      {label && <p className="text-xs font-bold text-stone-500 uppercase tracking-wide">{label}</p>}
      {copyText && <CopyButton text={copyText} />}
    </div>
    {children}
  </div>
);

const AiToolsPage = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('jd');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // JD Generator
  const [jdTitle, setJdTitle] = useState('');
  const [jdBullets, setJdBullets] = useState('');

  // Interview questions
  const [iqJd, setIqJd] = useState('');
  const [iqProfile, setIqProfile] = useState('');

  // Boolean
  const [boolKeywords, setBoolKeywords] = useState('');

  // Email draft
  const [emailType, setEmailType] = useState('rejection');
  const [emailContext, setEmailContext] = useState('');

  // Bias
  const [biasText, setBiasText] = useState('');
  const [biasType, setBiasType] = useState('jd');

  // Semantic search
  const [semQuery, setSemQuery] = useState('');
  const [semPoolId, setSemPoolId] = useState('');

  const run = async (url, body) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await authenticatedFetch(`/api/ai/${url}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        throw new Error(data.message || 'Request failed');
      }
      setResult(data.data);
      toast.success('Done');
    } catch (err) {
      toast.error(err.message || 'AI request failed');
    } finally {
      setLoading(false);
    }
  };

  const tab = TABS.find((t) => t.id === activeTab);

  return (
    <div className="page-shell-ats animate-page-enter pb-32 sm:pb-28">
      <PageHeader
        icon={Sparkles}
        title="AI Tools"
        subtitle="LLM-powered recruiting assistants. Resume parsing elsewhere uses regex/OCR only."
        gradientTitle
      />

      <p className="text-xs text-stone-500 -mt-2 leading-relaxed">
        Scoring and generation features use your configured LLM provider. Resume text extraction is regex/OCR-based, not AI.
      </p>

      <div className="flex overflow-x-auto scrollbar-hide gap-2 pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <FeatureGate key={t.id} feature={t.feature}>
            <button
              type="button"
              onClick={() => { setActiveTab(t.id); setResult(null); }}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold border transition-colors whitespace-nowrap flex-shrink-0 touch-target ${
                activeTab === t.id
                  ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300 hover:bg-brand-50/30'
              }`}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          </FeatureGate>
        ))}
      </div>

      {tab && (
        <FeatureGate
          feature={tab.feature}
          fallback={
            <div className="card-ats-bordered p-8 sm:p-10 text-center relative overflow-hidden animate-slide-up">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />
              <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4 ring-4 ring-amber-100/60">
                <Lock className="w-7 h-7 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-stone-900 tracking-tight">Upgrade to use {tab.label}</h2>
              <p className="text-stone-500 mt-2 text-sm leading-relaxed max-w-sm mx-auto">
                This AI feature is not included in your current plan. Upgrade to unlock recruiting assistants.
              </p>
              <a href="/billing" className="btn-primary inline-flex mt-6 w-full sm:w-auto">View Plans</a>
            </div>
          }
        >
          <div className="card-ats-bordered p-5 sm:p-6 space-y-4 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />

            {activeTab === 'jd' && (
              <>
                <div>
                  <label className="label-ats">Job title (optional)</label>
                  <input className="input-ats" value={jdTitle} onChange={(e) => setJdTitle(e.target.value)} placeholder="Senior Software Engineer" />
                </div>
                <div>
                  <label className="label-ats">Bullet points</label>
                  <textarea className="textarea-ats min-h-[140px]" value={jdBullets} onChange={(e) => setJdBullets(e.target.value)} placeholder="One bullet per line…" />
                </div>
                <button type="button" disabled={loading || !jdBullets.trim()} className="btn-primary w-full sm:w-auto" onClick={() => run('jd-generate', { title: jdTitle, bullets: jdBullets })}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : 'Generate JD'}
                </button>
                {result?.jobDescription && (
                  <ResultPanel label="Generated JD" copyText={result.jobDescription}>
                    <pre className="text-sm text-stone-800 whitespace-pre-wrap font-sans leading-relaxed">{result.jobDescription}</pre>
                  </ResultPanel>
                )}
              </>
            )}

            {activeTab === 'interview' && (
              <>
                <div>
                  <label className="label-ats">Job description</label>
                  <textarea className="textarea-ats min-h-[100px]" value={iqJd} onChange={(e) => setIqJd(e.target.value)} />
                </div>
                <div>
                  <label className="label-ats">Candidate profile / resume summary</label>
                  <textarea className="textarea-ats min-h-[100px]" value={iqProfile} onChange={(e) => setIqProfile(e.target.value)} />
                </div>
                <button type="button" disabled={loading || !iqJd.trim() || !iqProfile.trim()} className="btn-primary w-full sm:w-auto" onClick={() => run('interview-questions', { jobDescription: iqJd, candidateProfile: iqProfile })}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : 'Generate Questions'}
                </button>
                {result?.questions?.length > 0 && (
                  <ResultPanel label="Interview questions">
                    <ol className="space-y-3 list-decimal list-inside text-sm text-stone-800">
                      {result.questions.map((q, i) => (
                        <li key={i} className="pl-1 leading-relaxed">
                          <span className="font-semibold">{q.question}</span>
                          {q.category && <span className="ml-2 badge-brand">{q.category}</span>}
                        </li>
                      ))}
                    </ol>
                  </ResultPanel>
                )}
              </>
            )}

            {activeTab === 'boolean' && (
              <>
                <div>
                  <label className="label-ats">Keywords (comma-separated)</label>
                  <input className="input-ats" value={boolKeywords} onChange={(e) => setBoolKeywords(e.target.value)} placeholder="react, typescript, remote" />
                </div>
                <button type="button" disabled={loading || !boolKeywords.trim()} className="btn-primary w-full sm:w-auto" onClick={() => run('boolean-generate', { keywords: boolKeywords.split(',').map((k) => k.trim()) })}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : 'Generate Boolean'}
                </button>
                {result?.booleanString && (
                  <ResultPanel copyText={result.booleanString}>
                    <code className="text-sm text-stone-800 break-all leading-relaxed">{result.booleanString}</code>
                    {result.tips && <p className="text-xs text-stone-500 mt-3 pt-3 border-t border-stone-100">{result.tips}</p>}
                  </ResultPanel>
                )}
              </>
            )}

            {activeTab === 'email' && (
              <>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={emailType === 'rejection'} onChange={() => setEmailType('rejection')} className="accent-brand-600" /> Rejection
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={emailType === 'offer'} onChange={() => setEmailType('offer')} className="accent-brand-600" /> Offer
                  </label>
                </div>
                <div>
                  <label className="label-ats">Context (candidate name, role, notes…)</label>
                  <textarea className="textarea-ats min-h-[100px]" value={emailContext} onChange={(e) => setEmailContext(e.target.value)} placeholder='{"candidateName":"Alex","role":"Engineer"}' />
                </div>
                <button
                  type="button"
                  disabled={loading}
                  className="btn-primary w-full sm:w-auto"
                  onClick={() => {
                    let context = {};
                    try { context = emailContext ? JSON.parse(emailContext) : {}; } catch { context = { notes: emailContext }; }
                    run('email-draft', { type: emailType, context });
                  }}
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Drafting…</> : 'Draft Email'}
                </button>
                {result?.subject && (
                  <ResultPanel copyText={`Subject: ${result.subject}\n\n${result.body}`}>
                    <p className="font-semibold text-stone-800 mb-2">Subject: {result.subject}</p>
                    <pre className="text-sm whitespace-pre-wrap font-sans text-stone-700 leading-relaxed">{result.body}</pre>
                  </ResultPanel>
                )}
              </>
            )}

            {activeTab === 'bias' && (
              <>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={biasType === 'jd'} onChange={() => setBiasType('jd')} className="accent-brand-600" /> Job description
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={biasType === 'scorecard'} onChange={() => setBiasType('scorecard')} className="accent-brand-600" /> Scorecard
                  </label>
                </div>
                <div>
                  <label className="label-ats">Text to review</label>
                  <textarea className="textarea-ats min-h-[140px]" value={biasText} onChange={(e) => setBiasText(e.target.value)} />
                </div>
                <button type="button" disabled={loading || !biasText.trim()} className="btn-primary w-full sm:w-auto" onClick={() => run('bias-flag', { text: biasText, type: biasType })}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Checking…</> : 'Check for Bias'}
                </button>
                {result && (
                  <div className="mt-4 space-y-3">
                    {result.overallRisk && (
                      <span className={`inline-block text-xs font-bold uppercase px-2.5 py-1 rounded-lg ${
                        result.overallRisk === 'high' ? 'badge-danger' : result.overallRisk === 'medium' ? 'badge-warning' : 'badge-success'
                      }`}>
                        Risk: {result.overallRisk}
                      </span>
                    )}
                    {result.summary && <p className="text-sm text-stone-700 leading-relaxed">{result.summary}</p>}
                    {result.flags?.map((f, i) => (
                      <div key={i} className="p-3.5 rounded-xl bg-amber-50 border border-amber-100 text-sm">
                        <p className="font-semibold text-amber-900">&ldquo;{f.phrase}&rdquo;</p>
                        <p className="text-amber-800 mt-1">{f.issue}</p>
                        {f.suggestion && <p className="text-stone-600 mt-1">→ {f.suggestion}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'semantic' && (
              <>
                <div>
                  <label className="label-ats">Natural language query</label>
                  <input className="input-ats" value={semQuery} onChange={(e) => setSemQuery(e.target.value)} placeholder="Senior React developer with fintech experience" />
                </div>
                <div>
                  <label className="label-ats">Talent pool ID (optional)</label>
                  <input className="input-ats" value={semPoolId} onChange={(e) => setSemPoolId(e.target.value)} placeholder="Leave empty to search all embedded candidates" />
                </div>
                <p className="text-xs text-stone-500">Candidates must have embeddings (use embed from candidate detail or bulk embed later).</p>
                <button
                  type="button"
                  disabled={loading || !semQuery.trim()}
                  className="btn-primary w-full sm:w-auto"
                  onClick={() => run('semantic-search', { query: semQuery, ...(semPoolId ? { talentPoolId: semPoolId } : {}) })}
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Searching…</> : 'Search'}
                </button>
                {result?.results?.length > 0 && (
                  <ResultPanel label="Search results">
                    <div className="overflow-x-auto -mx-1 px-1">
                      <table className="w-full text-sm min-w-[320px]">
                        <thead>
                          <tr className="text-left text-stone-500 border-b border-stone-200">
                            <th className="py-2 pr-4 font-semibold">Name</th>
                            <th className="py-2 pr-4 font-semibold">Position</th>
                            <th className="py-2 font-semibold">Match</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.results.map((r) => (
                            <tr key={r.candidateId} className="border-b border-stone-100 last:border-0">
                              <td className="py-2.5 pr-4 font-semibold text-stone-900">{r.name}</td>
                              <td className="py-2.5 pr-4 text-stone-600">{r.position || '—'}</td>
                              <td className="py-2.5">
                                <span className="badge-brand">{(r.similarity * 100).toFixed(1)}%</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ResultPanel>
                )}
                {result?.results?.length === 0 && (
                  <p className="text-sm text-stone-500 mt-4">No embedded candidates matched. Embed candidates first.</p>
                )}
              </>
            )}
          </div>
        </FeatureGate>
      )}
    </div>
  );
};

export default AiToolsPage;
