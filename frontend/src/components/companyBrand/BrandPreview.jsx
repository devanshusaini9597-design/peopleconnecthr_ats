import React from 'react';

export default function BrandPreview({ brandColor, careersPageTitle, careersPageDescription, companyBrand }) {
  const benefits = (companyBrand.benefits || []).filter((b) => b.title?.trim());
  const team = (companyBrand.teamMembers || []).filter((m) => m.name?.trim());
  return (
    <div className="rounded-2xl border border-stone-200/90 bg-gradient-to-b from-stone-50 to-white overflow-hidden shadow-[0_1px_0_rgba(28,25,23,0.04)]">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-stone-100 bg-white/80">
        <span className="w-2 h-2 rounded-full bg-stone-300" />
        <span className="w-2 h-2 rounded-full bg-stone-300" />
        <span className="w-2 h-2 rounded-full bg-stone-300" />
        <span className="ml-2 flex-1 truncate rounded-md bg-stone-100 px-2 py-1 text-[10px] text-stone-400 font-medium">
          careers · brand preview
        </span>
      </div>
      <div
        className="px-4 py-5 text-white"
        style={{ background: `linear-gradient(135deg, ${brandColor || '#0d9488'}, ${brandColor || '#0d9488'}cc)` }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">Careers</p>
        <p className="text-base font-bold tracking-tight mt-1 leading-snug">
          {careersPageTitle?.trim() || 'Join our team'}
        </p>
        {companyBrand.tagline?.trim() ? (
          <p className="text-xs text-white/90 mt-1.5 leading-relaxed">{companyBrand.tagline}</p>
        ) : null}
        {careersPageDescription?.trim() ? (
          <p className="text-[11px] text-white/75 mt-2 leading-relaxed line-clamp-3">
            {careersPageDescription}
          </p>
        ) : null}
      </div>
      <div className="p-4 space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-2">Benefits</p>
          {benefits.length === 0 ? (
            <p className="text-xs text-stone-400">Add benefits to preview them here.</p>
          ) : (
            <ul className="space-y-2">
              {benefits.slice(0, 4).map((b, i) => (
                <li key={i} className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2">
                  <p className="text-xs font-semibold text-stone-800">{b.title}</p>
                  {b.description ? (
                    <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-2">{b.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-2">Team</p>
          {team.length === 0 ? (
            <p className="text-xs text-stone-400">Add team members to preview them here.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {team.slice(0, 6).map((m, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-100 bg-white px-2.5 py-1.5"
                >
                  <span
                    className="w-7 h-7 rounded-lg text-white text-[10px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: brandColor || '#0d9488' }}
                  >
                    {String(m.name).trim().slice(0, 1).toUpperCase() || '?'}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold text-stone-800 truncate max-w-[7rem]">
                      {m.name}
                    </span>
                    {m.role ? (
                      <span className="block text-[10px] text-stone-400 truncate max-w-[7rem]">{m.role}</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
