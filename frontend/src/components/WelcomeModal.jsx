import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, LayoutDashboard, Briefcase, BarChart3,
  Kanban, ArrowRight, CheckCircle2, Sparkles
} from 'lucide-react';
import Modal from './ui/Modal';

const ACTIONS = [
  {
    icon: UserPlus,
    title: 'Add a candidate',
    desc: 'Start building your pipeline',
    path: '/ats?add=1',
    tone: 'from-brand-500 to-teal-500',
  },
  {
    icon: Briefcase,
    title: 'Post a job',
    desc: 'Open a role on careers',
    path: '/jobs',
    tone: 'from-violet-500 to-fuchsia-500',
  },
  {
    icon: Kanban,
    title: 'View applications',
    desc: 'Track stages & interviews',
    path: '/applications',
    tone: 'from-sky-500 to-cyan-500',
  },
  {
    icon: BarChart3,
    title: 'Open analytics',
    desc: 'Hiring metrics at a glance',
    path: '/analytics',
    tone: 'from-amber-500 to-orange-500',
  },
];

/**
 * Shown once after login when the user lands on the dashboard.
 */
const WelcomeModal = ({ open, onClose, displayName }) => {
  const navigate = useNavigate();
  const firstName = (displayName || 'there').split(' ')[0];

  const go = (path) => {
    onClose?.();
    navigate(path);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Welcome back, ${firstName}`}
      description="Your recruitment workspace is ready. Pick a quick start — or continue to the dashboard."
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Continue to dashboard
          </button>
          <button type="button" onClick={() => go('/ats?add=1')} className="btn-primary">
            <UserPlus size={16} /> Add Candidate
          </button>
        </>
      }
    >
      <div className="pb-1">
        <div className="flex items-center gap-3 mb-5 px-3.5 py-3 rounded-2xl bg-gradient-to-r from-brand-50 to-teal-50 border border-brand-100/80">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 via-teal-500 to-brand-700 flex items-center justify-center shadow-md shadow-brand-500/20 flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-stone-900">Session started</p>
            <p className="text-xs text-stone-500 mt-0.5">Everything is synced — candidates, jobs, and analytics.</p>
          </div>
        </div>

        <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2.5 px-0.5">Quick start</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
          {ACTIONS.map(({ icon: Icon, title, desc, path, tone }) => (
            <button
              key={path}
              type="button"
              onClick={() => go(path)}
              className="group flex items-center gap-3 p-3.5 rounded-2xl border border-stone-200/80 bg-white hover:border-brand-300 hover:bg-brand-50/40 hover:shadow-md transition-all duration-200 text-left"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tone} flex items-center justify-center shadow-sm flex-shrink-0 transition-transform duration-200 group-hover:scale-105`}>
                <Icon size={18} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-stone-900">{title}</p>
                <p className="text-xs text-stone-500 mt-0.5">{desc}</p>
              </div>
              <ArrowRight size={16} className="text-stone-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-100 text-xs text-stone-500">
          <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
          <span>
            Tip: use <span className="font-semibold text-stone-700">Notifications</span> for callback reminders and team shares.
          </span>
          <LayoutDashboard size={14} className="text-stone-300 ml-auto flex-shrink-0 hidden sm:block" />
        </div>
      </div>
    </Modal>
  );
};

export default WelcomeModal;
