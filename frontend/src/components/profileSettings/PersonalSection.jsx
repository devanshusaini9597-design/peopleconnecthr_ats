import React from 'react';
import {
  User, Mail, Phone, Lock, Shield, Save, Eye, EyeOff, AlertCircle, CheckCircle2,
  Loader2, Calendar, Database, Settings, ChevronRight, LogOut, Camera, Trash2,
  Pencil, BadgeCheck, Sparkles, Info,
} from 'lucide-react';
import FieldRow from './FieldRow';
import { formatNameForInput } from '../../utils/textFormatter';

export default function PersonalSection({ isEditingProfile, setIsEditingProfile, profile, setProfile, hasProfileChanges, isSavingProfile, handleCancelEditProfile, setShowSaveConfirmModal }) {
  return (
        <div className="card-ats-bordered overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="px-5 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Personal information</h3>
              <p className="text-xs text-stone-500 mt-0.5">How you appear across the ATS</p>
            </div>
            {!isEditingProfile && (
              <button type="button" onClick={() => setIsEditingProfile(true)} className="btn-primary">
                <Pencil size={15} /> Edit
              </button>
            )}
          </div>

          <div className="px-5 sm:px-6 py-2 divide-y divide-stone-100">
            <FieldRow label="Full name" hint="Shown on emails & activity">
              {isEditingProfile ? (
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile((prev) => ({ ...prev, name: formatNameForInput(e.target.value) }))}
                  onBlur={() => setProfile((prev) => ({ ...prev, name: prev.name.trim() }))}
                  className="input-ats"
                  placeholder="Enter your full name"
                />
              ) : (
                <p className="text-sm font-medium text-stone-800 py-2.5">{profile.name || '—'}</p>
              )}
            </FieldRow>

            <FieldRow label="Work email" hint="Sign-in identity — cannot be changed here">
              <div className="flex items-center gap-2 py-2.5">
                <p className="text-sm font-medium text-stone-600 truncate">{profile.email}</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200 shrink-0">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              </div>
            </FieldRow>

            <FieldRow label="Phone" hint="Optional contact number">
              {isEditingProfile ? (
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                  className="input-ats"
                  placeholder="Enter phone number"
                />
              ) : (
                <p className="text-sm font-medium text-stone-800 py-2.5">{profile.phone || 'Not added'}</p>
              )}
            </FieldRow>
          </div>

          {isEditingProfile && (
            <div className="px-5 sm:px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between gap-3 flex-wrap">
              {hasProfileChanges ? (
                <p className="text-sm text-amber-600 flex items-center gap-1.5 font-medium">
                  <AlertCircle size={14} /> Unsaved changes
                </p>
              ) : <span />}
              <div className="flex items-center gap-2 ml-auto">
                <button type="button" onClick={handleCancelEditProfile} className="btn-secondary">Cancel</button>
                <button
                  type="button"
                  onClick={() => hasProfileChanges && setShowSaveConfirmModal(true)}
                  disabled={!hasProfileChanges || isSavingProfile}
                  className={`btn-primary ${!hasProfileChanges ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSavingProfile ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          )}
        </div>
  );
}
