import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import BASE_API_URL from '../../../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized, planLimitErrorMessage } from '../../../utils/fetchUtils';
import { dedupeByName } from '../../../utils/dedupeMasterData';
import { DEFAULT_CTC_BANDS, DEFAULT_NOTICE_PERIODS } from '../../../utils/ctcRanges';
import { fetchPicklist, PICKLIST_DROPDOWN_LIMIT } from '../../../utils/orgListFetch';
import useCountries from '../../../utils/useCountries';
import { useAuth } from '../../../context/AuthContext';
import { todayLocalISO, blankCandidateForm } from '../atsConstants';
import { clientRequiresPan, normalizePan, validatePan } from '../../../utils/panClientRules';
import {
  resumeIdentityConflicts,
  mergeResumeIntoForm,
} from '../../../utils/resumeFormMerge';
import { canEditCandidateSpoc, resolveEmployeeSpocLabel } from '../../../utils/spocIdentity';

export function useCandidateForm({ toast, fetchData, searchQuery, filterJob, currentPage, setCurrentPage, API_URL } = {}) {
  const { user } = useAuth();
  const isFreelancer = user?.role === 'freelancer';
  const canEditSpoc = canEditCandidateSpoc(user?.role);

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  // Guard ref to prevent ghost click auto-submit when step transitions
  const recentStepChangeRef = useRef(false);
  const [formData, setFormData] = useState(() => blankCandidateForm(user?.role));
  const [formErrors, setFormErrors] = useState({});
  const [orgCandidateFields, setOrgCandidateFields] = useState([]);
  const [showPanRequiredModal, setShowPanRequiredModal] = useState(false);
  const [resumeConflictModal, setResumeConflictModal] = useState({
    isOpen: false,
    result: null,
  });
  const fieldRefs = {
    name: useRef(null), email: useRef(null), contact: useRef(null), ctc: useRef(null),
    position: useRef(null), companyName: useRef(null), location: useRef(null), spoc: useRef(null),
    pan: useRef(null), product: useRef(null), resume: useRef(null),
  };
  const [masterPositions, setMasterPositions] = useState([]);
  const [masterClients, setMasterClients] = useState([]);
  const [masterSources, setMasterSources] = useState([]);
  const [masterCtcBands, setMasterCtcBands] = useState([]);
  const [masterNoticePeriods, setMasterNoticePeriods] = useState([]);
  const [masterProducts, setMasterProducts] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const teamNamesKeyRef = useRef('');
  const [formSection, setFormSection] = useState('basic');
  const [stepDirection, setStepDirection] = useState('forward');
  const [stepBanner, setStepBanner] = useState('');
  const [quickList, setQuickList] = useState(null);
  const [countryCode, setCountryCode] = useState('+91');
  const [countryIso, setCountryIso] = useState('IN');
  const countryCodes = useCountries();
  const [aiScoreLoading, setAiScoreLoading] = useState(false);
  const [aiScoreResult, setAiScoreResult] = useState(null);
  const [jdForScore, setJdForScore] = useState('');
  const [statusOptions, setStatusOptions] = useState([
    'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED',
  ]);
  const [isAutoParsing, setIsAutoParsing] = useState(false);
  const [masterDataLoading, setMasterDataLoading] = useState(true);
  const masterFetchRef = useRef(0);

  const teamNamesKey = useMemo(
    () => (teamMembers || []).map((m) => m.name || '').join('|'),
    [teamMembers]
  );

  const blankForm = useCallback(() => {
    const next = blankCandidateForm(user?.role);
    const names = teamNamesKey ? teamNamesKey.split('|').filter(Boolean) : [];
    if (user?.name) names.push(user.name);
    next.spoc = resolveEmployeeSpocLabel(user, names);
    return next;
  }, [user?.role, user?.name, user?.email, teamNamesKey]);

  const openAddCandidate = useCallback(() => {
    setEditId(null);
    setFormSection('basic');
    setStepDirection('forward');
    setStepBanner('');
    setFormErrors({});
    setAiScoreResult(null);
    setJdForScore('');
    setCountryCode('+91');
    setCountryIso('IN');
    setFormData(blankForm());
    setShowModal(true);
  }, [blankForm]);

  const fetchMasterData = async ({ silent = false } = {}) => {
    const requestId = ++masterFetchRef.current;
    const blockUi = !silent && masterPositions.length === 0;
    if (blockUi) setMasterDataLoading(true);
    try {
      const positions = await fetchPicklist('/api/positions', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []);
      if (requestId !== masterFetchRef.current) return;
      setMasterPositions(dedupeByName(positions));
      setMasterDataLoading(false);

      const opts = { credentials: 'include' };
      const [clients, sources, ctc, notice, product, teamRes] = await Promise.all([
        fetchPicklist('/api/clients', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
        fetchPicklist('/api/sources', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
        fetchPicklist('/api/org-lists/ctc').catch(() => []),
        fetchPicklist('/api/org-lists/notice').catch(() => []),
        fetchPicklist('/api/org-lists/product', { limit: PICKLIST_DROPDOWN_LIMIT }).catch(() => []),
        isFreelancer ? Promise.resolve({ ok: false }) : fetch(`${BASE_API_URL}/api/team`, opts),
      ]);
      if (requestId !== masterFetchRef.current) return;
      setMasterClients(dedupeByName(clients));
      {
        const list = dedupeByName(sources);
        if (isFreelancer && !list.some((s) => String(s.name).toLowerCase() === 'freelance')) {
          list.unshift({ name: 'Freelance' });
        }
        setMasterSources(list);
      }
      setMasterCtcBands(dedupeByName(ctc));
      setMasterNoticePeriods(dedupeByName(notice));
      setMasterProducts(dedupeByName(product));
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        if (teamData.success) {
          const members = teamData.members || [];
          const namesKey = members.map((m) => m.name || '').join('|');
          if (namesKey !== teamNamesKeyRef.current) {
            teamNamesKeyRef.current = namesKey;
            setTeamMembers(members);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching master data:', error);
    } finally {
      if (requestId === masterFetchRef.current) setMasterDataLoading(false);
    }
  };

  // Fetch master data for modal dropdowns (once on mount)
  useEffect(() => {
    fetchMasterData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Soft-refresh picklists when modal opens — do not reset form fields or step mid-typing
  useEffect(() => {
    if (!showModal) return;
    fetchMasterData({ silent: true });
  }, [showModal]); // eslint-disable-line react-hooks/exhaustive-deps

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

      if (isFreelancer && !editId) {
        const hasResumeFile = trimmed.resume instanceof File;
        const hasExistingResume = typeof trimmed.resume === 'string' && trimmed.resume.trim();
        if (!hasResumeFile && !hasExistingResume) {
          errors.resume = 'A resume is required before this candidate can be saved.';
        }
      }
    }

    if (step === 'experience') {
      if (!trimmed.ctc) errors.ctc = 'Current CTC is required';
    }

    if (step === 'placement') {
      const panErr = validatePan(trimmed.pan, { required: clientRequiresPan(trimmed.client, masterClients) });
      if (panErr) errors.pan = panErr;
    }

    return errors;
  };

  const goCandidateStep = (nextId) => {
    // Never leave profile while a resume is still being read into the form.
    if (isAutoParsing) {
      setFormSection('basic');
      toast.info('Wait for resume parsing to finish before leaving step 1.');
      return;
    }
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
    setStepDirection(to >= from ? 'forward' : 'back');
    // Set guard flag to prevent ghost click from triggering submit
    recentStepChangeRef.current = true;
    setFormSection(nextId);
    // Clear the guard after browser has finished processing the click event
    // Increased timeout to 500ms to ensure ghost click is fully handled
    setTimeout(() => { recentStepChangeRef.current = false; }, 500);
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
          date: freshCandidate.date ? freshCandidate.date.split('T')[0] : todayLocalISO(),
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
  if (name === 'spoc' && !canEditSpoc) return;

  let finalValue = value;

  if (name === 'email') {
    finalValue = value.toLowerCase()
      .replace(/@gnail\.con$/, '@gmail.com')
      .replace(/@gnail\.com$/, '@gmail.com')
      .replace(/@gmail\.con$/, '@gmail.com')
      .replace(/@gmal\.com$/, '@gmail.com');
  } else if (
    name === 'name' || name === 'spoc' || name === 'location' || name === 'companyName' || name === 'remark'
    || name === 'position' || name === 'client' || name === 'source' || name === 'ctc' || name === 'expectedCtc'
    || name === 'noticePeriod' || name === 'status' || name === 'experience' || name === 'fls' || name === 'feedback'
    || name === 'skills' || name === 'company' || name === 'product'
  ) {
    // Block letters (ALL CAPS), collapse spaces
    let v = value.replace(/^\s+/, '');
    v = v.replace(/\s{2,}/g, ' ');
    finalValue = v.toUpperCase();
  } else if (name === 'pan') {
    finalValue = normalizePan(value).slice(0, 10);
  }

  // Collapse multiple consecutive spaces for all text fields (except email)
  if (typeof finalValue === 'string' && name !== 'email') {
    finalValue = finalValue.replace(/\s{2,}/g, ' ');
  }

  // --- Resume parsing ---
  if (name === 'resume') {
    const file = files[0];
    // File picker can fire a ghost click that advances the wizard — lock on step 1.
    recentStepChangeRef.current = true;
    setFormSection('basic');
    setFormData(prev => ({ ...prev, resume: file || null }));
    setFormErrors((prev) => {
      if (!prev.resume) return prev;
      const next = { ...prev };
      delete next.resume;
      return next;
    });
    if (file) setStepBanner((b) => (b && /cv|resume/i.test(b) ? '' : b));

    if (file) {
      setIsAutoParsing(true);
      const data = new FormData();
      data.append('resume', file);

      try {
        const response = await authenticatedFetch(`${BASE_API_URL}/candidates/parse-logic`, {
          method: 'POST',
          body: data,
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Parsed Data Received:', result);

          const conflict = resumeIdentityConflicts(formData, result);
          const formatName = (s) => String(s).trim().replace(/\s{2,}/g, ' ').toUpperCase();

          if (conflict) {
            setResumeConflictModal({ isOpen: true, result });
            setFormSection('basic');
            return;
          }

          setFormData((prev) => mergeResumeIntoForm(prev, result, 'empty-only', { formatName }));
          // Stay on basic/resume step after upload — do not advance the wizard.
          setFormSection('basic');
          const filled = ['name', 'email', 'contact', 'position', 'company', 'experience', 'location']
            .filter((k) => result[k]);
          if (filled.length) {
            toast.success(`Resume read — filled empty fields (${filled.length}). Review step 1, then continue.`);
          } else {
            toast.warning('Resume uploaded, but no name/email/phone could be read. Enter details manually.');
          }
        } else {
          const err = await response.json().catch(() => ({}));
          toast.warning(err.details || err.error || 'Could not auto-read this resume. Enter details manually.');
        }
      } catch (error) {
        console.error('Auto-parse error:', error);
        toast.warning('Resume upload saved, but auto-read failed. Enter details manually.');
      } finally {
        setIsAutoParsing(false);
        setFormSection('basic');
        window.setTimeout(() => { recentStepChangeRef.current = false; }, 700);
      }
    } else {
      window.setTimeout(() => { recentStepChangeRef.current = false; }, 400);
    }
  } else {
    setFormData(prev => ({ ...prev, [name]: finalValue }));
    if (name === 'pan') {
      const panErr = validatePan(finalValue, {
        required: clientRequiresPan(formData.client, masterClients),
      });
      setFormErrors((prev) => ({ ...prev, pan: panErr }));
    } else if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
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

  // Block-letter text fields on submit
  ['name', 'spoc', 'location', 'companyName', 'remark'].forEach(field => {
    if (trimmed[field]) {
      trimmed[field] = trimmed[field].replace(/\s{2,}/g, ' ').toUpperCase();
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

  // Freelancer: resume is mandatory on create
  if (isFreelancer && !editId) {
    const hasResumeFile = trimmed.resume instanceof File;
    const hasExistingResume = typeof trimmed.resume === 'string' && trimmed.resume.trim();
    if (!hasResumeFile && !hasExistingResume) {
      errors.resume = 'A resume is required before this candidate can be saved.';
    }
  }

  // 5. PAN: required when the selected client has requiresPan enabled
  if (trimmed.pan) trimmed.pan = normalizePan(trimmed.pan);
  const panErr = validatePan(trimmed.pan, { required: clientRequiresPan(trimmed.client, masterClients) });
  if (panErr) errors.pan = panErr;

  // If there are errors, set them, focus the first invalid field, and stop
  if (Object.keys(errors).length > 0) {
    setFormErrors(errors);
    const firstErrorField = Object.keys(errors)[0];
    // Switch to the tab that contains the error
    if (['name', 'email', 'contact', 'position', 'companyName', 'location', 'resume'].includes(firstErrorField)) {
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
      } else if (key === 'legalHold') {
        // Handle boolean field - only send if explicitly true, otherwise skip
        if (trimmed[key] === true || trimmed[key] === 'true' || trimmed[key] === 'Yes') {
          data.append(key, 'true');
        }
        // Don't send anything for false, empty string, or any other value
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
      window.dispatchEvent(new CustomEvent('candidates:changed'));
      setShowModal(false);
      setEditId(null);
      setFormData(blankForm());
      setFormErrors({});
      const pageToRestore = currentPage;
      await fetchData(1, { search: searchQuery, position: filterJob });
      setCurrentPage(pageToRestore);
    } else {
      const errJson = await response.json().catch(() => ({}));
      if (errJson?.code === 'DUPLICATE_EMAIL' || errJson?.code === 'DUPLICATE_PHONE' || /already exists|duplicate/i.test(String(errJson?.message || ''))) {
        const dupMsg = isFreelancer
          ? (errJson.message || 'The candidate is duplicate kindly check with the hiring manager')
          : (errJson.message || 'This candidate already exists in the organization.');
        toast.error(dupMsg);
        if (errJson.code === 'DUPLICATE_EMAIL' || /email/i.test(String(errJson?.message || ''))) {
          setFormErrors((prev) => ({ ...prev, email: errJson.message || 'Candidate already exists (email)' }));
          setFormSection('basic');
        } else if (errJson.code === 'DUPLICATE_PHONE' || /phone|contact/i.test(String(errJson?.message || ''))) {
          setFormErrors((prev) => ({ ...prev, contact: errJson.message || 'Candidate already exists (phone)' }));
          setFormSection('basic');
        }
      } else {
        toast.error(planLimitErrorMessage(errJson, 'candidates'));
      }
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
    const skipUpper = new Set(['email', 'contact', 'date', 'callBackDate', 'resume', 'countryCode', 'customFields', 'pan']);
    let next = value;
    if (name === 'pan' && typeof next === 'string') {
      next = normalizePan(next).slice(0, 10);
    } else if (typeof next === 'string' && !skipUpper.has(name)) {
      next = next.replace(/\s{2,}/g, ' ').toUpperCase();
    }
    setFormData((prev) => ({ ...prev, [name]: next }));
    if (name === 'pan') {
      const panErr = validatePan(next, {
        required: clientRequiresPan(formData.client, masterClients),
      });
      setFormErrors((prev) => ({ ...prev, pan: panErr }));
    } else if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setStepBanner('');
  };

  /** Client change must re-check PAN immediately — old “required” errors must not stick. */
  const applyResumeMerge = (mode) => {
    const result = resumeConflictModal.result;
    setResumeConflictModal({ isOpen: false, result: null });
    // Always stay on profile step after resume decisions.
    recentStepChangeRef.current = true;
    setFormSection('basic');
    window.setTimeout(() => { recentStepChangeRef.current = false; }, 700);
    if (!result) return;
    const formatName = (s) => String(s).trim().replace(/\s{2,}/g, ' ').toUpperCase();
    setFormData((prev) => mergeResumeIntoForm(prev, result, mode, { formatName }));
    toast.success(
      mode === 'replace'
        ? 'Resume applied — form fields replaced. Review step 1, then continue.'
        : 'Kept your typed details — empty fields filled only. Stay on step 1 to review.'
    );
  };

  const onClientChange = (value) => {
    const nextClient = typeof value === 'string'
      ? value.replace(/^\s+/, '').replace(/\s{2,}/g, ' ').toUpperCase()
      : value;
    const needsPan = clientRequiresPan(nextClient, masterClients);
    const currentPan = formData.pan;
    const panErr = validatePan(currentPan, { required: needsPan });
    setFormData((prev) => ({ ...prev, client: nextClient }));
    setFormErrors((prev) => ({ ...prev, client: '', pan: panErr }));
    setStepBanner('');
    if (needsPan && !normalizePan(currentPan)) {
      setShowPanRequiredModal(true);
    }
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
      } catch (_err) {
        // fallback to default
      }
    };
    fetchStatusOptions();
  }, []);

  const toBlock = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  const formPositionOptions = useMemo(() => {
    const names = masterPositions.map((pos) => toBlock(pos.name)).filter(Boolean);
    const current = toBlock(formData.position);
    if (current && !names.includes(current)) names.unshift(current);
    return names.map((v) => ({ value: v, label: v }));
  }, [masterPositions, formData.position]);
  const formExperienceOptions = useMemo(() => [
    { value: '', label: 'SELECT' },
    { value: 'FRESHER', label: 'FRESHER' },
    ...[...Array(31).keys()].slice(1).map((num) => ({ value: String(num), label: String(num) })),
  ], []);
  const formCtcOptions = useMemo(() => {
    const names = masterCtcBands.length
      ? masterCtcBands.map((x) => x.name).filter(Boolean)
      : (isFreelancer ? [] : DEFAULT_CTC_BANDS);
    return names.map((r) => {
      const v = toBlock(r);
      return { value: v, label: v };
    });
  }, [masterCtcBands, isFreelancer]);
  const formExpectedCtcOptions = useMemo(() => {
    const bands = (masterCtcBands.length
      ? masterCtcBands.map((x) => x.name).filter(Boolean)
      : (isFreelancer ? [] : DEFAULT_CTC_BANDS)
    ).map(toBlock);
    const withNorms = isFreelancer
      ? bands
      : (bands.includes('AS PER COMPANY NORMS') ? bands : ['AS PER COMPANY NORMS', ...bands]);
    return withNorms.map((r) => ({ value: r, label: r }));
  }, [masterCtcBands, isFreelancer]);
  const formNoticeOptions = useMemo(() => {
    const names = masterNoticePeriods.length
      ? masterNoticePeriods.map((x) => x.name).filter(Boolean)
      : (isFreelancer ? [] : DEFAULT_NOTICE_PERIODS);
    return names.map((opt) => {
      const v = toBlock(opt);
      return { value: v, label: v };
    });
  }, [masterNoticePeriods, isFreelancer]);
  const formProductOptions = useMemo(() => {
    const names = masterProducts.map((x) => x.name).filter(Boolean);
    return names.map((opt) => {
      const v = toBlock(opt);
      return { value: v, label: v };
    });
  }, [masterProducts]);
  const formFlsOptions = useMemo(() => [
    { value: '', label: 'SELECT' },
    { value: 'FLS', label: 'FLS' },
    { value: 'NON-FLS', label: 'NON-FLS' },
  ], []);
  const formStatusOptions = useMemo(() => {
    const defaults = [
      'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'JOINED', 'DROPPED', 'REJECTED',
      'INTERESTED', 'INTERESTED AND SCHEDULED',
    ];
    const fromApi = Array.isArray(statusOptions) && statusOptions.length
      ? statusOptions.map(toBlock)
      : defaults;
    return fromApi.map((s) => ({ value: s, label: s }));
  }, [statusOptions]);
  const formClientOptions = useMemo(
    () => masterClients.map((c) => {
      const v = toBlock(c.name);
      return { value: v, label: v };
    }),
    [masterClients],
  );
  const formSourceOptions = useMemo(
    () => masterSources.map((s) => {
      const v = toBlock(s.name);
      return { value: v, label: v };
    }),
    [masterSources],
  );
  const formCountryOptions = useMemo(() => (countryCodes || []).map((c) => {
    const iso = (c.iso || '').toUpperCase();
    return { value: iso || c.code, label: c.code, description: c.name || "", flagIso: iso || undefined, searchText: `${c.name || ""} ${iso} ${c.code || ""}` };
  }), [countryCodes]);

  return {
    showModal, setShowModal, editId, setEditId, formData, setFormData, formErrors, setFormErrors,
    orgCandidateFields, setOrgCandidateFields, fieldRefs, masterPositions, masterClients, masterSources,
    masterCtcBands, masterNoticePeriods, masterProducts, teamMembers, setTeamMembers, formSection, setFormSection,
    stepDirection, stepBanner, setStepBanner, quickList, setQuickList, countryCode, setCountryCode, countryIso, setCountryIso,
    countryCodes, aiScoreLoading, aiScoreResult, jdForScore, setJdForScore, statusOptions,
    isAutoParsing, recentStepChangeRef, showPanRequiredModal, setShowPanRequiredModal, onClientChange,
    resumeConflictModal, setResumeConflictModal, applyResumeMerge,
    fetchMasterData, validateCandidateStep, goCandidateStep, handleEdit, handleAiScore,
    handleInputChange, handleAddCandidate, resolveCountryFromDial, setFormField,
    formPositionOptions, formExperienceOptions, formCtcOptions, formExpectedCtcOptions,
    formNoticeOptions, formProductOptions, formFlsOptions, formStatusOptions, formClientOptions, formSourceOptions, formCountryOptions,
    initialFormState: blankForm,
    openAddCandidate,
    masterDataLoading,
    canEditSpoc,
  };
}
