import React from 'react';
import { Upload } from 'lucide-react';
import { ctcRanges, expectedCtcOptions, noticePeriodOptions } from '../../utils/ctcRanges';

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
  isLoading,
  isAutoParsing,
  handleInputChange,
  handleBlur,
  handleReset,
  handleSubmit,
  onCancel,
}) {
  return (
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
                  <label className="label-ats">Company <span className="text-red-500">*</span></label>
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
                    <option value="">Select</option>
                    <option value="Fresher">Fresher</option>
                    {[...Array(31).keys()].slice(1).map(num => (
                      <option key={num} value={num}>{num} {num === 1 ? 'year' : 'years'}</option>
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
                    <option value="">Select</option>
                    <option value="FLS">FLS</option>
                    <option value="Non-FLS">Non-FLS</option>
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
                Resume (Optional)
              </h2>
              <div className="dropzone-ats p-8">
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
                    <p className="text-sm font-semibold text-stone-700">Click to upload resume</p>
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
  );
}
