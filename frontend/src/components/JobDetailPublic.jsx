import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Briefcase, Clock, UploadCloud, CheckCircle, AlertCircle, Building, FileText, ChevronRight } from 'lucide-react';
import API_URL from '../config';
import PublicAnnouncementBanner from './PublicAnnouncementBanner';

const JobDetailPublic = () => {
  const { orgSlug, jobId } = useParams();
  const [job, setJob] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const formRef = useRef(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    coverLetter: '',
    source: ''
  });
  const [customResponses, setCustomResponses] = useState({});
  const [applicationForm, setApplicationForm] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const fetchJob = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/careers/${orgSlug}/jobs/${jobId}`);
        if (!res.ok) throw new Error('Job not found or no longer available');
        const data = await res.json();
        setJob(data.job || data.data);
        setOrg(data.organization);
        setApplicationForm(data.applicationForm || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [orgSlug, jobId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setSubmitError('File size exceeds 10MB limit.');
        return;
      }
      setResumeFile(file);
      setSubmitError('');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setSubmitError('File size exceeds 10MB limit.');
        return;
      }
      setResumeFile(file);
      setSubmitError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resumeFile) {
      setSubmitError('Please upload your resume.');
      return;
    }
    
    setIsSubmitting(true);
    setSubmitError('');
    
    try {
      const name = `${formData.firstName} ${formData.lastName}`.trim();
      const res = await fetch(`${API_URL}/api/careers/${orgSlug}/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          coverLetter: formData.coverLetter,
          source: formData.source || 'Careers Page',
          customResponses,
          resume: resumeFile?.name || ''
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Application submission failed');
      }

      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center pt-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-gray-100 max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Job Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'This position may have been filled or removed.'}</p>
          <Link to={`/careers/${orgSlug}`} className="text-indigo-600 hover:text-indigo-800 font-medium">
            &larr; Back to all jobs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 flex flex-col">
      <PublicAnnouncementBanner orgSlug={orgSlug} />
      {/* Header */}
      <header className="bg-gray-50 border-b border-gray-200 py-6 px-4 sm:px-6 lg:px-8 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to={`/careers/${orgSlug}`} className="flex items-center text-gray-600 hover:text-indigo-600 transition-colors font-medium text-sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to careers
          </Link>
          <div className="flex items-center space-x-3">
            {org?.logo ? (
              <img src={org.logo} alt={org.name} className="h-8 w-auto object-contain" />
            ) : (
              <span className="font-bold text-xl text-gray-800">{org?.name}</span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Left Column: Job Details */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">{job.title}</h1>
              
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-8 pb-8 border-b border-gray-100">
                {job.department && (
                  <span className="flex items-center bg-gray-100 px-3 py-1 rounded-full"><Briefcase className="h-4 w-4 mr-2" />{job.department}</span>
                )}
                {job.location && (
                  <span className="flex items-center bg-gray-100 px-3 py-1 rounded-full"><MapPin className="h-4 w-4 mr-2" />{job.location}</span>
                )}
                {job.employmentType && (
                  <span className="flex items-center bg-gray-100 px-3 py-1 rounded-full"><Clock className="h-4 w-4 mr-2" />{job.employmentType}</span>
                )}
              </div>

              <div className="prose prose-indigo max-w-none text-gray-700">
                <div dangerouslySetInnerHTML={{ __html: job.description }} />
              </div>
            </div>

            {job.skills && job.skills.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Required Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((skill, i) => (
                    <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="lg:hidden sticky bottom-4 z-10 pt-4">
               <button onClick={scrollToForm} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-transform active:scale-95">
                 Apply for this position
               </button>
            </div>
          </div>

          {/* Right Column: Application Form */}
          <div className="lg:col-span-1" ref={formRef}>
            <div className="bg-gray-50 rounded-2xl p-6 lg:p-8 border border-gray-200 lg:sticky lg:top-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Apply Now</h3>
              
              {submitSuccess ? (
                <div className="text-center py-8">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                    <CheckCircle className="h-10 w-10 text-green-600" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2">Application Submitted!</h4>
                  <p className="text-gray-600 mb-6">Thank you for applying. We will review your application and get back to you soon.</p>
                  <Link to={`/careers/${orgSlug}`} className="text-indigo-600 font-medium hover:underline">
                    Explore other roles
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                      <input required type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white px-4 py-2 border" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                      <input required type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white px-4 py-2 border" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                    <input required type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white px-4 py-2 border" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white px-4 py-2 border" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resume / CV *</label>
                    <div 
                      onDragOver={handleDragOver} 
                      onDrop={handleDrop}
                      className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl transition-colors ${resumeFile ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white hover:border-indigo-400'}`}
                    >
                      <div className="space-y-1 text-center">
                        {resumeFile ? (
                          <FileText className="mx-auto h-10 w-10 text-indigo-500" />
                        ) : (
                          <UploadCloud className="mx-auto h-10 w-10 text-gray-400" />
                        )}
                        <div className="flex text-sm text-gray-600 justify-center">
                          <label htmlFor="file-upload" className="relative cursor-pointer bg-transparent rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                            <span>{resumeFile ? 'Change file' : 'Upload a file'}</span>
                            <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
                          </label>
                          {!resumeFile && <p className="pl-1">or drag and drop</p>}
                        </div>
                        <p className="text-xs text-gray-500">
                          {resumeFile ? resumeFile.name : 'PDF, DOC, DOCX up to 10MB'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {applicationForm?.fields?.length > 0 && (
                    <div className="space-y-4 pt-2 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900">{applicationForm.title || 'Additional questions'}</h4>
                      {applicationForm.fields.map((field) => {
                        const rule = field.showWhen;
                        if (rule?.fieldKey) {
                          const parentVal = customResponses[rule.fieldKey];
                          if (String(parentVal ?? '') !== String(rule.equals ?? '')) return null;
                        }
                        return (
                        <div key={field.key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {field.label}{field.required ? ' *' : ''}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              required={field.required}
                              rows={3}
                              placeholder={field.placeholder}
                              value={customResponses[field.key] || ''}
                              onChange={(e) => setCustomResponses((prev) => ({ ...prev, [field.key]: e.target.value }))}
                              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white px-4 py-2 border"
                            />
                          ) : field.type === 'select' || field.type === 'yes_no' ? (
                            <select
                              required={field.required}
                              value={customResponses[field.key] || ''}
                              onChange={(e) => setCustomResponses((prev) => ({ ...prev, [field.key]: e.target.value }))}
                              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white px-4 py-2 border"
                            >
                              <option value="">Select…</option>
                              {(field.type === 'yes_no' ? ['Yes', 'No'] : (field.options || [])).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : field.type === 'checkbox' ? (
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={!!customResponses[field.key]}
                                onChange={(e) => setCustomResponses((prev) => ({ ...prev, [field.key]: e.target.checked ? 'Yes' : '' }))}
                              />
                              {field.placeholder || 'Yes'}
                            </label>
                          ) : (
                            <input
                              required={field.required}
                              type={field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                              placeholder={field.placeholder}
                              value={customResponses[field.key] || ''}
                              onChange={(e) => setCustomResponses((prev) => ({ ...prev, [field.key]: e.target.value }))}
                              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white px-4 py-2 border"
                            />
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cover Letter (Optional)</label>
                    <textarea name="coverLetter" rows={4} value={formData.coverLetter} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white px-4 py-2 border"></textarea>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">How did you hear about us?</label>
                    <select name="source" value={formData.source} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white px-4 py-2 border">
                      <option value="">Select an option</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Indeed">Indeed</option>
                      <option value="Company Website">Company Website</option>
                      <option value="Referral">Referral</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {submitError && (
                    <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start">
                      <AlertCircle className="h-5 w-5 mr-2 shrink-0" />
                      {submitError}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>
      </main>
      
      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-500">
          Powered by <a href="/" className="font-semibold text-gray-900 hover:text-indigo-600">People Connect HR</a>
        </div>
      </footer>
    </div>
  );
};

export default JobDetailPublic;
