import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API_URL from '../config';
import { useAuth } from '../context/AuthContext';
import { BRAND_NAME } from './ui/BrandLogo';
import {
  OnboardingStep1,
  OnboardingStep2,
  OnboardingStep3,
  OnboardingStep4,
  OnboardingStepper,
} from './onboarding/OnboardingSteps';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, organization, updateUser, updateOrganization, refreshProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [orgName, setOrgName] = useState('');
  const [orgDomain, setOrgDomain] = useState('');
  const [invites, setInvites] = useState([{ email: '', role: 'hr_recruiter' }]);
  const [jobForm, setJobForm] = useState({
    title: '',
    location: '',
    department: '',
    employmentType: 'Full-time',
    description: ''
  });
  const [summary, setSummary] = useState({
    orgName: '',
    invitesCount: 0,
    jobPosted: false
  });

  useEffect(() => {
    try {
      const email = user?.email
        || (() => {
          try {
            const data = localStorage.getItem('userData');
            return data ? JSON.parse(data)?.email : null;
          } catch {
            return null;
          }
        })();
      if (email) {
        const parts = email.split('@');
        if (parts.length === 2) {
          const domain = parts[1];
          const freeDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
          if (!freeDomains.includes(domain)) {
            setOrgDomain(domain);
            if (!orgName) {
              const label = domain.split('.')[0] || domain;
              setOrgName(label.charAt(0).toUpperCase() + label.slice(1));
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse user email', e);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json'
  });

  const markOnboardingDone = async (orgPayload) => {
    const response = await fetch(`${API_URL}/api/onboarding/complete-onboarding`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to complete onboarding');
    }

    updateUser({ onboardingCompleted: true });
    if (orgPayload) {
      updateOrganization(orgPayload);
      if (orgPayload._id) localStorage.setItem('orgId', orgPayload._id);
      localStorage.setItem('orgData', JSON.stringify(orgPayload));
      localStorage.setItem('orgName', orgPayload.name || '');
    }
    try {
      const existing = localStorage.getItem('userData');
      if (existing) {
        const parsed = JSON.parse(existing);
        localStorage.setItem('userData', JSON.stringify({ ...parsed, onboardingCompleted: true }));
      }
    } catch {
      /* ignore */
    }
  };

  const ensureOrganization = async (nameOverride) => {
    if (user?.organizationId || organization?._id) {
      return organization || { name: summary.orgName || orgName || nameOverride };
    }

    const name = (nameOverride || orgName || 'My Workspace').trim();
    if (name.length < 2) {
      throw new Error('Company name must be at least 2 characters');
    }

    const response = await fetch(`${API_URL}/api/onboarding/create-org`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ name, domain: orgDomain })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Already has an org — treat as success and continue
      if (response.status === 400 && /already has an organization/i.test(data.message || '')) {
        await refreshProfile();
        return organization || { name };
      }
      throw new Error(data.message || 'Failed to create organization');
    }

    const created = data.organization || { name };
    updateUser({ organizationId: created._id, role: 'owner' });
    updateOrganization(created);
    setSummary((prev) => ({ ...prev, orgName: created.name || name }));
    return created;
  };

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    if (orgName.trim().length < 2) {
      setError('Company name must be at least 2 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const created = await ensureOrganization(orgName);
      localStorage.setItem('orgData', JSON.stringify(created));
      setSummary((prev) => ({ ...prev, orgName: created.name || orgName }));
      setCurrentStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const finishAndGoToDashboard = async (nameOverride) => {
    setLoading(true);
    setError('');
    try {
      const created = await ensureOrganization(nameOverride);
      await markOnboardingDone(created);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipOnboarding = () => finishAndGoToDashboard(orgName || 'My Workspace');

  const handleInviteTeam = async (e, skip = false) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!skip) {
        const validInvites = invites.filter(inv => inv.email.trim() !== '');

        if (validInvites.length > 0) {
          await Promise.all(validInvites.map(inv =>
            fetch(`${API_URL}/api/onboarding/invite`, {
              method: 'POST',
              headers: getAuthHeaders(),
              credentials: 'include',
              body: JSON.stringify(inv)
            }).then(res => {
              if (!res.ok) throw new Error(`Failed to invite ${inv.email}`);
              return res.json();
            })
          ));
          setSummary(prev => ({ ...prev, invitesCount: validInvites.length }));
        }
      }
      setCurrentStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePostJob = async (e, skip = false) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!skip) {
        if (!jobForm.title || !jobForm.location) {
          throw new Error('Title and Location are required');
        }

        const response = await fetch(`${API_URL}/jobs`, {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify(jobForm)
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to post job');
        }

        setSummary(prev => ({ ...prev, jobPosted: true }));
      }
      setCurrentStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => finishAndGoToDashboard(summary.orgName || orgName || 'My Workspace');

  const addInviteRow = () => {
    setInvites([...invites, { email: '', role: 'hr_recruiter' }]);
  };

  const removeInviteRow = (index) => {
    if (invites.length > 1) {
      const newInvites = [...invites];
      newInvites.splice(index, 1);
      setInvites(newInvites);
    }
  };

  const updateInvite = (index, field, value) => {
    const newInvites = [...invites];
    newInvites[index][field] = value;
    setInvites(newInvites);
  };

  return (
    <div className="auth-page-shell flex flex-col bg-stone-50 text-stone-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-brand-300/25 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 w-80 h-80 rounded-full bg-teal-200/30 blur-3xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 mb-2">{BRAND_NAME}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">Workspace setup</h1>
          <p className="mt-2 text-sm text-stone-500">A few quick steps to get your hiring workspace ready.</p>
        </div>

        <OnboardingStepper currentStep={currentStep} />

        <div className="max-w-xl mx-auto w-full">
          <div className="auth-form-card !p-8 sm:!p-10">
            {currentStep === 1 && (
              <OnboardingStep1
                error={error}
                orgName={orgName}
                setOrgName={setOrgName}
                orgDomain={orgDomain}
                setOrgDomain={setOrgDomain}
                loading={loading}
                handleCreateOrg={handleCreateOrg}
                handleSkip={handleSkipOnboarding}
              />
            )}
            {currentStep === 2 && (
              <OnboardingStep2
                error={error}
                invites={invites}
                loading={loading}
                handleInviteTeam={handleInviteTeam}
                addInviteRow={addInviteRow}
                removeInviteRow={removeInviteRow}
                updateInvite={updateInvite}
                handleSkipAll={handleSkipOnboarding}
              />
            )}
            {currentStep === 3 && (
              <OnboardingStep3
                error={error}
                jobForm={jobForm}
                setJobForm={setJobForm}
                loading={loading}
                handlePostJob={handlePostJob}
                handleSkipAll={handleSkipOnboarding}
              />
            )}
            {currentStep === 4 && (
              <OnboardingStep4
                error={error}
                summary={summary}
                loading={loading}
                handleComplete={handleComplete}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
