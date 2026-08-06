import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import BASE_API_URL from '../config';
import { isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import useCountries from '../utils/useCountries';
import { useToast } from './Toast';
import { formatByFieldName } from '../utils/textFormatter';
import { dedupeByName } from '../utils/dedupeMasterData';
import { INITIAL_FORM_STATE } from './addCandidate/addCandidateConstants';
import {
  stripCountryCode,
  validateCandidateForm,
  VALID_EMAIL_DOMAINS,
  VALID_TLDS,
} from './addCandidate/addCandidateHelpers';
import AddCandidateForm from './addCandidate/AddCandidateForm';

const AddCandidatePage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoParsing, setIsAutoParsing] = useState(false);
  const [positions, setPositions] = useState([]);
  const [clients, setClients] = useState([]);
  const [sources, setSources] = useState([]);

  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [countryCode, setCountryCode] = useState('+91');
  const [formErrors, setFormErrors] = useState({});
  const fieldRefs = {
    name: useRef(null),
    email: useRef(null),
    contact: useRef(null),
    companyName: useRef(null),
    ctc: useRef(null),
  };

  const countryCodes = useCountries();

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [positionsRes, clientsRes, sourcesRes] = await Promise.all([
          fetch(`${BASE_API_URL}/api/positions/all`, { credentials: 'include' }),
          fetch(`${BASE_API_URL}/api/clients/all`, { credentials: 'include' }),
          fetch(`${BASE_API_URL}/api/sources/all`, { credentials: 'include' }),
        ]);

        if (positionsRes.ok) {
          setPositions(dedupeByName(await positionsRes.json()));
        }
        if (clientsRes.ok) {
          setClients(dedupeByName(await clientsRes.json()));
        }
        if (sourcesRes.ok) {
          setSources(dedupeByName(await sourcesRes.json()));
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
      (name === 'name' || name === 'spoc' || name === 'location' || name === 'companyName' || name === 'skills' || name === 'remark')
      && value
    ) {
      let v = value.replace(/^\s+/, '');
      v = v.replace(/\s{2,}/g, ' ');
      v = v
        .split(' ')
        .map((word) => {
          if (!word) return '';
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
      finalValue = v;
    }

    if (typeof finalValue === 'string' && name !== 'email') {
      finalValue = finalValue.replace(/\s{2,}/g, ' ');
    }

    if (name === 'resume') {
      const file = files[0];
      setFormData((prev) => ({ ...prev, resume: file }));

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
            setFormData((prev) => ({
              ...prev,
              name: result.name ? formatByFieldName('name', result.name) : prev.name,
              email: result.email
                ? result.email.toLowerCase().replace(/@gnail\.con$/, '@gmail.com').replace(/@gmail\.con$/, '@gmail.com')
                : prev.email,
              contact: result.contact ? stripCountryCode(result.contact) : prev.contact,
            }));
          }
        } catch (error) {
          console.error('Auto-parse error:', error);
        } finally {
          setIsAutoParsing(false);
        }
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: finalValue }));
    }
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
      case 'companyName':
        if (!trimmedValue) {
          setFormErrors((prev) => ({ ...prev, companyName: 'Company is required' }));
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

    ['name', 'spoc', 'location', 'companyName'].forEach((field) => {
      if (trimmed[field]) {
        trimmed[field] = trimmed[field]
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      }
    });

    setFormData((prev) => ({ ...prev, ...trimmed }));

    const errors = validateCandidateForm(trimmed, countryCode);
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
      Object.keys(formData).forEach((key) => {
        if (['statusHistory', '_id', '__v', 'updatedAt'].includes(key)) return;
        if (key === 'resume') {
          if (formData[key] instanceof File) data.append('resume', formData[key]);
        } else {
          data.append(key, formData[key] || '');
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
        setFormData(INITIAL_FORM_STATE);
        navigate('/ats');
      } else {
        const errJson = await response.json();
        toast.error('Error: ' + errJson.message);
      }
    } catch (err) {
      console.error(err);
      toast.error('Server Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFormData(INITIAL_FORM_STATE);
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
            title="Add New Candidate"
            subtitle="Fill in the candidate details below — required fields are marked."
            gradientTitle
          />
        </div>

        <div className="max-w-5xl mx-auto w-full">
          <AddCandidateForm
            formData={formData}
            formErrors={formErrors}
            fieldRefs={fieldRefs}
            countryCode={countryCode}
            setCountryCode={setCountryCode}
            countryCodes={countryCodes}
            positions={positions}
            clients={clients}
            sources={sources}
            isLoading={isLoading}
            isAutoParsing={isAutoParsing}
            handleInputChange={handleInputChange}
            handleBlur={handleBlur}
            handleReset={handleReset}
            handleSubmit={handleSubmit}
            onCancel={() => navigate('/ats')}
          />
        </div>
      </div>
    </>
  );
};

export default AddCandidatePage;
