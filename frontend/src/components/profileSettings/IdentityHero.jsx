import React from 'react';
import { Mail, Phone, Loader2, Calendar, Database, Camera, Trash2, Save, BadgeCheck, Building2, Clock3 } from 'lucide-react';
import { resolveOrgLogoSrc } from '../../utils/orgLogo';
import { formatRoleLabel } from '../organization/constants';
import { formatProfileDate, formatProfileDateTime } from './profileConstants';

export default function IdentityHero({
  profile,
  initials,
  userRole,
  organizationName,
  profilePicture,
  pendingPhotoPreview,
  isUploadingPic,
  profilePicRef,
  stats,
  onUpload,
  onSavePhoto,
  onCancelPhoto,
  onRemovePhoto,
}) {
  const photoSrc = pendingPhotoPreview || resolveOrgLogoSrc(profilePicture);
  const joined = formatProfileDate(stats.memberSince || profile.createdAt);
  const lastSeen = formatProfileDateTime(stats.lastLoginAt || profile.lastLoginAt);
  const verified = stats.isEmailVerified ?? profile.isEmailVerified;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,118,110,0.18)]">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-600 via-teal-400 to-brand-500" />
      <div className="absolute inset-0 bg-[radial-gradient(1200px_280px_at_0%_-20%,rgba(13,148,136,0.08),transparent_55%)] pointer-events-none" />

      <div className="relative px-5 sm:px-7 pt-6 pb-5 sm:pt-7 sm:pb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="relative group self-start">
            {photoSrc ? (
              <img
                src={photoSrc}
                alt={profile.name || 'Profile'}
                className="h-[88px] w-[88px] sm:h-24 sm:w-24 rounded-2xl object-cover ring-2 ring-white shadow-md"
              />
            ) : (
              <div className="h-[88px] w-[88px] sm:h-24 sm:w-24 rounded-2xl bg-gradient-to-br from-brand-600 to-teal-600 text-white flex items-center justify-center font-bold text-2xl sm:text-3xl shadow-md ring-2 ring-white">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => profilePicRef.current?.click()}
              disabled={isUploadingPic}
              className="absolute -bottom-1.5 -right-1.5 h-8 w-8 bg-white text-brand-700 rounded-lg flex items-center justify-center shadow-md border border-stone-200 hover:bg-brand-50 transition-colors"
              title="Change photo"
              aria-label="Change photo"
            >
              {isUploadingPic ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
            <input ref={profilePicRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
            {!pendingPhotoPreview && profilePicture && (
              <button
                type="button"
                onClick={onRemovePhoto}
                className="absolute -top-1.5 -right-1.5 h-7 w-7 bg-white text-red-500 rounded-lg flex items-center justify-center shadow-sm border border-stone-200 hover:border-red-200 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove photo"
                aria-label="Remove photo"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                {profile.name || '—'}
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-brand-50 text-brand-800 border border-brand-100">
                <BadgeCheck className="w-3 h-3" /> {formatRoleLabel(userRole)}
              </span>
              {verified ? (
                <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Email verified
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                  Email unverified
                </span>
              )}
            </div>

            <div className="mt-2.5 flex flex-col sm:flex-row sm:flex-wrap gap-x-5 gap-y-1.5 text-sm text-stone-600">
              {profile.email && (
                <p className="inline-flex items-center gap-1.5 min-w-0">
                  <Mail className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                  <span className="truncate font-medium">{profile.email}</span>
                </p>
              )}
              {profile.phone && (
                <p className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                  <span className="font-medium tabular-nums">{profile.phone}</span>
                </p>
              )}
              {organizationName && (
                <p className="inline-flex items-center gap-1.5 min-w-0">
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                  <span className="truncate font-medium">{organizationName}</span>
                </p>
              )}
            </div>

            {pendingPhotoPreview && (
              <div className="flex items-center gap-2 mt-3">
                <button type="button" onClick={onSavePhoto} disabled={isUploadingPic} className="btn-primary !px-3 !py-1.5 !text-sm">
                  {isUploadingPic ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save photo
                </button>
                <button type="button" onClick={onCancelPhoto} className="btn-secondary !px-3 !py-1.5 !text-sm">
                  Cancel
                </button>
              </div>
            )}
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2 w-full lg:w-auto lg:min-w-[11.5rem]">
            <div className="flex items-center gap-2.5 rounded-xl border border-stone-200/80 bg-stone-50/70 px-3 py-2">
              <Database className="w-4 h-4 text-brand-600 shrink-0" />
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">My candidates</dt>
                <dd className="text-sm font-bold text-stone-900 tabular-nums leading-tight mt-0.5">{stats.totalCandidates ?? 0}</dd>
              </div>
            </div>
            {joined && (
              <div className="flex items-center gap-2.5 rounded-xl border border-stone-200/80 bg-stone-50/70 px-3 py-2">
                <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Joined</dt>
                  <dd className="text-sm font-bold text-stone-900 leading-tight mt-0.5">{joined}</dd>
                </div>
              </div>
            )}
            {lastSeen && (
              <div className="flex items-center gap-2.5 rounded-xl border border-stone-200/80 bg-stone-50/70 px-3 py-2 col-span-2 sm:col-span-1">
                <Clock3 className="w-4 h-4 text-stone-500 shrink-0" />
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Last sign-in</dt>
                  <dd className="text-sm font-bold text-stone-900 leading-tight mt-0.5">{lastSeen}</dd>
                </div>
              </div>
            )}
          </dl>
        </div>
      </div>
    </section>
  );
}
