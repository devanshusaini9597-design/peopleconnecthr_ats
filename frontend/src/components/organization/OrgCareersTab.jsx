import React from 'react';
import { Link as LinkIcon } from 'lucide-react';
import CareerPageBuilderSection from '../CareerPageBuilderSection';
import { BrandToggle } from './constants';

export default function OrgCareersTab({ org, setOrg }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-xl border border-stone-200/90 bg-white shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2.5">
              Public Careers Page
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  org.atsSettings.careersPageEnabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-stone-100 text-stone-500 border-stone-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${org.atsSettings.careersPageEnabled ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                {org.atsSettings.careersPageEnabled ? 'Live' : 'Off'}
              </span>
            </h3>
            <p className="text-sm text-stone-500 mt-1 max-w-xl leading-relaxed">
              Host a branded job board to attract talent directly from your website.
            </p>
          </div>
          <BrandToggle
            checked={org.atsSettings.careersPageEnabled}
            onChange={e => setOrg({ ...org, atsSettings: { ...org.atsSettings, careersPageEnabled: e.target.checked } })}
          />
        </div>
      </div>

      <div className={`space-y-5 transition-opacity duration-300 ${!org.atsSettings.careersPageEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div>
          <label className="label-ats">Page Title</label>
          <input
            type="text"
            value={org.atsSettings.careersPageTitle}
            onChange={e => setOrg({ ...org, atsSettings: { ...org.atsSettings, careersPageTitle: e.target.value } })}
            className="input-ats"
          />
        </div>
        <div>
          <label className="label-ats">Welcome Message / Description</label>
          <textarea
            rows="4"
            value={org.atsSettings.careersPageDescription}
            onChange={e => setOrg({ ...org, atsSettings: { ...org.atsSettings, careersPageDescription: e.target.value } })}
            className="textarea-ats"
            placeholder="Tell candidates why they should join your team..."
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl border border-stone-200 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-center flex-shrink-0">
              <LinkIcon className="w-4 h-4 text-stone-500" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-stone-900">Your public URL</div>
              <div className="text-xs text-brand-600 font-medium truncate">
                https://skillnix.com/careers/{org.domain || 'your-company'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CareerPageBuilderSection />

      <div className="flex items-center justify-between p-4 rounded-xl border border-stone-200 bg-white gap-4">
        <div className="min-w-0 pr-2">
          <h3 className="text-sm font-semibold text-stone-900">Candidate Portal</h3>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">
            Let candidates track application status and update their profile in a branded portal.
          </p>
        </div>
        <BrandToggle
          checked={org.atsSettings.candidatePortalEnabled}
          onChange={e => setOrg({ ...org, atsSettings: { ...org.atsSettings, candidatePortalEnabled: e.target.checked } })}
        />
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl border border-stone-200 bg-white gap-4">
        <div className="min-w-0 pr-2">
          <h3 className="text-sm font-semibold text-stone-900">Portal localization</h3>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">
            Enable multi-locale candidate portal forms (en, es, fr, de, hi). Requires portal.localization.
          </p>
        </div>
        <BrandToggle
          checked={!!org.atsSettings.portalLocalization?.enabled}
          onChange={e => setOrg({
            ...org,
            atsSettings: {
              ...org.atsSettings,
              portalLocalization: {
                ...(org.atsSettings.portalLocalization || {}),
                enabled: e.target.checked,
                defaultLocale: org.atsSettings.portalLocalization?.defaultLocale || 'en',
                supportedLocales: org.atsSettings.portalLocalization?.supportedLocales || ['en', 'es', 'fr', 'de', 'hi']
              }
            }
          })}
        />
      </div>
    </div>
  );
}
