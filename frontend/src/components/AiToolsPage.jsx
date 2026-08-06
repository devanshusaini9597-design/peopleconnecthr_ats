import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Lock, Plug } from 'lucide-react';
import { authenticatedFetch, readApiJson } from '../utils/fetchUtils';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import FeatureGate from './FeatureGate';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import {
  AI_TOUR_KEY,
  AI_TOUR_STEPS,
  TABS,
  AI_NOT_CONFIGURED_MSG,
} from './aiTools/aiToolsConstants';
import AiToolTabs from './aiTools/AiToolTabs';
import AiToolWorkspace from './aiTools/AiToolWorkspace';

const AiToolsPage = () => {
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(AI_TOUR_KEY);
  const [activeTab, setActiveTab] = useState('resume');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Resume generator
  const [resName, setResName] = useState('');
  const [resTitle, setResTitle] = useState('');
  const [resTarget, setResTarget] = useState('');
  const [resExperience, setResExperience] = useState('');
  const [resSkills, setResSkills] = useState('');
  const [resBullets, setResBullets] = useState('');

  // Resume summary / skills
  const [resumeText, setResumeText] = useState('');

  // Match
  const [matchJd, setMatchJd] = useState('');
  const [matchProfile, setMatchProfile] = useState('');

  // JD
  const [jdTitle, setJdTitle] = useState('');
  const [jdBullets, setJdBullets] = useState('');
  const [jdImproveText, setJdImproveText] = useState('');

  // Interview
  const [iqJd, setIqJd] = useState('');
  const [iqProfile, setIqProfile] = useState('');

  // Boolean
  const [boolKeywords, setBoolKeywords] = useState('');

  // Email
  const [emailType, setEmailType] = useState('interview');
  const [emailName, setEmailName] = useState('');
  const [emailRole, setEmailRole] = useState('');
  const [emailNotes, setEmailNotes] = useState('');

  // Bias
  const [biasText, setBiasText] = useState('');
  const [biasType, setBiasType] = useState('jd');

  // Semantic
  const [semQuery, setSemQuery] = useState('');
  const [semPoolId, setSemPoolId] = useState('');

  // Scorecard
  const [scTranscript, setScTranscript] = useState('');
  const [scJd, setScJd] = useState('');

  const run = async (url, body) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await authenticatedFetch(`/api/ai/${url}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      let data = {};
      try {
        data = await readApiJson(res);
      } catch {
        toast.error(AI_NOT_CONFIGURED_MSG);
        return;
      }

      if (!res.ok) {
        const notConfigured =
          data.code === 'AI_NOT_CONFIGURED'
          || res.status === 503
          || res.status === 404
          || String(data.message || '').toLowerCase().includes('not configured');
        toast.error(notConfigured ? AI_NOT_CONFIGURED_MSG : (data.message || 'Request failed'));
        return;
      }

      setResult(data.data);
      toast.success('Done');
    } catch (err) {
      const msg = err.message || 'AI request failed';
      toast.error(
        msg.toLowerCase().includes('configur') || msg.toLowerCase().includes('not found')
          ? AI_NOT_CONFIGURED_MSG
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  const tab = TABS.find((t) => t.id === activeTab);

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Sparkles}
        title="AI Tools"
        subtitle="Recruiting assistants — resume, JD, match, email, and more. Requires an AI provider under Integrations."
        gradientTitle
      >
        <Link to="/organization/integrations" className="btn-secondary flex-1 sm:flex-none">
          <Plug size={16} /> Integrations
        </Link>
      </PageHeader>

      <div data-tour="ai-tip" className="rounded-xl border border-brand-200/60 bg-gradient-to-r from-brand-50/70 via-white to-teal-50/40 px-4 py-2.5 text-[13px] text-stone-600 leading-relaxed">
        Connect OpenAI, Gemini, or another provider under Organization → Integrations before running tools.
        Press <span className="font-semibold text-stone-800">?</span> for a tour.
      </div>

      <AiToolTabs
        activeTab={activeTab}
        onSelect={(id) => { setActiveTab(id); setResult(null); }}
      />

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
                This AI feature is not included in your current plan.
              </p>
              <a href="/billing" className="btn-primary inline-flex mt-6 w-full sm:w-auto">View Plans</a>
            </div>
          }
        >
          <AiToolWorkspace
            tab={tab}
            activeTab={activeTab}
            loading={loading}
            result={result}
            run={run}
            resName={resName} setResName={setResName}
            resTitle={resTitle} setResTitle={setResTitle}
            resTarget={resTarget} setResTarget={setResTarget}
            resExperience={resExperience} setResExperience={setResExperience}
            resSkills={resSkills} setResSkills={setResSkills}
            resBullets={resBullets} setResBullets={setResBullets}
            resumeText={resumeText} setResumeText={setResumeText}
            matchJd={matchJd} setMatchJd={setMatchJd}
            matchProfile={matchProfile} setMatchProfile={setMatchProfile}
            jdTitle={jdTitle} setJdTitle={setJdTitle}
            jdBullets={jdBullets} setJdBullets={setJdBullets}
            jdImproveText={jdImproveText} setJdImproveText={setJdImproveText}
            iqJd={iqJd} setIqJd={setIqJd}
            iqProfile={iqProfile} setIqProfile={setIqProfile}
            boolKeywords={boolKeywords} setBoolKeywords={setBoolKeywords}
            emailType={emailType} setEmailType={setEmailType}
            emailName={emailName} setEmailName={setEmailName}
            emailRole={emailRole} setEmailRole={setEmailRole}
            emailNotes={emailNotes} setEmailNotes={setEmailNotes}
            biasText={biasText} setBiasText={setBiasText}
            biasType={biasType} setBiasType={setBiasType}
            semQuery={semQuery} setSemQuery={setSemQuery}
            semPoolId={semPoolId} setSemPoolId={setSemPoolId}
            scTranscript={scTranscript} setScTranscript={setScTranscript}
            scJd={scJd} setScJd={setScJd}
          />
        </FeatureGate>
      )}

      <TourHelpFab onClick={() => setTourOpen(true)} label="Take a tour" title="Take a tour of AI Tools" />
      <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} steps={AI_TOUR_STEPS} storageKey={AI_TOUR_KEY} />
    </div>
  );
};

export default AiToolsPage;
