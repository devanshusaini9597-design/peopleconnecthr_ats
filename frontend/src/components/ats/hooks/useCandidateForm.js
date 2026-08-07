import { useState, useRef, useEffect, useMemo } from 'react';
import BASE_API_URL from '../../../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../../utils/fetchUtils';
import { dedupeByName } from '../../../utils/dedupeMasterData';
import { DEFAULT_CTC_BANDS, DEFAULT_NOTICE_PERIODS } from '../../../utils/ctcRanges';
import useCountries from '../../../utils/useCountries';
import { INITIAL_FORM_STATE } from '../atsConstants';

export function useCandidateForm({ toast, fetchData, searchQuery, filterJob, currentPage, setCurrentPage, API_URL } = {}) {
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [formErrors, setFormErrors] = useState({});
  const [orgCandidateFields, setOrgCandidateFields] = useState([]);
  const fieldRefs = {
    name: useRef(null), email: useRef(null), contact: useRef(null), ctc: useRef(null),
    position: useRef(null), companyName: useRef(null), location: useRef(null), spoc: useRef(null),
  };
  const [masterPositions, setMasterPositions] = useState([]);
  const [masterClients, setMasterClients] = useState([]);
  const [masterSources, setMasterSources] = useState([]);
  const [masterCtcBands, setMasterCtcBands] = useState([]);
  const [masterNoticePeriods, setMasterNoticePeriods] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [formSection, setFormSection] = useState('basic');
  const [stepBanner, setStepBanner] = useState('');
  const [quickList, setQuickList] = useState(null);
  const [countryCode, setCountryCode] = useState('+91');
  const [countryIso, setCountryIso] = useState('IN');
  const countryCodes = useCountries();
  const [aiScoreLoading, setAiScoreLoading] = useState(false);
  const [aiScoreResult, setAiScoreResult] = useState(null);
  const [jdForScore, setJdForScore] = useState('');
  const [statusOptions, setStatusOptions] = useState(['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']);
  const [isAutoParsing, setIsAutoParsing] = useState(false);

  const fetchMasterData = async () => {
    try {
      const opts = { credentials: 'include' };
      const [positionsRes, clientsRes, sourcesRes, ctcRes, noticeRes, teamRes] = await Promise.all([
        fetch(`${BASE_API_URL}/api/positions/all`, opts),
        fetch(`${BASE_API_URL}/api/clients/all`, opts),
        fetch(`${BASE_API_URL}/api/sources/all`, opts),
        fetch(`${BASE_API_URL}/api/org-lists/ctc/all`, opts),
        fetch(`${BASE_API_URL}/api/org-lists/notice/all`, opts),
        fetch(`${BASE_API_URL}/api/team`, opts),
      ]);
      if (positionsRes.ok) setMasterPositions(dedupeByName(await positionsRes.json()));
      if (clientsRes.ok) setMasterClients(dedupeByName(await clientsRes.json()));
      if (sourcesRes.ok) setMasterSources(dedupeByName(await sourcesRes.json()));
      if (ctcRes.ok) {
        const ctc = await ctcRes.json();
        setMasterCtcBands(Array.isArray(ctc) ? dedupeByName(ctc) : []);
      }
      if (noticeRes.ok) {
        const notice = await noticeRes.json();
        setMasterNoticePeriods(Array.isArray(notice) ? dedupeByName(notice) : []);
      }
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        if (teamData.success) setTeamMembers(teamData.members || []);
      }
    } catch (error) {
      console.error('Error fetching master data:', error);
    }
  };

  // Fetch master data for modal dropdowns
  useEffect(() => {
    fetchMasterData();
  }, []);

  // When Add/Edit opens: start on Basic tab and refresh shared lists
  useEffect(() => {
    if (!showModal) return;
    setFormSection('basic');
    setStepBanner('');
    fetchMasterData();
  }, [showModal]);

  const validateCandidateStep = (step, data = formData) => {
    const errors = {};
    const trimmed = { ...data };
    Object.keys(trimmed).forEach((key) => {
      if (typeof trimmed[key] === 'string') trimmed[key] = trimmed[key].trim();
    });

    if (step === 'basic') {
      if (!trimmed.name) errors.name = 'Name is required';
      else if (trimmed.name.length < 2) errors.name = 'Name must be at least 2 characters';
      else if (!/^[a-zA-Z\s.''-]+$/.test(trimmed.name)) errors.name = 'Name can only contain letters, spaces, and hyphens';

      if (!trimmed.email) errors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed.email)) errors.email = 'Enter a valid email address';

      if (!trimmed.contact) errors.contact = 'Contact number is required';
      else {
        const digits = String(trimmed.contact).replace(/\D/g, '');
        if (countryCode === '+91' && digits.length !== 10) errors.contact = 'Enter a valid 10-digit mobile number';
        else if (countryCode === '+1' && digits.length !== 10) errors.contact = 'Enter a valid 10-digit phone number';
        else if (digits.length < 7 || digits.length > 15) errors.contact = 'Enter a valid phone number';
      }
    }

    if (step === 'experience') {
      if (!trimmed.ctc) errors.ctc = 'Current CTC is required';
    }

    return errors;
  };

  const goCandidateStep = (nextId) => {
    const order = ['basic', 'experience', 'placement'];
    const from = order.indexOf(formSection);
    const to = order.indexOf(nextId);
    if (to > from) {
      const errors = validateCandidateStep(formSection);
      if (Object.keys(errors).length) {
        setFormErrors((prev) => ({ ...prev, ...errors }));
        const first = Object.keys(errors)[0];
        setStepBanner(errors[first]);
        toast.warning(errors[first]);
        setTimeout(() => {
          const el = fieldRefs[first]?.current;
          if (el) {
            if (typeof el.focus === 'function') {
              try { el.focus(); } catch { /* ignore */ }
            }
            el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          }
        }, 40);
        return;
      }
    }
    setStepBanner('');
    setFormSection(nextId);
  };

  const handleEdit = async (candidate) => {
    try {
      // Fetch fresh candidate data from backend
      const response = await authenticatedFetch(`${API_URL}/${candidate._id}`);
      if (response.ok) {
        const freshCandidate = await response.json();
        setEditId(freshCandidate._id);
        setAiScoreResult(null);
        setJdForScore('');
        setFormData({ 
          ...freshCandidate, 
          resume: null,
          customFields: freshCandidate.customFields && typeof freshCandidate.customFields === 'object'
            ? { ...freshCandidate.customFields }
            : {},
          countryCode: freshCandidate.countryCode || '+91',
          date: freshCandidate.date ? freshCandidate.date.split('T')[0] : new Date().toISOString().split('T')[0],
          callBackDate: freshCandidate.callBackDate ? freshCandidate.callBackDate.split('T')[0] : ''
        });
        const resolved = resolveCountryFromDial(freshCandidate.countryCode || '+91');
        setCountryCode(resolved.code);
        setCountryIso(resolved.iso);
        setFormErrors({});
        setShowModal(true);
      } else {
        toast.error('Failed to load candidate details. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching candidate:', error);
      toast.error('Error loading candidate details.');
    }
  };

  const handleAiScore = async () => {
    if (!editId || !jdForScore.trim()) {
      toast.warning('Paste a job description to score against.');
      return;
    }
    setAiScoreLoading(true);
    setAiScoreResult(null);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/ai/score`, {
        method: 'POST',
        body: JSON.stringify({ candidateId: editId, jobDescription: jdForScore }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Scoring failed');
      setAiScoreResult(data.data);
      toast.success('LLM score ready');
    } catch (err) {
      toast.error(err.message || 'AI scoring failed');
    } finally {
      setAiScoreLoading(false);
    }
  };

const handleInputChange = async (e) => {
  const { name, value, files } = e.target;

  // Clear error for the field being edited
  if (formErrors[name]) {
    setFormErrors(prev => ({ ...prev, [name]: '' }));
  }

  let finalValue = value;

  if (name === 'email') {
    finalValue = value.toLowerCase()
      .replace(/@gnail\.con$/, '@gmail.com')
      .replace(/@gnail\.com$/, '@gmail.com')
      .replace(/@gmail\.con$/, '@gmail.com')
      .replace(/@gmal\.com$/, '@gmail.com');
  } else if (name === 'name' || name === 'spoc' || name === 'location' || name === 'companyName') {
    // Remove leading spaces, collapse multiple spaces to one, proper-case each word
    // "DeVANshU saINI" → "Devanshu Saini"
    let v = value.replace(/^\s+/, '');
    v = v.replace(/\s{2,}/g, ' ');
    v = v.split(' ').map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
    finalValue = v;
  }

  // Collapse multiple consecutive spaces for all text fields (except email)
  if (typeof finalValue === 'string' && name !== 'email') {
    finalValue = finalValue.replace(/\s{2,}/g, ' ');
  }

  // --- Resume parsing ---
  if (name === 'resume') {
    const file = files[0];
    setFormData(prev => ({ ...prev, resume: file }));

    if (file) {
      setIsAutoParsing(true);
      const data = new FormData();
      data.append('resume', file);

      try {
        const response = await fetch(`${BASE_API_URL}/candidates/parse-logic`, {
          method: 'POST',
          body: data,
        });

        if (response.ok) {
          const result = await response.json();
          console.log("Parsed Data Received:", result);

          setFormData(prev => ({
            ...prev,
            name: result.name ? result.name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : prev.name,
            email: result.email ? result.email.toLowerCase().trim().replace(/@gnail\.con$/, '@gmail.com').replace(/@gmail\.con$/, '@gmail.com') : prev.email,
            contact: result.contact || prev.contact
          }));
          setFormErrors({}); // Clear all errors after successful parse
        }
      } catch (error) {
        console.error("Auto-parse error:", error);
      } finally {
        setIsAutoParsing(false);
      }
    }
  } else {
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  }
};

const handleAddCandidate = async (e) => {
  e.preventDefault();

  // --- Auto-trim all string fields + collapse spaces + proper case ---
  const trimmed = {};
  Object.keys(formData).forEach(key => {
    if (typeof formData[key] === 'string') {
      trimmed[key] = formData[key].trim().replace(/\s{2,}/g, ' ');
    } else {
      trimmed[key] = formData[key];
    }
  });

  // Proper-case name, spoc, location, companyName on submit
  ['name', 'spoc', 'location', 'companyName'].forEach(field => {
    if (trimmed[field]) {
      trimmed[field] = trimmed[field].split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  });

  setFormData(prev => ({ ...prev, ...trimmed }));

  // --- Step-by-step validation ---
  const errors = {};

  // 1. Name: required, min 2 chars, letters/spaces only
  if (!trimmed.name) {
    errors.name = 'Name is required';
  } else if (trimmed.name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  } else if (!/^[a-zA-Z\s.''-]+$/.test(trimmed.name)) {
    errors.name = 'Name can only contain letters, spaces, and hyphens';
  }

  // 2. Email: required, valid format
  if (!trimmed.email) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed.email)) {
    errors.email = 'Please enter a valid email address';
  }

  // 3. Contact: required, 10 digits for India
  if (!trimmed.contact) {
    errors.contact = 'Contact number is required';
  } else {
    const digits = trimmed.contact.replace(/\D/g, '');
    if (countryCode === '+91' && digits.length !== 10) {
      errors.contact = 'Enter a valid 10-digit mobile number';
    } else if (countryCode === '+1' && digits.length !== 10) {
      errors.contact = 'Enter a valid 10-digit phone number';
    } else if (digits.length < 7 || digits.length > 15) {
      errors.contact = 'Enter a valid phone number';
    }
  }

  // 4. CTC: required
  if (!trimmed.ctc) {
    errors.ctc = 'Current CTC is required';
  }

  // If there are errors, set them, focus the first invalid field, and stop
  if (Object.keys(errors).length > 0) {
    setFormErrors(errors);
    const firstErrorField = Object.keys(errors)[0];
    // Switch to the tab that contains the error
    if (['name', 'email', 'contact', 'position', 'companyName', 'location'].includes(firstErrorField)) {
      setFormSection('basic');
    } else if (['experience', 'ctc', 'expectedCtc', 'noticePeriod', 'fls', 'status'].includes(firstErrorField)) {
      setFormSection('experience');
    } else {
      setFormSection('placement');
    }
    setStepBanner(errors[firstErrorField]);
    // Focus after tab paint
    setTimeout(() => {
      if (fieldRefs[firstErrorField]?.current) {
        const el = fieldRefs[firstErrorField].current;
        if (typeof el.focus === 'function') {
          try { el.focus(); } catch { /* non-focusable wrapper */ }
        }
        el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
    toast.warning(errors[firstErrorField]);
    return;
  }

  setFormErrors({});
  setStepBanner('');

  try {
    let response;
    
    // Use FormData for both create and edit (supports file upload)
    const data = new FormData();
    Object.keys(trimmed).forEach((key) => {
      if (['statusHistory', '_id', '__v', 'updatedAt', 'createdAt', 'organizationId', 'createdBy'].includes(key)) return;
      if (key === 'resume') {
        if (trimmed[key] instanceof File) data.append('resume', trimmed[key]);
      } else if (key === 'customFields') {
        const bag = trimmed.customFields && typeof trimmed.customFields === 'object' ? trimmed.customFields : {};
        data.append('customFields', JSON.stringify(bag));
      } else if (typeof trimmed[key] === 'object' && trimmed[key] !== null) {
        return;
      } else {
        data.append(key, trimmed[key] || "");
      }
    });

    const url = editId ? `${API_URL}/${editId}` : API_URL;
    const method = editId ? 'PUT' : 'POST';
    response = await authenticatedFetch(url, {
      method,
      body: data
    });

    if (isUnauthorized(response)) {
      handleUnauthorized();
      return;
    }

    if (response.ok) {
      toast.success(editId ? 'Profile Updated!' : 'Candidate Added!');
      setShowModal(false);
      setEditId(null);
      setFormData(INITIAL_FORM_STATE);
      setFormErrors({});
      const pageToRestore = currentPage;
      await fetchData(1, { search: searchQuery, position: filterJob });
      setCurrentPage(pageToRestore);
    } else {
      const errJson = await response.json();
      toast.error('Error: ' + errJson.message);
    }
  } catch (err) { 
    console.error(err);
    toast.error('Server Error'); 
  }
};

  const resolveCountryFromDial = (dial) => {
    const code = dial || '+91';
    const matches = (countryCodes || []).filter((c) => c.code === code);
    if (!matches.length) return { iso: 'IN', code: '+91' };
    const preferred = matches.find((c) => c.iso === 'IN')
      || matches.find((c) => c.iso === 'US')
      || matches[0];
    return { iso: preferred.iso, code: preferred.code };
  };

  const setFormField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: '' }));
    setStepBanner('');
  };

  // Fetch status options from master data (or backend) on mount
  useEffect(() => {
    const fetchStatusOptions = async () => {
      try {
        const response = await fetch(`${BASE_API_URL}/api/statuses`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) setStatusOptions(data);
        }
      } catch (err) {
        // fallback to default
      }
    };
    fetchStatusOptions();
  }, []);

  const formPositionOptions = useMemo(() => masterPositions.map((pos) => ({ value: pos.name, label: pos.name })), [masterPositions]);
  const formExperienceOptions = useMemo(() => [
    { value: '', label: 'Select' }, { value: 'Fresher', label: 'Fresher' },
    ...[...Array(31).keys()].slice(1).map((num) => ({ value: String(num), label: String(num) })),
  ], []);
  const formCtcOptions = useMemo(() => {
    const names = masterCtcBands.length ? masterCtcBands.map((x) => x.name).filter(Boolean) : DEFAULT_CTC_BANDS;
    return names.map((r) => ({ value: r, label: r }));
  }, [masterCtcBands]);
  const formExpectedCtcOptions = useMemo(() => {
    const bands = masterCtcBands.length ? masterCtcBands.map((x) => x.name).filter(Boolean) : DEFAULT_CTC_BANDS;
    const withNorms = bands.includes('As Per Company Norms') ? bands : ['As Per Company Norms', ...bands];
    return withNorms.map((r) => ({ value: r, label: r }));
  }, [masterCtcBands]);
  const formNoticeOptions = useMemo(() => {
    const names = masterNoticePeriods.length ? masterNoticePeriods.map((x) => x.name).filter(Boolean) : DEFAULT_NOTICE_PERIODS;
    return names.map((opt) => ({ value: opt, label: opt }));
  }, [masterNoticePeriods]);
  const formFlsOptions = useMemo(() => [
    { value: '', label: 'Select' }, { value: 'FLS', label: 'FLS' }, { value: 'Non-FLS', label: 'Non-FLS' },
  ], []);
  const formStatusOptions = useMemo(() => [
    'Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined', 'Dropped', 'Rejected',
    'Interested', 'Interested and scheduled',
  ].map((s) => ({ value: s, label: s })), []);
  const formClientOptions = useMemo(() => masterClients.map((c) => ({ value: c.name, label: c.name })), [masterClients]);
  const formSourceOptions = useMemo(() => masterSources.map((s) => ({ value: s.name, label: s.name })), [masterSources]);
  const formCountryOptions = useMemo(() => (countryCodes || []).map((c) => {
    const iso = (c.iso || '').toUpperCase();
    return { value: iso || c.code, label: c.code, description: c.name || "", flagIso: iso || undefined, searchText: `${c.name || ""} ${iso} ${c.code || ""}` };
  }), [countryCodes]);

  return {
    showModal, setShowModal, editId, setEditId, formData, setFormData, formErrors, setFormErrors,
    orgCandidateFields, setOrgCandidateFields, fieldRefs, masterPositions, masterClients, masterSources,
    masterCtcBands, masterNoticePeriods, teamMembers, setTeamMembers, formSection, setFormSection,
    stepBanner, setStepBanner, quickList, setQuickList, countryCode, setCountryCode, countryIso, setCountryIso,
    countryCodes, aiScoreLoading, aiScoreResult, jdForScore, setJdForScore, statusOptions,
    isAutoParsing,
    fetchMasterData, validateCandidateStep, goCandidateStep, handleEdit, handleAiScore,
    handleInputChange, handleAddCandidate, resolveCountryFromDial, setFormField,
    formPositionOptions, formExperienceOptions, formCtcOptions, formExpectedCtcOptions,
    formNoticeOptions, formFlsOptions, formStatusOptions, formClientOptions, formSourceOptions, formCountryOptions,
    initialFormState: INITIAL_FORM_STATE,
  };
}
