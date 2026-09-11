import React from 'react';
import { Upload, Info } from 'lucide-react';
import { ctcRanges, expectedCtcOptions, noticePeriodOptions } from '../../utils/ctcRanges';
import { clientRequiresPan, PAN_INFO_TITLE, PAN_INFO_MESSAGE } from '../../utils/panClientRules';

export default function AddCandidateForm({
  formData,
  setFormData,
  formErrors,
  setFormErrors,
  fieldRefs,
  countryCode,
  setCountryCode,
  countryCodes,
  positions,
  clients,
  sources,
  products = [],
  isLoading,
  isAutoParsing,
  handleInputChange,
  handleBlur,
  handleReset,
  handleSubmit,
  onCancel,
  showPanRequiredModal,
  setShowPanRequiredModal,
  isFreelancer = false,
}) {
  return (
    <>
    <form onSubmit={handleSubmit} className="card-ats-bordered p-5 sm:p-8 space-y-8">
            
            {/* Basic Information Section */}
            <div>
              <h2 className="section-title-ats">
                Basic Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="label-ats">Name <span className="text-red-500">*</span></label>
                  <input
                    ref={fieldRefs.name}
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="Full Name"
                    className={`input-ats ${formErrors.name ? 'border-red-400 focus:border-red-500 focus:ring-red-200/60 bg-red-50/70' : 'border-stone-200 focus:border-brand-500 focus:ring-brand-500/20'}`}
                  />
                  {formErrors.name && <p className="field-error">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="label-ats">Email <span className="text-red-500">*</span></label>
                  <input
                    ref={fieldRefs.email}
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="email@example.com"
                    className={`input-ats ${formErrors.email ? 'border-red-400 focus:border-red-500 focus:ring-red-200/60 bg-red-50/70' : 'border-stone-200 focus:border-brand-500 focus:ring-brand-500/20'}`}
                  />
                  {formErrors.email && <p className="field-error">{formErrors.email}</p>}
                </div>

                <div>
                  <label className="label-ats">Contact <span className="text-red-500">*</span></label>
                  <div className={`flex w-full items-stretch border rounded-xl focus-within:ring-2 transition-all bg-white overflow-hidden ${formErrors.contact ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-200 bg-red-50' : 'border-stone-200 focus-within:border-brand-500 focus-within:ring-brand-500/20'}`}>
                    <select
                      className="px-2.5 py-2.5 bg-stone-50 text-sm font-semibold min-w-[85px] border-r border-stone-200 outline-none"
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
                  {formErrors.contact && <p className="field-error">{formErrors.contact}</p>}
                </div>

                <div>
                  <label className="label-ats">Position</label>
                  <select
                    name="position"
                    value={formData.position}
                    onChange={handleInputChange}
                    data-long-list={positions.length > 8 ? 'true' : undefined}
                    className="input-ats"
                  >
                    <option value="">Select Position</option>
                    {positions.map(pos => (
                      <option key={pos._id} value={pos.name}>{pos.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-ats">Company</label>
                  <input
                    ref={fieldRefs.companyName}
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="Company Name"
                    className={`input-ats ${formErrors.companyName ? 'border-red-400 focus:border-red-500 focus:ring-red-200/60 bg-red-50/70' : 'border-stone-200 focus:border-brand-500 focus:ring-brand-500/20'}`}
                  />
                  {formErrors.companyName && <p className="field-error">{formErrors.companyName}</p>}
                </div>

                <div>
                  <label className="label-ats">Location</label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="City/Region"
                    className="input-ats"
                  />
                </div>
              </div>
            </div>

            {/* Experience & Compensation Section */}
            <div>
              <h2 className="section-title-ats">
                Experience & Compensation
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="label-ats">Experience</label>
                  <select
                    name="experience"
                    value={formData.experience}
                    onChange={handleInputChange}
                    className="input-ats"
                  >
                    <option value="">SELECT</option>
                    <option value="FRESHER">FRESHER</option>
                    {[...Array(31).keys()].slice(1).map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-ats">Current CTC (LPA) <span className="text-red-500">*</span></label>
                  <select
                    ref={fieldRefs.ctc}
                    name="ctc"
                    value={formData.ctc}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`input-ats max-h-52 ${formErrors.ctc ? 'border-red-400 focus:border-red-500 focus:ring-red-200/60 bg-red-50/70' : 'border-stone-200 focus:border-brand-500 focus:ring-brand-500/20'}`}
                  >
                    <option value="">Select CTC</option>
                    {ctcRanges.map(range => (
                      <option key={range} value={range}>{range}</option>
                    ))}
                  </select>
                  {formErrors.ctc && <p className="field-error">{formErrors.ctc}</p>}
                </div>

                <div>
                  <label className="label-ats">Expected CTC (LPA)</label>
                  <select
                    name="expectedCtc"
                    value={formData.expectedCtc}
                    onChange={handleInputChange}
                    className="input-ats max-h-52"
                  >
                    <option value="">Select Expected CTC</option>
                    {expectedCtcOptions.map(range => (
                      <option key={range} value={range}>{range}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-ats">Notice Period</label>
                  <select
                    name="noticePeriod"
                    value={formData.noticePeriod}
                    onChange={handleInputChange}
                    className="input-ats"
                  >
                    <option value="">Select Notice Period</option>
                    {noticePeriodOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-ats">FLS/Non FLS</label>
                  <select
                    name="fls"
                    value={formData.fls}
                    onChange={handleInputChange}
                    className="input-ats"
                  >
                    <option value="">SELECT</option>
                    <option value="FLS">FLS</option>
                    <option value="NON-FLS">NON-FLS</option>
                  </select>
                </div>

                <div>
                  <label className="label-ats">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="input-ats"
                  >
                    <option value="APPLIED">APPLIED</option>
                    <option value="SCREENING">SCREENING</option>
                    <option value="INTERVIEW">INTERVIEW</option>
                    <option value="OFFER">OFFER</option>
                    <option value="HIRED">HIRED</option>
                    <option value="JOINED">JOINED</option>
                    <option value="DROPPED">DROPPED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="INTERESTED">INTERESTED</option>
                    <option value="INTERESTED AND SCHEDULED">INTERESTED AND SCHEDULED</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Additional Information Section */}
            <div>
              <h2 className="section-title-ats">
                Additional Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="label-ats">Client</label>
                  <select
                    name="client"
                    value={formData.client}
                    onChange={handleInputChange}
                    data-long-list={clients.length > 8 ? 'true' : undefined}
                    className="input-ats"
                  >
                    <option value="">Select Client</option>
                    {clients.map(client => (
                      <option key={client._id} value={client.name}>{client.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-ats">
                    PAN No.{clientRequiresPan(formData.client, clients) ? <span className="text-red-500"> *</span> : null}
                  </label>
                  <input
                    ref={fieldRefs.pan}
                    type="text"
                    name="pan"
                    value={formData.pan || ''}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    className={`input-ats tracking-wider ${formErrors.pan ? 'border-red-400 focus:border-red-500 focus:ring-red-200/60 bg-red-50/70' : ''}`}
                    autoComplete="off"
                  />
                  {formErrors.pan && <p className="field-error">{formErrors.pan}</p>}
                  {!formErrors.pan && clientRequiresPan(formData.client, clients) && (
                    <p className="text-xs text-amber-700 mt-1 font-medium">Required for this client</p>
                  )}
                </div>

                <div>
                  <label className="label-ats">Product / Skill</label>
                  <select
                    ref={fieldRefs.product}
                    name="product"
                    value={formData.product || ''}
                    onChange={handleInputChange}
                    data-long-list={products.length > 8 ? 'true' : undefined}
                    className="input-ats"
                  >
                    <option value="">Select Product / Skill</option>
                    {products.map((p) => (
                      <option key={p._id || p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-ats">SPOC</label>
                  <input
                    type="text"
                    name="spoc"
                    value={formData.spoc}
                    onChange={handleInputChange}
                    placeholder="SPOC Name"
                    className="input-ats"
                  />
                </div>

                <div>
                  <label className="label-ats">Source of CV</label>
                  {isFreelancer ? (
                    <>
                      <div className="input-ats bg-stone-50 text-stone-700 font-semibold flex items-center">Freelance</div>
                      <p className="text-[11px] text-stone-400 mt-1">Locked — always Freelance for freelancer desks.</p>
                    </>
                  ) : (
                    <select
                      name="source"
                      value={formData.source}
                      onChange={handleInputChange}
                      data-long-list={sources.length > 8 ? 'true' : undefined}
                      className="input-ats"
                    >
                      <option value="">Select Source</option>
                      {sources.map(source => (
                        <option key={source._id} value={source.name}>{source.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="label-ats">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="input-ats"
                  />
                </div>

                <div>
                  <label className="label-ats">Call Back Date</label>
                  <input
                    type="date"
                    name="callBackDate"
                    value={formData.callBackDate}
                    onChange={handleInputChange}
                    className="input-ats"
                  />
                </div>


              </div>
              <div className="grid grid-cols-1 gap-4 mt-4">
                <div>
                  <label className="label-ats">Skills (from resume)</label>
                  <textarea
                    name="skills"
                    value={formData.skills}
                    onChange={handleInputChange}
                    placeholder="e.g. Java, React, AWS (from parsed resume)"
                    rows="2"
                    className="input-ats resize-none"
                  />
                </div>
                <div>
                  <label className="label-ats">Remark</label>
                  <textarea
                    name="remark"
                    value={formData.remark}
                    onChange={handleInputChange}
                    placeholder="e.g. Rejected due to salary mismatch, Not reachable, etc."
                    rows="2"
                    className="input-ats resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Resume Upload Section */}
            <div>
              <h2 className="section-title-ats">
                {isFreelancer ? 'Resume (Required)' : 'Resume (Optional)'}
              </h2>
              <div
                ref={fieldRefs.resume}
                className={`dropzone-ats p-8 ${formErrors.resume ? 'ring-2 ring-red-200 border-red-300' : ''}`}
              >
                <input
                  type="file"
                  name="resume"
                  onChange={handleInputChange}
                  accept=".pdf,.doc,.docx"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-3">
                  <Upload size={24} className="text-stone-500" />
                  <div>
                    <p className="text-sm font-semibold text-stone-700">
                      {isFreelancer ? 'Click to upload CV (mandatory)' : 'Click to upload resume'}
                    </p>
                    <p className="text-xs text-stone-500">or drag and drop (PDF, DOC, DOCX)</p>
                  </div>
                  {isAutoParsing && (
                    <div className="flex items-center gap-2 text-brand-600 font-semibold">
                      <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                      Parsing resume...
                    </div>
                  )}
                  {formData.resume && (
                    <p className="text-sm text-emerald-600 font-semibold">{formData.resume.name}</p>
                  )}
                  {formErrors.resume && (
                    <p className="text-sm text-red-600 font-semibold">{formErrors.resume}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-stone-100">
              <button
                type="button"
                onClick={handleReset}
                className="btn-secondary flex-1"
              >
                Reset Form
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="btn-ghost flex-1 !bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || isAutoParsing}
                className="btn-primary flex-1"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    Add Candidate
                  </>
                )}
              </button>
            </div>
          </form>
          {showPanRequiredModal && (
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-900/55 backdrop-blur-sm p-4"
              onClick={() => setShowPanRequiredModal?.(false)}
              role="presentation"
            >
              <div
                className="bg-white rounded-2xl border border-stone-200/60 shadow-2xl w-full max-w-md p-5 sm:p-6"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center flex-shrink-0">
                    <Info size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900 tracking-tight">{PAN_INFO_TITLE}</h3>
                    <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">{PAN_INFO_MESSAGE}</p>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    className="btn-primary min-w-[100px]"
                    onClick={() => {
                      setShowPanRequiredModal?.(false);
                      setTimeout(() => fieldRefs.pan?.current?.focus?.(), 40);
                    }}
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
  );
}
