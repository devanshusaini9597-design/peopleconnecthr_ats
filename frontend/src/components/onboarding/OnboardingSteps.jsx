import React from 'react';
import {
  Plus, Trash2, ChevronRight, Loader2, PartyPopper, AlertCircle, Check,
} from 'lucide-react';
import { STEPS, ROLES, EMP_TYPES } from './onboardingConstants';

export function OnboardingError({ error }) {
  if (!error) return null;
  return (
    <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3 text-red-700">
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
      <p className="text-sm">{error}</p>
    </div>
  );
}

export function OnboardingStep1({
  error, orgName, setOrgName, orgDomain, setOrgDomain, loading, handleCreateOrg, handleSkip,
}) {
  return (
    <form onSubmit={handleCreateOrg} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-2 tracking-tight">Let&apos;s set up your workspace</h2>
        <p className="text-stone-500 text-sm sm:text-base">Create your organization to start hiring.</p>
      </div>

      <OnboardingError error={error} />

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            minLength={2}
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="input-ats !bg-stone-50/80 focus:!bg-white"
            placeholder="e.g. Acme Corp"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Company Domain <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-stone-400 text-sm">@</span>
            <input
              type="text"
              value={orgDomain}
              onChange={(e) => setOrgDomain(e.target.value)}
              className="input-ats input-ats-icon !bg-stone-50/80 focus:!bg-white"
              placeholder="company.com"
            />
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-col sm:flex-row items-center gap-3">
        <button
          type="submit"
          disabled={loading || orgName.trim().length < 2}
          className="btn-primary w-full sm:flex-1 !py-3.5"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={loading}
          className="w-full sm:w-auto px-5 py-3.5 text-sm font-medium text-stone-500 hover:text-stone-800 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}

export function OnboardingStep2({
  error, invites, loading, handleInviteTeam, addInviteRow, removeInviteRow, updateInvite, handleSkipAll,
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-2 tracking-tight">Invite your team</h2>
        <p className="text-stone-500 text-sm sm:text-base">Add hiring team members. You can always invite more later.</p>
      </div>

      <OnboardingError error={error} />

      <form onSubmit={(e) => handleInviteTeam(e, false)}>
        <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
          {invites.map((invite, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <input
                  type="email"
                  value={invite.email}
                  onChange={(e) => updateInvite(index, 'email', e.target.value)}
                  className="input-ats !bg-stone-50/80 focus:!bg-white"
                  placeholder="colleague@company.com"
                />
              </div>
              <div className="w-36 shrink-0">
                <select
                  value={invite.role}
                  onChange={(e) => updateInvite(index, 'role', e.target.value)}
                  className="input-ats !bg-stone-50/80 focus:!bg-white"
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <button
                type="button"
                onClick={() => removeInviteRow(index)}
                disabled={invites.length === 1}
                className="p-3 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-30"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addInviteRow}
          className="mt-4 flex items-center text-sm text-brand-700 hover:text-brand-800 font-medium transition-colors"
        >
          <Plus className="w-4 h-4 mr-1" /> Add another
        </button>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full sm:flex-1 !py-3.5"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Invites & Continue'}
          </button>
          <button
            type="button"
            onClick={() => handleInviteTeam(null, true)}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-3.5 text-sm font-medium text-stone-500 hover:text-stone-800 transition-colors"
          >
            Skip step
          </button>
          <button
            type="button"
            onClick={handleSkipAll}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-3.5 text-sm font-medium text-stone-400 hover:text-stone-700 transition-colors"
          >
            Go to dashboard
          </button>
        </div>
      </form>
    </div>
  );
}

export function OnboardingStep3({
  error, jobForm, setJobForm, loading, handlePostJob, handleSkipAll,
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-2 tracking-tight">Post your first job</h2>
        <p className="text-stone-500 text-sm sm:text-base">Create a job opening now, or skip and add one later.</p>
      </div>

      <OnboardingError error={error} />

      <form onSubmit={(e) => handlePostJob(e, false)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Job Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={jobForm.title}
            onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
            className="input-ats !bg-stone-50/80 focus:!bg-white"
            placeholder="e.g. Senior Frontend Engineer"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={jobForm.location}
              onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
              className="input-ats !bg-stone-50/80 focus:!bg-white"
              placeholder="e.g. Remote, or New York"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">
              Department <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={jobForm.department}
              onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
              className="input-ats !bg-stone-50/80 focus:!bg-white"
              placeholder="e.g. Engineering"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Employment Type</label>
          <select
            value={jobForm.employmentType}
            onChange={(e) => setJobForm({ ...jobForm, employmentType: e.target.value })}
            className="input-ats !bg-stone-50/80 focus:!bg-white"
          >
            {EMP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Description <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows="3"
            value={jobForm.description}
            onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
            className="input-ats !bg-stone-50/80 focus:!bg-white resize-none"
            placeholder="Brief description of the role..."
          />
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="submit"
            disabled={loading || !jobForm.title || !jobForm.location}
            className="btn-primary w-full sm:flex-1 !py-3.5"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Post Job & Continue'}
          </button>
          <button
            type="button"
            onClick={() => handlePostJob(null, true)}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-3.5 text-sm font-medium text-stone-500 hover:text-stone-800 transition-colors"
          >
            Skip step
          </button>
          <button
            type="button"
            onClick={handleSkipAll}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-3.5 text-sm font-medium text-stone-400 hover:text-stone-700 transition-colors"
          >
            Go to dashboard
          </button>
        </div>
      </form>
    </div>
  );
}

export function OnboardingStep4({ error, summary, loading, handleComplete }) {
  return (
    <div className="text-center animate-in zoom-in-95 duration-700">
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 bg-brand-200/50 rounded-full animate-ping" />
        <div className="relative flex items-center justify-center w-full h-full rounded-2xl bg-gradient-to-br from-brand-500 to-teal-700 shadow-lg shadow-brand-500/25">
          <PartyPopper className="w-10 h-10 text-white" />
        </div>
      </div>

      <h2 className="text-3xl font-bold text-stone-900 mb-3 tracking-tight">You&apos;re all set!</h2>
      <p className="text-stone-500 mb-8">Your workspace is ready. Head to the dashboard to start hiring.</p>

      <OnboardingError error={error} />

      <div className="card-ats-bordered p-5 mb-8 text-left max-w-sm mx-auto">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Setup Summary</h3>
        <ul className="space-y-3">
          <li className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-stone-700 text-sm">
              Workspace <strong className="text-stone-900">{summary.orgName}</strong>
            </span>
          </li>
          {summary.invitesCount > 0 && (
            <li className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-stone-700 text-sm">
                Invited <strong className="text-stone-900">{summary.invitesCount}</strong> team member{summary.invitesCount > 1 ? 's' : ''}
              </span>
            </li>
          )}
          {summary.jobPosted && (
            <li className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-stone-700 text-sm">First job posted</span>
            </li>
          )}
        </ul>
      </div>

      <button
        type="button"
        onClick={handleComplete}
        disabled={loading}
        className="btn-primary inline-flex items-center !py-3.5 !px-8"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
        Go to Dashboard <ChevronRight className="w-5 h-5 ml-1" />
      </button>
    </div>
  );
}

export function OnboardingStepper({ currentStep }) {
  return (
    <div className="max-w-3xl mx-auto w-full mb-12 px-2">
      <div className="relative flex justify-between items-center">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-stone-200 rounded-full" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-brand-500 to-teal-600 transition-all duration-500 ease-in-out"
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
        />

        {STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;

          return (
            <div key={step.id} className="relative flex flex-col items-center">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-500 z-10 border
                  ${isActive
                    ? 'bg-gradient-to-br from-brand-500 to-teal-700 text-white border-transparent scale-105 shadow-md shadow-brand-500/20'
                    : isCompleted
                      ? 'bg-brand-50 text-brand-700 border-brand-200'
                      : 'bg-white text-stone-400 border-stone-200'
                  }`}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span
                className={`absolute -bottom-7 text-xs font-medium whitespace-nowrap
                  ${isActive ? 'text-brand-700' : isCompleted ? 'text-stone-600' : 'text-stone-400'}
                `}
              >
                {step.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
