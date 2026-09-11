import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import BASE_API_URL from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized, planLimitErrorMessage } from '../utils/fetchUtils';
import useCountries from '../utils/useCountries';
import { useToast } from './Toast';
import { formatByFieldName } from '../utils/textFormatter';
import { dedupeByName } from '../utils/dedupeMasterData';
import { blankCandidateForm } from './addCandidate/addCandidateConstants';
import {
  stripCountryCode,
  validateCandidateForm,
  VALID_EMAIL_DOMAINS,
  VALID_TLDS,
} from './addCandidate/addCandidateHelpers';
import AddCandidateForm from './addCandidate/AddCandidateForm';
import { clientRequiresPan, normalizePan, validatePan } from '../utils/panClientRules';
import {
  resumeIdentityConflicts,
  mergeResumeIntoForm,
} from '../utils/resumeFormMerge';
import ConfirmationModal from './ConfirmationModal';
import { useAuth } from '../context/AuthContext';

const AddCandidatePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isFreelancer = user?.role === 'freelancer';
  const blankForm = () => blankCandidateForm(user?.role);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoParsing, setIsAutoParsing] = useState(false);
  const [positions, setPositions] = useState([]);
  const [clients, setClients] = useState([]);
  const [sources, setSources] = useState([]);
  const [products, setProducts] = useState([]);
  const [showPanRequiredModal, setShowPanRequiredModal] = useState(false);
  const [resumeConflictModal, setResumeConflictModal] = useState({ isOpen: false, result: null });

  const [formData, setFormData] = useState(() => blankCandidateForm(user?.role));
  const [countryCode, setCountryCode] = useState('+91');
  const [formErrors, setFormErrors] = useState({});
  const fieldRefs = {
    name: useRef(null),
    email: useRef(null),
    contact: useRef(null),
    companyName: useRef(null),
    ctc: useRef(null),
    pan: useRef(null),
    product: useRef(null),
    resume: useRef(null),
  };

  const countryCodes = useCountries();

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [positionsRes, clientsRes, sourcesRes, productsRes] = await Promise.all([
          fetch(`${BASE_API_URL}/api/positions/all`, { credentials: 'include' }),
          fetch(`${BASE_API_URL}/api/clients/all`, { credentials: 'include' }),
          fetch(`${BASE_API_URL}/api/sources/all`, { credentials: 'include' }),
          fetch(`${BASE_API_URL}/api/org-lists/product/all`, { credentials: 'include' }),
        ]);

        if (positionsRes.ok) {
          setPositions(dedupeByName(await positionsRes.json()));
        }
        if (clientsRes.ok) {
          setClients(dedupeByName(await clientsRes.json()));
        }
        if (sourcesRes.ok) {
          const list = dedupeByName(await sourcesRes.json());
          if (isFreelancer && !list.some((s) => String(s.name).toLowerCase() === 'freelance')) {
            list.unshift({ name: 'Freelance' });
          }
          setSources(list);
        }
        if (productsRes.ok) {
          const product = await productsRes.json();
          setProducts(Array.isArray(product) ? dedupeByName(product) : []);
        }
      } catch (error) {
        console.error('Error fetching master data:', error);
      }
    };
    fetchMasterData();
  }, []);

  useEffect(() => {
    const parsedData = localStorage.getItem('parsedResumeData');
    if (parsedData) {
      try {
        const resumeData = JSON.parse(parsedData);
        setFormData((prev) => ({
          ...prev,
          name: resumeData.name ? formatByFieldName('name', resumeData.name) : prev.name,
          email: resumeData.email
            ? resumeData.email.toLowerCase().replace(/@gnail\.con$/, '@gmail.com').replace(/@gmail\.con$/, '@gmail.com')
            : prev.email,
          contact: resumeData.contact ? stripCountryCode(resumeData.contact) : prev.contact,
          position: resumeData.position || prev.position,
          companyName: resumeData.company || prev.companyName,
          experience: resumeData.experience || prev.experience,
          location: resumeData.location || prev.location,
          skills: resumeData.skills || prev.skills,
        }));
        localStorage.removeItem('parsedResumeData');
      } catch (error) {
        console.error('Error loading parsed resume data:', error);
      }
    }
  }, []);

  const handleInputChange = async (e) => {
    const { name, value, files } = e.target;

    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }

    let finalValue = value;

    if (name === 'email' && value) {
      finalValue = value
        .toLowerCase()
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
      let v = value.replace(/^\s+/, '');
      v = v.replace(/\s{2,}/g, ' ');
      finalValue = v.toUpperCase();
    } else if (name === 'pan') {
      finalValue = normalizePan(value).slice(0, 10);
    }

    if (typeof finalValue === 'string' && name !== 'email') {
      finalValue = finalValue.replace(/\s{2,}/g, ' ');
    }

    if (name === 'resume') {
      const file = files[0];
      setFormData((prev) => ({ ...prev, resume: file }));
      setFormErrors((prev) => {
        if (!prev.resume) return prev;
        const next = { ...prev };
        delete next.resume;
        return next;
      });

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
            const conflict = resumeIdentityConflicts(formData, result);
            if (conflict) {
              setResumeConflictModal({ isOpen: true, result });
              return;
            }

            setFormData((prev) => mergeResumeIntoForm(prev, result, 'empty-only', {
              formatName: (s) => formatByFieldName('name', s),
              stripContact: (s) => stripCountryCode(s),
            }));
            toast.success('Resume read — empty fields filled where possible');
          } else {
            const err = await response.json().catch(() => ({}));
            toast.warning(err.details || err.error || 'Could not auto-read this resume');
          }
        } catch (error) {
          console.error('Auto-parse error:', error);
          toast.warning('Resume uploaded, but auto-read failed');
        } finally {
          setIsAutoParsing(false);
        }
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: finalValue }));
      if (name === 'client') {
        const needsPan = clientRequiresPan(finalValue, clients);
        const panErr = validatePan(formData.pan, { required: needsPan });
        setFormErrors((prev) => ({ ...prev, client: '', pan: panErr }));
        if (needsPan && !normalizePan(formData.pan)) {
          setShowPanRequiredModal(true);
        }
      } else if (name === 'pan') {
        const panErr = validatePan(finalValue, {
          required: clientRequiresPan(formData.client, clients),
        });
        setFormErrors((prev) => ({ ...prev, pan: panErr }));
      }
    }
  };

  const applyResumeMerge = (mode) => {
    const result = resumeConflictModal.result;
    setResumeConflictModal({ isOpen: false, result: null });
    if (!result) return;
    setFormData((prev) => mergeResumeIntoForm(prev, result, mode, {
      formatName: (s) => formatByFieldName('name', s),
      stripContact: (s) => stripCountryCode(s),
    }));
    toast.success(
      mode === 'replace'
        ? 'Resume applied — form fields replaced'
        : 'Kept your typed details — empty fields filled only'
    );
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const trimmedValue = typeof value === 'string' ? value.trim() : '';

    switch (name) {
      case 'name':
        if (!trimmedValue) {
          setFormErrors((prev) => ({ ...prev, name: 'Name is required' }));
        } else if (trimmedValue.length < 2) {
          setFormErrors((prev) => ({ ...prev, name: 'Name must be at least 2 characters' }));
        } else if (!/^[a-zA-Z\s.'''\-]+$/.test(trimmedValue)) {
          setFormErrors((prev) => ({ ...prev, name: 'Name can only contain letters, spaces, and hyphens' }));
        }
        break;
      case 'email':
        if (!trimmedValue) {
          setFormErrors((prev) => ({ ...prev, email: 'Email is required' }));
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedValue)) {
          setFormErrors((prev) => ({ ...prev, email: 'Please enter a valid email address' }));
        } else {
          const domain = trimmedValue.split('@')[1]?.toLowerCase();
          if (!VALID_EMAIL_DOMAINS.includes(domain)) {
            const domainParts = domain.split('.');
            const tld = domainParts[domainParts.length - 1];
            const domainName = domainParts[0];
            if (domainParts.length < 2 || domainName.length < 3 || !VALID_TLDS.includes(tld)) {
              setFormErrors((prev) => ({
                ...prev,
                email: 'Please enter a valid email domain (e.g. gmail.com, outlook.com, company.com)',
              }));
            }
          }
        }
        break;
      case 'contact':
        if (!trimmedValue) {
          setFormErrors((prev) => ({ ...prev, contact: 'Contact number is required' }));
        } else {
          const digits = trimmedValue.replace(/\D/g, '');
          if (countryCode === '+91' && digits.length !== 10) {
            setFormErrors((prev) => ({ ...prev, contact: 'Enter a valid 10-digit mobile number' }));
          } else if (countryCode === '+1' && digits.length !== 10) {
            setFormErrors((prev) => ({ ...prev, contact: 'Enter a valid 10-digit phone number' }));
          } else if (digits.length < 7 || digits.length > 15) {
            setFormErrors((prev) => ({ ...prev, contact: 'Enter a valid phone number' }));
          }
        }
        break;
      case 'ctc':
        if (!trimmedValue) {
          setFormErrors((prev) => ({ ...prev, ctc: 'Current CTC is required' }));
        }
        break;
      default:
        break;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmed = {};
    Object.keys(formData).forEach((key) => {
      if (typeof formData[key] === 'string') {
        trimmed[key] = formData[key].trim().replace(/\s{2,}/g, ' ');
      } else {
        trimmed[key] = formData[key];
      }
    });

    ['name', 'spoc', 'location', 'companyName', 'remark', 'position', 'client', 'source', 'ctc', 'expectedCtc', 'noticePeriod', 'status', 'experience', 'fls', 'feedback', 'skills', 'company', 'product'].forEach((field) => {
      if (trimmed[field]) {
        trimmed[field] = trimmed[field].replace(/\s{2,}/g, ' ').toUpperCase();
      }
    });
    if (trimmed.pan) trimmed.pan = normalizePan(trimmed.pan);

    setFormData((prev) => ({ ...prev, ...trimmed }));

    const errors = validateCandidateForm(trimmed, countryCode, clients, {
      requireResume: isFreelancer,
    });
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const firstErrorField = Object.keys(errors)[0];
      if (fieldRefs[firstErrorField]?.current) {
        fieldRefs[firstErrorField].current.focus();
        fieldRefs[firstErrorField].current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      toast.warning(errors[Object.keys(errors)[0]]);
      return;
    }

    setFormErrors({});

    try {
      setIsLoading(true);

      const data = new FormData();
      Object.keys(trimmed).forEach((key) => {
        if (['statusHistory', '_id', '__v', 'updatedAt'].includes(key)) return;
        if (key === 'resume') {
          if (trimmed[key] instanceof File) data.append('resume', trimmed[key]);
        } else {
          data.append(key, trimmed[key] || '');
        }
      });

      const response = await fetch(`${BASE_API_URL}/candidates`, {
        method: 'POST',
        credentials: 'include',
        body: data,
      });

      if (isUnauthorized(response)) {
        handleUnauthorized();
        return;
      }

      if (response.ok) {
        toast.success('Candidate added successfully!');
        setFormData(blankForm());
        navigate('/ats');
      } else {
        const errJson = await response.json().catch(() => ({}));
        toast.error(planLimitErrorMessage(errJson, 'candidates'));
      }
    } catch (err) {
      console.error(err);
      toast.error('Server Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFormData(blankForm());
  };

  return (
    <>
      <div className="page-shell-ats">
        <div className="mb-5">
          <button
            onClick={() => navigate('/ats')}
            className="flex items-center gap-2 text-brand-600 hover:text-brand-700 font-semibold mb-4 transition-colors text-sm group"
          >
            <ArrowLeft size={16} />
            Back to All Candidates
          </button>

          <PageHeader
            icon={UserPlus}
            title={t('candidates.addNew')}
            subtitle={t('candidates.addSubtitle')}
            gradientTitle
          />
        </div>

        <div className="max-w-5xl mx-auto w-full">
          <AddCandidateForm
            formData={formData}
            setFormData={setFormData}
            formErrors={formErrors}
            setFormErrors={setFormErrors}
            fieldRefs={fieldRefs}
            countryCode={countryCode}
            setCountryCode={setCountryCode}
            countryCodes={countryCodes}
            positions={positions}
            clients={clients}
            sources={sources}
            products={products}
            isLoading={isLoading}
            isAutoParsing={isAutoParsing}
            handleInputChange={handleInputChange}
            handleBlur={handleBlur}
            handleReset={handleReset}
            handleSubmit={handleSubmit}
            onCancel={() => navigate('/ats')}
            showPanRequiredModal={showPanRequiredModal}
            setShowPanRequiredModal={setShowPanRequiredModal}
            isFreelancer={isFreelancer}
          />
        </div>
      </div>

      <ConfirmationModal
        isOpen={Boolean(resumeConflictModal.isOpen)}
        onClose={() => applyResumeMerge('empty-only')}
        onConfirm={() => applyResumeMerge('replace')}
        type="warning"
        eyebrow="Resume upload"
        title="Different person detected"
        message={
          resumeConflictModal.result?.name || resumeConflictModal.result?.email
            ? `This resume looks like ${resumeConflictModal.result.name || resumeConflictModal.result.email}, which doesn’t match the details already in the form.`
            : 'This resume doesn’t match the details already in the form.'
        }
        details="Replace updates name, email, phone, and other resume fields. Keep mine only fills empty fields and leaves your typed values."
        confirmText="Replace with resume"
        cancelText="Keep my details"
        zClass="z-[320]"
      />
    </>
  );
};

export default AddCandidatePage;
