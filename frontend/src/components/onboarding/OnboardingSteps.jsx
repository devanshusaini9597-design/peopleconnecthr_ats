import React from 'react';
import {
  Plus, Trash2, ChevronRight, Loader2, PartyPopper, AlertCircle, Check,
} from 'lucide-react';
import { STEPS, ROLES, EMP_TYPES } from './onboardingConstants';

export function OnboardingError({ error }) {
  if (!error) return null;
  return (
    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-200">
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
      <p className="text-sm">{error}</p>
    </div>
  );
}

export function OnboardingStep1({
  error, orgName, setOrgName, orgDomain, setOrgDomain, loading, handleCreateOrg,
}) {
  return (
    <form onSubmit={handleCreateOrg} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-3">Let's set up your workspace</h2>
        <p className="text-gray-400">Create your organization to start hiring.</p>
      </div>

      <OnboardingError error={error} />

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Company Name <span className="text-red-400">*</span></label>
          <input
            type="text"
            required
            minLength={2}
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-gray-500 transition-all"
            placeholder="e.g. Acme Corp"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Company Domain <span className="text-gray-500 font-normal">(optional)</span></label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-500">@</span>
            <input
              type="text"
              value={orgDomain}
              onChange={(e) => setOrgDomain(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-gray-500 transition-all"
              placeholder="company.com"
            />
          </div>
        </div>
      </div>

      <div className="mt-10">
        <button
          type="submit"
          disabled={loading || orgName.trim().length < 2}
          className="w-full flex items-center justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
        </button>
      </div>
    </form>
  );
}

export function OnboardingStep2({
  error, invites, loading, handleInviteTeam, addInviteRow, removeInviteRow, updateInvite,
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-3">Invite your team</h2>
        <p className="text-gray-400">Add your hiring team members. You can always add more later.</p>
      </div>

      <OnboardingError error={error} />

      <form onSubmit={(e) => handleInviteTeam(e, false)}>
        <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
          {invites.map((invite, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-1">
                <input
                  type="email"
                  value={invite.email}
                  onChange={(e) => updateInvite(index, 'email', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-gray-500"
                  placeholder="colleague@company.com"
                />
              </div>
              <div className="w-40">
                <select
                  value={invite.role}
                  onChange={(e) => updateInvite(index, 'role', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white [&>option]:bg-gray-900"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <button
                type="button"
                onClick={() => removeInviteRow(index)}
                disabled={invites.length === 1}
                className="p-3 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addInviteRow}
          className="mt-4 flex items-center text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          <Plus className="w-4 h-4 mr-1" /> Add another
        </button>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:flex-1 flex items-center justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Invites & Continue'}
          </button>

          <button
            type="button"
            onClick={() => handleInviteTeam(null, true)}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3.5 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
}

export function OnboardingStep3({
  error, jobForm, setJobForm, loading, handlePostJob,
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-3">Post your first job</h2>
        <p className="text-gray-400">Get started by creating a job opening. Don't worry, you can edit it later.</p>
      </div>

      <OnboardingError error={error} />

      <form onSubmit={(e) => handlePostJob(e, false)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Job Title <span className="text-red-400">*</span></label>
          <input
            type="text"
            required
            value={jobForm.title}
            onChange={(e) => setJobForm({...jobForm, title: e.target.value})}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-gray-500"
            placeholder="e.g. Senior Frontend Engineer"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Location <span className="text-red-400">*</span></label>
            <input
              type="text"
              required
              value={jobForm.location}
              onChange={(e) => setJobForm({...jobForm, location: e.target.value})}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-gray-500"
              placeholder="e.g. Remote, or New York"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Department <span className="text-gray-500 font-normal">(optional)</span></label>
            <input
              type="text"
              value={jobForm.department}
              onChange={(e) => setJobForm({...jobForm, department: e.target.value})}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-gray-500"
              placeholder="e.g. Engineering"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Employment Type</label>
          <select
            value={jobForm.employmentType}
            onChange={(e) => setJobForm({...jobForm, employmentType: e.target.value})}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white [&>option]:bg-gray-900"
          >
            {EMP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Description <span className="text-gray-500 font-normal">(optional)</span></label>
          <textarea
            rows="3"
            value={jobForm.description}
            onChange={(e) => setJobForm({...jobForm, description: e.target.value})}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-gray-500 resize-none"
            placeholder="Brief description of the role..."
          />
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <button
            type="submit"
            disabled={loading || !jobForm.title || !jobForm.location}
            className="w-full sm:flex-1 flex items-center justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Post Job & Continue'}
          </button>

          <button
            type="button"
            onClick={() => handlePostJob(null, true)}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3.5 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
}

export function OnboardingStep4({ error, summary, loading, handleComplete }) {
  return (
    <div className="text-center animate-in zoom-in-95 duration-700">
      <div className="relative w-24 h-24 mx-auto mb-6">
        <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping" />
        <div className="relative flex items-center justify-center w-full h-full bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-full shadow-[0_0_40px_rgba(79,70,229,0.4)]">
          <PartyPopper className="w-12 h-12 text-white" />
        </div>
      </div>

      <h2 className="text-4xl font-bold text-white mb-4">You're all set!</h2>
      <p className="text-xl text-gray-400 mb-10">Your workspace has been successfully created.</p>

      <OnboardingError error={error} />

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-10 text-left max-w-sm mx-auto backdrop-blur-xl">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Setup Summary</h3>
        <ul className="space-y-4">
          <li className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-gray-200">Workspace <strong>{summary.orgName}</strong></span>
          </li>
          {summary.invitesCount > 0 && (
            <li className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-gray-200">Invited <strong>{summary.invitesCount}</strong> team member{summary.invitesCount > 1 ? 's' : ''}</span>
            </li>
          )}
          {summary.jobPosted && (
            <li className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-gray-200">First job posted</span>
            </li>
          )}
        </ul>
      </div>

      <button
        onClick={handleComplete}
        disabled={loading}
        className="inline-flex items-center justify-center py-4 px-8 border border-transparent rounded-xl shadow-lg text-lg font-medium text-white bg-white/10 hover:bg-white/20 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/20 disabled:opacity-50 transition-all duration-300"
      >
        {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : null}
        Go to Dashboard <ChevronRight className="w-5 h-5 ml-2" />
      </button>
    </div>
  );
}

export function OnboardingStepper({ currentStep }) {
  return (
    <div className="max-w-3xl mx-auto w-full mb-12">
      <div className="relative flex justify-between items-center">
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-0.5 bg-white/5 rounded-full" />

        <div
          className="absolute left-0 top-1/2 transform -translate-y-1/2 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-in-out"
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
        />

        {STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;

          return (
            <div key={step.id} className="relative flex flex-col items-center group">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ease-in-out z-10 shadow-lg
                  ${isActive ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white scale-110 shadow-indigo-500/25 border-none' :
                    isCompleted ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 backdrop-blur-md' :
                    'bg-[#121214] text-gray-600 border border-white/5 backdrop-blur-md'
                  }
                `}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={`absolute -bottom-8 text-xs font-medium whitespace-nowrap transition-colors duration-300
                ${isActive ? 'text-indigo-400' : isCompleted ? 'text-gray-400' : 'text-gray-600'}
              `}>
                {step.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
