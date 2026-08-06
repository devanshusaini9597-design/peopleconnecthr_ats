import React from 'react';
import {
  User, Mail, Phone, Lock, Shield, Save, Eye, EyeOff, AlertCircle, CheckCircle2,
  Loader2, Calendar, Database, Settings, ChevronRight, LogOut, Camera, Trash2,
  Pencil, BadgeCheck, Sparkles, Info,
} from 'lucide-react';
import FieldRow from './FieldRow';
import { formatNameForInput } from '../../utils/textFormatter';

export default function AccountSection({ navigate, setShowLogoutConfirm, quickLinks }) {
  return (
        <div className="space-y-4">
          <div className="card-ats-bordered overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="px-5 sm:px-6 py-4 border-b border-stone-100">
              <h3 className="text-sm font-bold text-stone-900">Shortcuts</h3>
              <p className="text-xs text-stone-500 mt-0.5">Jump to related settings</p>
            </div>
            <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <button
                    key={link.path}
                    type="button"
                    onClick={() => navigate(link.path)}
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-stone-200 hover:border-brand-200 hover:bg-brand-50/30 transition-all text-left group"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${link.tone}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-stone-900 tracking-tight">{link.title}</p>
                      <p className="text-xs text-stone-500">{link.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-brand-500 transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card-ats-bordered overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-stone-900">Sign out</p>
                <p className="text-xs text-stone-500 mt-0.5">End your session on this device — you&apos;ll need to sign in again</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="h-9 px-4 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors inline-flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <LogOut size={14} /> Log out
              </button>
            </div>
          </div>
        </div>
  );
}
