import React from 'react';
import { Building2, Globe, MapPin, Calendar, Upload } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import {
  COUNTRY_CURRENCY_OPTIONS,
  detectBrowserTimezone,
  currencyForCountry,
} from '../../data/locales';
import { dateFormatSelectOptions, buildTimezoneOptions } from './constants';

export default function OrgGeneralTab({
  org,
  setOrg,
  logoInputRef,
  processLogoFile,
  logoDragging,
  setLogoDragging,
  handleLogoDrop,
  applyDetectedTimezone,
  detectedTz,
}) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h3 className="section-title-ats">
          <Building2 className="w-4 h-4 text-brand-600" />
          Company identity
        </h3>
        <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
          <div className="space-y-4">
            <div>
              <label className="label-ats">Company Name</label>
              <input
                type="text"
                value={org.name}
                onChange={e => setOrg({ ...org, name: e.target.value })}
                className="input-ats"
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <label className="label-ats">Company Domain</label>
              <input
                type="text"
                value={org.domain}
                onChange={e => setOrg({ ...org, domain: e.target.value })}
                className="input-ats"
                placeholder="acme.com"
              />
            </div>
          </div>

          <div>
            <label className="label-ats">Company Logo</label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/svg+xml,image/png,image/jpeg,image/gif,image/webp,.svg,.png,.jpg,.jpeg,.gif,.webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processLogoFile(file);
                e.target.value = '';
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => logoInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  logoInputRef.current?.click();
                }
              }}
              onDragEnter={(e) => { e.preventDefault(); setLogoDragging(true); }}
              onDragOver={(e) => { e.preventDefault(); setLogoDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setLogoDragging(false); }}
              onDrop={handleLogoDrop}
              className={`dropzone-ats flex flex-col items-center justify-center text-center p-6 cursor-pointer group min-h-[168px] ${
                logoDragging ? 'border-brand-500 bg-brand-50/60' : ''
              }`}
            >
              {org.logo ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <img
                    src={org.logo}
                    alt="Company logo"
                    className="max-h-20 max-w-full object-contain rounded-xl border border-stone-200 bg-white p-2 shadow-sm"
                  />
                  <p className="text-sm font-semibold text-stone-700">Click or drop to replace</p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-red-600 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOrg((prev) => ({ ...prev, logo: '' }));
                    }}
                  >
                    Remove logo
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border border-brand-100">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-stone-700">Click to upload or drag & drop</p>
                  <p className="text-xs text-stone-500 mt-1">SVG, PNG, JPG or GIF (max. 2MB)</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="section-title-ats">
          <Globe className="w-4 h-4 text-brand-600" />
          Locale & formats
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="label-ats !mb-0">Timezone</label>
              <button
                type="button"
                onClick={applyDetectedTimezone}
                className="text-[11px] font-bold text-brand-600 hover:text-brand-700 whitespace-nowrap"
              >
                Use my timezone
              </button>
            </div>
            <PremiumSelect
              value={org.timezone}
              onChange={(v) => setOrg({ ...org, timezone: v || detectBrowserTimezone() })}
              options={buildTimezoneOptions(detectedTz)}
              placeholder="Select timezone"
              icon={MapPin}
              searchable
              searchPlaceholder="Search timezones…"
            />
            <p className="text-[11px] text-stone-400 mt-1.5 font-medium truncate">
              Detected: {detectedTz}
            </p>
          </div>
          <div className="min-w-0">
            <label className="label-ats">Country / Currency</label>
            <PremiumSelect
              value={org.country}
              onChange={(countryCode) => {
                const code = countryCode || 'US';
                setOrg({
                  ...org,
                  country: code,
                  currency: currencyForCountry(code),
                });
              }}
              options={COUNTRY_CURRENCY_OPTIONS}
              placeholder="Select country"
              searchable
              searchPlaceholder="Search countries…"
            />
            <p className="text-[11px] text-stone-400 mt-1.5 font-medium">
              Currency: <span className="text-stone-600 font-semibold">{org.currency}</span>
            </p>
          </div>
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <label className="label-ats">Date Format</label>
            <PremiumSelect
              value={org.dateFormat}
              onChange={(v) => setOrg({ ...org, dateFormat: v || 'MM/DD/YYYY' })}
              options={dateFormatSelectOptions}
              placeholder="Select format"
              icon={Calendar}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
