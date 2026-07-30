import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Upload } from 'lucide-react';
import Layout from './Layout';
import BASE_API_URL from '../config';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import useCountries from '../utils/useCountries';
import { useToast } from './Toast';
import { formatByFieldName } from '../utils/textFormatter';
import { ctcRanges, expectedCtcOptions, noticePeriodOptions } from '../utils/ctcRanges';
import { dedupeByName } from '../utils/dedupeMasterData';

const AddCandidatePage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoParsing, setIsAutoParsing] = useState(false);
  const [positions, setPositions] = useState([]);
  const [clients, setClients] = useState([]);
  const [sources, setSources] = useState([]);

  const initialFormState = {
    srNo: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    position: '',
    fls: '',
    name: '',
    contact: '',
    email: '',
    companyName: '',
    experience: '',
    ctc: '',
    expectedCtc: '',
    noticePeriod: '',
    status: 'Applied',
    client: '',
    spoc: '',
    source: '',
    resume: null,
    callBackDate: '',
    countryCode: '+91',
    skills: '',
    remark: ''
  };

  const [formData, setFormData] = useState(initialFormState);
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

  // Fetch master data on component mount
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const [positionsRes, clientsRes, sourcesRes] = await Promise.all([
          fetch(`${BASE_API_URL}/api/positions/all`, { headers }),
          fetch(`${BASE_API_URL}/api/clients/all`, { headers }),
          fetch(`${BASE_API_URL}/api/sources/all`, { headers })
        ]);

        if (positionsRes.ok) {
          const positionsData = await positionsRes.json();
          setPositions(dedupeByName(positionsData));
        }

        if (clientsRes.ok) {
          const clientsData = await clientsRes.json();
          setClients(dedupeByName(clientsData));
        }

        if (sourcesRes.ok) {
          const sourcesData = await sourcesRes.json();
          setSources(dedupeByName(sourcesData));
        }
      } catch (error) {
        console.error('Error fetching master data:', error);
      }
    };

    fetchMasterData();

    // Load parsed resume data from localStorage if available
    const parsedData = localStorage.getItem('parsedResumeData');
    if (parsedData) {
      try {
        const resumeData = JSON.parse(parsedData);
        setFormData(prev => ({
          ...prev,
          name: resumeData.name || prev.name,
          email: resumeData.email || prev.email,
          contact: resumeData.contact ? stripCountryCode(resumeData.contact) : prev.contact,
          position: resumeData.position || prev.position,
          companyName: resumeData.company || prev.companyName,
          experience: resumeData.experience || prev.experience,
          location: resumeData.location || prev.location,
          skills: resumeData.skills || prev.skills
        }));
        // Clear the localStorage after loading
        localStorage.removeItem('parsedResumeData');
      } catch (error) {
        console.error('Error loading parsed resume data:', error);
      }
    }
  }, []);

  // ✅ HELPER: Validate and fix email
  const validateAndFixEmail = (email) => {
    if (!email) return { isValid: false, value: '' };
    let fixed = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(fixed);
    return { isValid, value: fixed };
  };

  // ✅ HELPER: Validate and fix mobile (country-aware)
  const validateAndFixMobile = (mobile, country) => {
    if (!mobile) return { isValid: false, value: '' };
    let digitsOnly = String(mobile).replace(/\D/g, '');
    
    // Remove country code if accidentally typed in the contact field
    if (digitsOnly.startsWith('91') && digitsOnly.length > 10) {
      digitsOnly = digitsOnly.slice(-10);
    }
    if (digitsOnly.startsWith('1') && digitsOnly.length > 10) {
      digitsOnly = digitsOnly.slice(-10);
    }
    if (digitsOnly.length > 11) {
      digitsOnly = digitsOnly.slice(-10);
    }
    
    // Validate based on selected country
    let isValid = false;
    const len = digitsOnly.length;
    
    if (country === '+91') {
      // India: 10 digits
      isValid = len === 10;
    } else if (country === '+1') {
      // USA/Canada: 10 digits
      isValid = len === 10;
    } else if (country === '+44') {
      // UK: 10-11 digits
      isValid = len >= 10 && len <= 11;
    } else if (country === '+61') {
      // Australia: 9-10 digits
      isValid = len >= 9 && len <= 10;
    } else if (country === '+7') {
      // Russia: 10 digits
      isValid = len === 10;
    } else {
      // Default: at least 9 digits
      isValid = len >= 9;
    }
    
    return { isValid, value: digitsOnly };
  };

  // ✅ HELPER: Validate and fix name
  const validateAndFixName = (name) => {
    if (!name) return { isValid: false, value: '' };
    let fixed = String(name).replace(/[0-9!@#$%^&*()_+=\[\]{};:'",.<>?/\\|`~-]/g, '').trim();
    fixed = fixed.split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    const isValid = fixed.length >= 2 && /^[a-zA-Z\s]+$/.test(fixed);
    return { isValid, value: fixed };
  };

  // ✅ HELPER: Strip country code prefix from phone number
  const stripCountryCode = (phone) => {
    if (!phone) return '';
    let digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length > 10) digits = digits.slice(-10);
    else if (digits.startsWith('1') && digits.length > 10) digits = digits.slice(-10);
    else if (digits.length > 11) digits = digits.slice(-10);
    return digits;
  };

  const handleInputChange = async (e) => {
    const { name, value, files } = e.target;

    // Clear error for the field being edited
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }

    let finalValue = value;

    if (name === 'email' && value) {
      finalValue = value.toLowerCase()
        .replace(/@gnail\.con$/, '@gmail.com')
        .replace(/@gnail\.com$/, '@gmail.com')
        .replace(/@gmail\.con$/, '@gmail.com')
        .replace(/@gmal\.com$/, '@gmail.com');
    } else if ((name === 'name' || name === 'spoc' || name === 'location' || name === 'companyName' || name === 'skills' || name === 'remark') && value) {
      // Remove leading spaces, collapse multiple spaces to one, proper-case each word
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
              name: result.name ? formatByFieldName('name', result.name) : prev.name,
              email: result.email ? (result.email.toLowerCase().replace(/@gnail\.con$/, '@gmail.com').replace(/@gmail\.con$/, '@gmail.com')) : prev.email,
              contact: result.contact ? stripCountryCode(result.contact) : prev.contact
            }));
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

  // ✅ Real-time validation on blur
  const handleBlur = (e) => {
    const { name, value } = e.target;
    const trimmedValue = typeof value === 'string' ? value.trim() : '';

    switch (name) {
      case 'name':
        if (!trimmedValue) {
          setFormErrors(prev => ({ ...prev, name: 'Name is required' }));
        } else if (trimmedValue.length < 2) {
          setFormErrors(prev => ({ ...prev, name: 'Name must be at least 2 characters' }));
        } else if (!/^[a-zA-Z\s.'''\-]+$/.test(trimmedValue)) {
          setFormErrors(prev => ({ ...prev, name: 'Name can only contain letters, spaces, and hyphens' }));
        }
        break;
      case 'email':
        if (!trimmedValue) {
          setFormErrors(prev => ({ ...prev, email: 'Email is required' }));
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedValue)) {
          setFormErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
        } else {
          const domain = trimmedValue.split('@')[1]?.toLowerCase();
          const validDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'yahoo.in', 'rediffmail.com', 'icloud.com', 'protonmail.com', 'zoho.com', 'aol.com', 'live.com', 'msn.com', 'ymail.com', 'mail.com', 'proton.me', 'tutanota.com', 'fastmail.com', 'hey.com', 'pm.me'];
          if (!validDomains.includes(domain)) {
            // For corporate emails: must have proper format (domain name >= 3 chars, valid TLD)
            const domainParts = domain.split('.');
            const tld = domainParts[domainParts.length - 1];
            const domainName = domainParts[0];
            const validTLDs = ['com', 'in', 'org', 'net', 'co', 'io', 'edu', 'gov', 'info', 'biz', 'us', 'uk', 'ca', 'au', 'de', 'fr', 'jp', 'cn', 'tech', 'ai', 'dev'];
            if (domainParts.length < 2 || domainName.length < 3 || !validTLDs.includes(tld)) {
              setFormErrors(prev => ({ ...prev, email: 'Please enter a valid email domain (e.g. gmail.com, outlook.com, company.com)' }));
            }
          }
        }
        break;
      case 'contact':
        if (!trimmedValue) {
          setFormErrors(prev => ({ ...prev, contact: 'Contact number is required' }));
        } else {
          const digits = trimmedValue.replace(/\D/g, '');
          if (countryCode === '+91' && digits.length !== 10) {
            setFormErrors(prev => ({ ...prev, contact: 'Enter a valid 10-digit mobile number' }));
          } else if (countryCode === '+1' && digits.length !== 10) {
            setFormErrors(prev => ({ ...prev, contact: 'Enter a valid 10-digit phone number' }));
          } else if (digits.length < 7 || digits.length > 15) {
            setFormErrors(prev => ({ ...prev, contact: 'Enter a valid phone number' }));
          }
        }
        break;
      case 'companyName':
        if (!trimmedValue) {
          setFormErrors(prev => ({ ...prev, companyName: 'Company is required' }));
        }
        break;
      case 'ctc':
        if (!trimmedValue) {
          setFormErrors(prev => ({ ...prev, ctc: 'Current CTC is required' }));
        }
        break;
      default:
        break;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // --- Auto-trim all string fields + collapse multiple spaces ---
    const trimmed = {};
    Object.keys(formData).forEach(key => {
      if (typeof formData[key] === 'string') {
        trimmed[key] = formData[key].trim().replace(/\s{2,}/g, ' ');
      } else {
        trimmed[key] = formData[key];
      }
    });

    // Auto-capitalize name, spoc, location, companyName before saving
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
    } else if (!/^[a-zA-Z\s.'''-]+$/.test(trimmed.name)) {
      errors.name = 'Name can only contain letters, spaces, and hyphens';
    }

    // 2. Email: required, valid format, valid domain
    if (!trimmed.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed.email)) {
      errors.email = 'Please enter a valid email address';
    } else {
      const domain = trimmed.email.split('@')[1]?.toLowerCase();
      const validDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'yahoo.in', 'rediffmail.com', 'icloud.com', 'protonmail.com', 'zoho.com', 'aol.com', 'live.com', 'msn.com', 'ymail.com', 'mail.com', 'proton.me', 'tutanota.com', 'fastmail.com', 'hey.com', 'pm.me'];
      if (!validDomains.includes(domain)) {
        const domainParts = domain.split('.');
        const tld = domainParts[domainParts.length - 1];
        const domainName = domainParts[0];
        const validTLDs = ['com', 'in', 'org', 'net', 'co', 'io', 'edu', 'gov', 'info', 'biz', 'us', 'uk', 'ca', 'au', 'de', 'fr', 'jp', 'cn', 'tech', 'ai', 'dev'];
        if (domainParts.length < 2 || domainName.length < 3 || !validTLDs.includes(tld)) {
          errors.email = 'Please enter a valid email domain (e.g. gmail.com, outlook.com, company.com)';
        }
      }
    }

    // 3. Contact: required, 10-digit for India
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

    // 4. Company: required
    if (!trimmed.companyName) {
      errors.companyName = 'Company is required';
    }

    // 5. CTC: required
    if (!trimmed.ctc) {
      errors.ctc = 'Current CTC is required';
    }

    // If there are errors, set them, focus the first invalid field, and stop
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
          data.append(key, formData[key] || "");
        }
      });

      const token = localStorage.getItem('token');
      const response = await fetch(`${BASE_API_URL}/candidates`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: data
      });

      if (isUnauthorized(response)) {
        handleUnauthorized();
        return;
      }

      if (response.ok) {
        toast.success('Candidate added successfully!');
        setFormData(initialFormState);
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
    setFormData(initialFormState);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 px-8 py-6">
        {/* Header */}
        <div className="mb-5">
          <button
            onClick={() => navigate('/ats')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-3 transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            Back to All Candidates
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center">
              <Plus size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Add New Candidate</h1>
              <p className="text-xs text-gray-500 mt-0.5">Fill in the candidate details below</p>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="max-w-6xl mx-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            
            {/* Basic Information Section */}
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-4 pb-2.5 border-b border-gray-200">
                📋 Basic Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Name <span className="text-red-500">*</span></label>
                  <input
                    ref={fieldRefs.name}
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="Full Name"
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 transition-all ${formErrors.name ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'}`}
                  />
                  {formErrors.name && <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email <span className="text-red-500">*</span></label>
                  <input
                    ref={fieldRefs.email}
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="email@example.com"
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 transition-all ${formErrors.email ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'}`}
                  />
                  {formErrors.email && <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Contact <span className="text-red-500">*</span></label>
                  <div className={`flex w-full items-stretch border rounded-lg focus-within:ring-2 transition-all bg-white overflow-hidden ${formErrors.contact ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-200 bg-red-50' : 'border-gray-300 focus-within:border-blue-500 focus-within:ring-blue-200'}`}>
                    <select
                      className="px-2.5 py-2 bg-white text-sm font-semibold min-w-[85px] border-r border-gray-300 outline-none"
                      value={countryCode}
                      onChange={(e) => {
                        setCountryCode(e.target.value);
                        setFormData(prev => ({ ...prev, countryCode: e.target.value }));
                      }}
                    >
                      {countryCodes.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                    </select>
                    <input
                      ref={fieldRefs.contact}
                      type="tel"
                      name="contact"
                      value={formData.contact}
                      onChange={(e) => {
                        let digitsOnly = e.target.value.replace(/\D/g, '');
                        if (digitsOnly.length > 10) digitsOnly = digitsOnly.slice(0, 10);
                        setFormData(prev => ({ ...prev, contact: digitsOnly }));
                        if (formErrors.contact) setFormErrors(prev => ({ ...prev, contact: '' }));
                      }}
                      onBlur={handleBlur}
                      placeholder="1234567890"
                      className="flex-1 px-3 py-2 text-sm outline-none"
                      maxLength="10"
                    />
                  </div>
                  {formErrors.contact && <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.contact}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Position</label>
                  <select
                    name="position"
                    value={formData.position}
                    onChange={handleInputChange}
                    data-long-list={positions.length > 8 ? 'true' : undefined}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    <option value="">Select Position</option>
                    {positions.map(pos => (
                      <option key={pos._id} value={pos.name}>{pos.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Company <span className="text-red-500">*</span></label>
                  <input
                    ref={fieldRefs.companyName}
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="Company Name"
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 transition-all ${formErrors.companyName ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'}`}
                  />
                  {formErrors.companyName && <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.companyName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Location</label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="City/Region"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Experience & Compensation Section */}
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-4 pb-2.5 border-b border-gray-200">
                💼 Experience & Compensation
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Experience</label>
                  <select
                    name="experience"
                    value={formData.experience}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    <option value="">Select</option>
                    <option value="Fresher">Fresher</option>
                    {[...Array(31).keys()].slice(1).map(num => (
                      <option key={num} value={num}>{num} {num === 1 ? 'year' : 'years'}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Current CTC (LPA) <span className="text-red-500">*</span></label>
                  <select
                    ref={fieldRefs.ctc}
                    name="ctc"
                    value={formData.ctc}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 transition-all max-h-52 ${formErrors.ctc ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'}`}
                  >
                    <option value="">Select CTC</option>
                    {ctcRanges.map(range => (
                      <option key={range} value={range}>{range}</option>
                    ))}
                  </select>
                  {formErrors.ctc && <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.ctc}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Expected CTC (LPA)</label>
                  <select
                    name="expectedCtc"
                    value={formData.expectedCtc}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all max-h-52"
                  >
                    <option value="">Select Expected CTC</option>
                    {expectedCtcOptions.map(range => (
                      <option key={range} value={range}>{range}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notice Period</label>
                  <select
                    name="noticePeriod"
                    value={formData.noticePeriod}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    <option value="">Select Notice Period</option>
                    {noticePeriodOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">FLS/Non FLS</label>
                  <select
                    name="fls"
                    value={formData.fls}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    <option value="">Select</option>
                    <option value="FLS">FLS</option>
                    <option value="Non-FLS">Non-FLS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    <option value="Applied">Applied</option>
                    <option value="Screening">Screening</option>
                    <option value="Interview">Interview</option>
                    <option value="Offer">Offer</option>
                    <option value="Hired">Hired</option>
                    <option value="Joined">Joined</option>
                    <option value="Dropped">Dropped</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Interested">Interested</option>
                    <option value="Interested and scheduled">Interested and scheduled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Additional Information Section */}
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-4 pb-2.5 border-b border-gray-200">
                📝 Additional Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Client</label>
                  <select
                    name="client"
                    value={formData.client}
                    onChange={handleInputChange}
                    data-long-list={clients.length > 8 ? 'true' : undefined}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    <option value="">Select Client</option>
                    {clients.map(client => (
                      <option key={client._id} value={client.name}>{client.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">SPOC</label>
                  <input
                    type="text"
                    name="spoc"
                    value={formData.spoc}
                    onChange={handleInputChange}
                    placeholder="SPOC Name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Source of CV</label>
                  <select
                    name="source"
                    value={formData.source}
                    onChange={handleInputChange}
                    data-long-list={sources.length > 8 ? 'true' : undefined}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  >
                    <option value="">Select Source</option>
                    {sources.map(source => (
                      <option key={source._id} value={source.name}>{source.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Call Back Date</label>
                  <input
                    type="date"
                    name="callBackDate"
                    value={formData.callBackDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>


              </div>
              <div className="grid grid-cols-1 gap-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Skills (from resume)</label>
                  <textarea
                    name="skills"
                    value={formData.skills}
                    onChange={handleInputChange}
                    placeholder="e.g. Java, React, AWS (from parsed resume)"
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Remark</label>
                  <textarea
                    name="remark"
                    value={formData.remark}
                    onChange={handleInputChange}
                    placeholder="e.g. Rejected due to salary mismatch, Not reachable, etc."
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Resume Upload Section */}
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-4 pb-2.5 border-b border-gray-200">
                📄 Resume (Optional)
              </h2>
              <div className="border border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 text-center hover:bg-gray-100 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  name="resume"
                  onChange={handleInputChange}
                  accept=".pdf,.doc,.docx"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-3">
                  <Upload size={24} className="text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Click to upload resume</p>
                    <p className="text-xs text-gray-500">or drag and drop (PDF, DOC, DOCX)</p>
                  </div>
                  {isAutoParsing && (
                    <div className="flex items-center gap-2 text-blue-600 font-semibold">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      Parsing resume...
                    </div>
                  )}
                  {formData.resume && (
                    <p className="text-sm text-green-600 font-semibold">✅ {formData.resume.name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-all transform hover:scale-105 text-sm"
              >
                🔄 Reset Form
              </button>
              <button
                type="button"
                onClick={() => navigate('/ats')}
                className="flex-1 px-4 py-2.5 bg-gray-400 text-white rounded-lg font-semibold hover:bg-gray-500 transition-all transform hover:scale-105 text-sm"
              >
                ✕ Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || isAutoParsing}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    ✅ Add Candidate
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default AddCandidatePage;
