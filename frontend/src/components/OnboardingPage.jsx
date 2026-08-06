import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API_URL from '../config';
import {
  OnboardingStep1,
  OnboardingStep2,
  OnboardingStep3,
  OnboardingStep4,
  OnboardingStepper,
} from './onboarding/OnboardingSteps';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [orgName, setOrgName] = useState('');
  const [orgDomain, setOrgDomain] = useState('');
  const [invites, setInvites] = useState([{ email: '', role: 'Recruiter' }]);
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
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && user.email) {
          const parts = user.email.split('@');
          if (parts.length === 2) {
            const domain = parts[1];
            const freeDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
            if (!freeDomains.includes(domain)) {
              setOrgDomain(domain);
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse user email', e);
    }
  }, []);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json'
  });

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    if (orgName.trim().length < 2) {
      setError('Company name must be at least 2 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/onboarding/create-org`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ name: orgName, domain: orgDomain })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create organization');
      }

      const data = await response.json();
      localStorage.setItem('orgData', JSON.stringify(data.organization || { name: orgName }));

      setSummary(prev => ({ ...prev, orgName }));
      setCurrentStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

  const handleComplete = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/onboarding/complete-onboarding`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to complete onboarding');
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addInviteRow = () => {
    setInvites([...invites, { email: '', role: 'Recruiter' }]);
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
    <div className="min-h-screen bg-[#0A0A0B] flex flex-col font-sans selection:bg-indigo-500/30">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-600/20 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative z-10">
        <OnboardingStepper currentStep={currentStep} />

        <div className="max-w-xl mx-auto w-full">
          <div className="bg-[#121214]/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-8 sm:p-12 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            {currentStep === 1 && (
              <OnboardingStep1
                error={error}
                orgName={orgName}
                setOrgName={setOrgName}
                orgDomain={orgDomain}
                setOrgDomain={setOrgDomain}
                loading={loading}
                handleCreateOrg={handleCreateOrg}
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
              />
            )}
            {currentStep === 3 && (
              <OnboardingStep3
                error={error}
                jobForm={jobForm}
                setJobForm={setJobForm}
                loading={loading}
                handlePostJob={handlePostJob}
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
