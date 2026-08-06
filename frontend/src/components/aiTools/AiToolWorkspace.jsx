import React from 'react';
import {
  Loader2, Briefcase, Search, Mail, Layers, FileUser,
} from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import PremiumSelect from '../ui/PremiumSelect';
import { ResultPanel } from './ResultPanel';
import { EMAIL_TYPE_OPTIONS, BIAS_TYPE_OPTIONS } from './aiToolsConstants';

export default function AiToolWorkspace({
  tab,
  activeTab,
  loading,
  result,
  run,
  resName, setResName,
  resTitle, setResTitle,
  resTarget, setResTarget,
  resExperience, setResExperience,
  resSkills, setResSkills,
  resBullets, setResBullets,
  resumeText, setResumeText,
  matchJd, setMatchJd,
  matchProfile, setMatchProfile,
  jdTitle, setJdTitle,
  jdBullets, setJdBullets,
  jdImproveText, setJdImproveText,
  iqJd, setIqJd,
  iqProfile, setIqProfile,
  boolKeywords, setBoolKeywords,
  emailType, setEmailType,
  emailName, setEmailName,
  emailRole, setEmailRole,
  emailNotes, setEmailNotes,
  biasText, setBiasText,
  biasType, setBiasType,
  semQuery, setSemQuery,
  semPoolId, setSemPoolId,
  scTranscript, setScTranscript,
  scJd, setScJd,
}) {
  return (
    <div data-tour="ai-workspace" className="card-ats-bordered p-5 sm:p-6 space-y-4 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="flex items-start gap-3 pb-1">
        <span className="h-9 w-9 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 inline-flex items-center justify-center flex-shrink-0">
          <tab.icon size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-stone-900 tracking-tight">{tab.label}</h2>
          <p className="text-xs text-stone-500">{tab.blurb}</p>
        </div>
      </div>

      {activeTab === 'resume' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-ats">Full name</label>
              <input className="input-ats field-premium" value={resName} onChange={(e) => setResName(e.target.value)} placeholder="Priya Sharma" />
            </div>
            <div>
              <label className="label-ats">Current title</label>
              <input className="input-ats field-premium" value={resTitle} onChange={(e) => setResTitle(e.target.value)} placeholder="Senior Frontend Engineer" />
            </div>
            <div>
              <label className="label-ats">Target role</label>
              <input className="input-ats field-premium" value={resTarget} onChange={(e) => setResTarget(e.target.value)} placeholder="Lead React Developer" />
            </div>
            <div>
              <label className="label-ats">Skills (comma separated)</label>
              <input className="input-ats field-premium" value={resSkills} onChange={(e) => setResSkills(e.target.value)} placeholder="React, TypeScript, Node.js" />
            </div>
            <div className="sm:col-span-2">
              <label className="label-ats">Experience notes</label>
              <textarea className="textarea-ats field-premium min-h-[80px]" value={resExperience} onChange={(e) => setResExperience(e.target.value)} placeholder="5 years at fintech startups; led UI redesign…" />
            </div>
            <div className="sm:col-span-2">
              <label className="label-ats">Achievement bullets (one per line)</label>
              <textarea className="textarea-ats field-premium min-h-[120px]" value={resBullets} onChange={(e) => setResBullets(e.target.value)} placeholder="Cut page load by 40%&#10;Mentored 3 junior engineers" />
            </div>
          </div>
          <button
            type="button"
            disabled={loading || (!resBullets.trim() && !resExperience.trim() && !resSkills.trim())}
            className="btn-primary w-full sm:w-auto"
            onClick={() => run('resume-generate', {
              name: resName,
              title: resTitle,
              targetRole: resTarget,
              experience: resExperience,
              skills: resSkills,
              bullets: resBullets,
            })}
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : <><FileUser size={16} /> Generate Resume</>}
          </button>
          {result?.resume && (
            <ResultPanel label="Generated resume" copyText={result.resume}>
              <pre className="text-sm text-stone-800 whitespace-pre-wrap font-sans leading-relaxed">{result.resume}</pre>
            </ResultPanel>
          )}
        </>
      )}

      {activeTab === 'summary' && (
        <>
          <div>
            <label className="label-ats">Target role (optional)</label>
            <input className="input-ats field-premium" value={resTarget} onChange={(e) => setResTarget(e.target.value)} placeholder="Product Designer" />
          </div>
          <div>
            <label className="label-ats">Resume / profile text</label>
            <textarea className="textarea-ats field-premium min-h-[160px]" value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste resume text…" />
          </div>
          <button type="button" disabled={loading || !resumeText.trim()} className="btn-primary w-full sm:w-auto" onClick={() => run('resume-summary', { resumeText, targetRole: resTarget })}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Summarizing…</> : 'Generate Summary'}
          </button>
          {result?.summary && (
            <ResultPanel label="Recruiter summary" copyText={[result.headline, result.summary, ...(result.talkingPoints || [])].filter(Boolean).join('\n\n')}>
              {result.headline && <p className="font-bold text-stone-900 mb-2">{result.headline}</p>}
              <p className="text-sm text-stone-700 leading-relaxed">{result.summary}</p>
              {result.talkingPoints?.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm text-stone-600 list-disc list-inside">
                  {result.talkingPoints.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              )}
            </ResultPanel>
          )}
        </>
      )}

      {activeTab === 'skills' && (
        <>
          <div>
            <label className="label-ats">Resume text</label>
            <textarea className="textarea-ats field-premium min-h-[160px]" value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste resume text…" />
          </div>
          <button type="button" disabled={loading || !resumeText.trim()} className="btn-primary w-full sm:w-auto" onClick={() => run('skills-extract', { resumeText })}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Extracting…</> : 'Extract Skills'}
          </button>
          {result?.skills && (
            <ResultPanel
              label="Extracted skills"
              copyText={(result.skills || []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean).join(', ')}
            >
              <div className="flex flex-wrap gap-1.5">
                {(result.skills || []).map((s, i) => {
                  const name = typeof s === 'string' ? s : s.name;
                  const level = typeof s === 'object' ? s.level : null;
                  return (
                    <span key={`${name}-${i}`} className="badge-brand whitespace-nowrap">
                      {name}{level && level !== 'mentioned' ? ` · ${level}` : ''}
                    </span>
                  );
                })}
              </div>
              {!result.skills?.length && <p className="text-sm text-stone-500">No skills detected.</p>}
            </ResultPanel>
          )}
        </>
      )}

      {activeTab === 'match' && (
        <>
          <div>
            <label className="label-ats">Job description</label>
            <textarea className="textarea-ats field-premium min-h-[120px]" value={matchJd} onChange={(e) => setMatchJd(e.target.value)} />
          </div>
          <div>
            <label className="label-ats">Candidate profile / resume</label>
            <textarea className="textarea-ats field-premium min-h-[120px]" value={matchProfile} onChange={(e) => setMatchProfile(e.target.value)} />
          </div>
          <button type="button" disabled={loading || !matchJd.trim() || !matchProfile.trim()} className="btn-primary w-full sm:w-auto" onClick={() => run('match', { jobDescription: matchJd, candidateProfile: matchProfile })}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Scoring…</> : 'Score Match'}
          </button>
          {result?.matchPercent != null && (
            <ResultPanel label="Match result" copyText={`${result.matchPercent}% — ${result.rationale || ''}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl font-bold text-brand-700 tabular-nums">{result.matchPercent}%</span>
                <span className="text-xs font-semibold text-stone-500 uppercase">fit score</span>
              </div>
              {result.rationale && <p className="text-sm text-stone-700 leading-relaxed">{result.rationale}</p>}
            </ResultPanel>
          )}
        </>
      )}

      {activeTab === 'jd' && (
        <>
          <div>
            <label className="label-ats">Job title (optional)</label>
            <div className="relative">
              <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none z-[1]" />
              <input className="input-ats input-ats-icon" value={jdTitle} onChange={(e) => setJdTitle(e.target.value)} placeholder="Senior Software Engineer" />
            </div>
          </div>
          <div>
            <label className="label-ats">Bullet points</label>
            <textarea className="textarea-ats field-premium min-h-[140px]" value={jdBullets} onChange={(e) => setJdBullets(e.target.value)} placeholder="One bullet per line…" />
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

      {activeTab === 'jdImprove' && (
        <>
          <div>
            <label className="label-ats">Job description to improve</label>
            <textarea className="textarea-ats field-premium min-h-[160px]" value={jdImproveText} onChange={(e) => setJdImproveText(e.target.value)} />
          </div>
          <button type="button" disabled={loading || !jdImproveText.trim()} className="btn-primary w-full sm:w-auto" onClick={() => run('jd-improve', { jobDescription: jdImproveText })}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Improving…</> : 'Improve JD'}
          </button>
          {result?.jobDescription && (
            <ResultPanel label="Improved JD" copyText={result.jobDescription}>
              <pre className="text-sm text-stone-800 whitespace-pre-wrap font-sans leading-relaxed">{result.jobDescription}</pre>
              {result.changes?.length > 0 && (
                <ul className="mt-3 pt-3 border-t border-stone-100 space-y-1 text-xs text-stone-500 list-disc list-inside">
                  {result.changes.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              )}
            </ResultPanel>
          )}
        </>
      )}

      {activeTab === 'interview' && (
        <>
          <div>
            <label className="label-ats">Job description</label>
            <textarea className="textarea-ats field-premium min-h-[100px]" value={iqJd} onChange={(e) => setIqJd(e.target.value)} />
          </div>
          <div>
            <label className="label-ats">Candidate profile / resume summary</label>
            <textarea className="textarea-ats field-premium min-h-[100px]" value={iqProfile} onChange={(e) => setIqProfile(e.target.value)} />
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
                    {q.category && <span className="ml-2 badge-brand whitespace-nowrap">{q.category}</span>}
                    {q.rationale && <p className="text-xs text-stone-500 mt-1 ml-5">{q.rationale}</p>}
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
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none z-[1]" />
              <input className="input-ats input-ats-icon" value={boolKeywords} onChange={(e) => setBoolKeywords(e.target.value)} placeholder="react, typescript, remote" />
            </div>
          </div>
          <button type="button" disabled={loading || !boolKeywords.trim()} className="btn-primary w-full sm:w-auto" onClick={() => run('boolean-generate', { keywords: boolKeywords.split(',').map((k) => k.trim()).filter(Boolean) })}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-ats">Email type</label>
              <PremiumSelect variant="list" value={emailType} onChange={setEmailType} options={EMAIL_TYPE_OPTIONS} icon={Mail} />
            </div>
            <div>
              <label className="label-ats">Candidate name</label>
              <input className="input-ats field-premium" value={emailName} onChange={(e) => setEmailName(e.target.value)} placeholder="Alex Rivera" />
            </div>
            <div>
              <label className="label-ats">Role</label>
              <input className="input-ats field-premium" value={emailRole} onChange={(e) => setEmailRole(e.target.value)} placeholder="Product Engineer" />
            </div>
            <div className="sm:col-span-2">
              <label className="label-ats">Notes (optional)</label>
              <textarea className="textarea-ats field-premium min-h-[80px]" value={emailNotes} onChange={(e) => setEmailNotes(e.target.value)} placeholder="Interview next Tuesday; strong React background…" />
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            className="btn-primary w-full sm:w-auto"
            onClick={() => run('email-draft', {
              type: emailType,
              context: {
                candidateName: emailName || 'Candidate',
                role: emailRole || 'the role',
                notes: emailNotes,
              },
            })}
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
          <div>
            <label className="label-ats">Content type</label>
            <PremiumSelect variant="list" value={biasType} onChange={setBiasType} options={BIAS_TYPE_OPTIONS} />
          </div>
          <div>
            <label className="label-ats">Text to review</label>
            <textarea className="textarea-ats field-premium min-h-[140px]" value={biasText} onChange={(e) => setBiasText(e.target.value)} />
          </div>
          <button type="button" disabled={loading || !biasText.trim()} className="btn-primary w-full sm:w-auto" onClick={() => run('bias-flag', { text: biasText, type: biasType })}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Checking…</> : 'Check for Bias'}
          </button>
          {result && (
            <ResultPanel label="Bias check results">
              <div className="space-y-3">
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
            </ResultPanel>
          )}
        </>
      )}

      {activeTab === 'semantic' && (
        <>
          <div>
            <label className="label-ats">Natural language query</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none z-[1]" />
              <input className="input-ats input-ats-icon" value={semQuery} onChange={(e) => setSemQuery(e.target.value)} placeholder="Senior React developer with fintech experience" />
            </div>
          </div>
          <div>
            <label className="label-ats">Talent pool ID (optional)</label>
            <div className="relative">
              <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none z-[1]" />
              <input className="input-ats input-ats-icon" value={semPoolId} onChange={(e) => setSemPoolId(e.target.value)} placeholder="Leave empty to search all embedded candidates" />
            </div>
          </div>
          <p className="text-xs text-stone-500">Candidates need embeddings for semantic search. Requires a connected embedding-capable AI provider.</p>
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
              <div className="space-y-2">
                {result.results.map((r) => (
                  <div key={r.candidateId} className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-900 truncate">{r.name}</p>
                      <p className="text-sm text-stone-600 truncate">{r.position || '—'}</p>
                    </div>
                    <span className="badge-brand whitespace-nowrap flex-shrink-0">{(r.similarity * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </ResultPanel>
          )}
          {result?.results?.length === 0 && (
            <EmptyState icon={Search} message="No matches found" subMessage="Embed candidates first, then retry." tone="brand" compact />
          )}
        </>
      )}

      {activeTab === 'scorecard' && (
        <>
          <div>
            <label className="label-ats">Job description</label>
            <textarea className="textarea-ats field-premium min-h-[100px]" value={scJd} onChange={(e) => setScJd(e.target.value)} />
          </div>
          <div>
            <label className="label-ats">Interview transcript</label>
            <textarea className="textarea-ats field-premium min-h-[160px]" value={scTranscript} onChange={(e) => setScTranscript(e.target.value)} placeholder="Paste interview notes or transcript…" />
          </div>
          <button type="button" disabled={loading || !scJd.trim() || !scTranscript.trim()} className="btn-primary w-full sm:w-auto" onClick={() => run('transcribe-scorecard', { jobDescription: scJd, transcript: scTranscript })}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Drafting…</> : 'Draft Scorecard'}
          </button>
          {result?.summary && (
            <ResultPanel label="Scorecard" copyText={JSON.stringify(result, null, 2)}>
              {result.overallRecommendation && (
                <span className="badge-brand mb-2 inline-block whitespace-nowrap">{result.overallRecommendation}</span>
              )}
              <p className="text-sm text-stone-700 leading-relaxed mb-3">{result.summary}</p>
              {result.scores?.length > 0 && (
                <div className="space-y-2 mb-3">
                  {result.scores.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-sm border border-stone-100 rounded-lg px-3 py-2">
                      <span className="font-medium text-stone-800">{s.competency}</span>
                      <span className="tabular-nums text-brand-700 font-bold">{s.rating}/5</span>
                    </div>
                  ))}
                </div>
              )}
              {result.strengths?.length > 0 && (
                <p className="text-xs text-stone-500"><span className="font-semibold text-emerald-700">Strengths:</span> {result.strengths.join('; ')}</p>
              )}
              {result.concerns?.length > 0 && (
                <p className="text-xs text-stone-500 mt-1"><span className="font-semibold text-amber-700">Concerns:</span> {result.concerns.join('; ')}</p>
              )}
            </ResultPanel>
          )}
        </>
      )}
    </div>
  );
}
