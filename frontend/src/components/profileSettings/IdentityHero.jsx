import React from 'react';
import {
  Mail, Loader2, Calendar, Database, Camera, Trash2, Save, BadgeCheck,
} from 'lucide-react';
import { BASE } from './profileConstants';

export default function IdentityHero({
  profile,
  initials,
  userRole,
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
  return (
    <div className="card-ats-bordered overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 via-transparent to-teal-50/30 pointer-events-none" />
      <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="relative group self-start">
          {pendingPhotoPreview ? (
            <img src={pendingPhotoPreview} alt="New profile" className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shadow-md border-2 border-brand-200" />
          ) : profilePicture ? (
            <img
              src={`${BASE}${profilePicture}`}
              alt="Profile"
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shadow-md border-2 border-white"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-brand-500 to-teal-600 text-white flex items-center justify-center font-bold text-2xl sm:text-3xl shadow-md">
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={() => profilePicRef.current?.click()}
            disabled={isUploadingPic}
            className="absolute -bottom-1 -right-1 h-8 w-8 bg-white text-brand-600 rounded-lg flex items-center justify-center shadow-md border border-stone-200 hover:bg-brand-50 transition-colors"
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
              className="absolute -top-1 -right-1 h-7 w-7 bg-white text-red-500 rounded-lg flex items-center justify-center shadow-sm border border-stone-200 hover:border-red-200 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove photo"
              aria-label="Remove photo"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">{profile.name || 'No Name'}</h2>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
              <BadgeCheck className="w-3 h-3" /> {userRole}
            </span>
          </div>
          <p className="text-sm text-stone-500 mt-1 flex items-center gap-1.5 truncate">
            <Mail className="w-3.5 h-3.5 shrink-0" /> {profile.email}
          </p>
          {pendingPhotoPreview && (
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={onSavePhoto}
                disabled={isUploadingPic}
                className="btn-primary !px-3 !py-1.5 !text-sm"
              >
                {isUploadingPic ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save photo
              </button>
              <button
                type="button"
                onClick={onCancelPhoto}
                className="btn-secondary !px-3 !py-1.5 !text-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="flex sm:flex-col gap-2 shrink-0 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 border border-stone-200/80">
            <Database className="w-4 h-4 text-brand-500" />
            <div>
              <p className="text-sm font-bold text-stone-900 leading-none">{stats.totalCandidates}</p>
              <p className="text-[10px] text-stone-400 font-medium mt-0.5">Candidates</p>
            </div>
          </div>
          <div className="flex-1 sm:flex-none flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 border border-stone-200/80">
            <Mail className={`w-4 h-4 ${stats.emailConfigured ? 'text-emerald-500' : 'text-amber-500'}`} />
            <div>
              <p className="text-sm font-bold text-stone-900 leading-none">{stats.emailConfigured ? 'Ready' : 'Setup'}</p>
              <p className="text-[10px] text-stone-400 font-medium mt-0.5">Email</p>
            </div>
          </div>
          {stats.memberSince && (
            <div className="flex-1 sm:flex-none flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 border border-stone-200/80">
              <Calendar className="w-4 h-4 text-teal-500" />
              <div>
                <p className="text-sm font-bold text-stone-900 leading-none">
                  {new Date(stats.memberSince).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </p>
                <p className="text-[10px] text-stone-400 font-medium mt-0.5">Joined</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
