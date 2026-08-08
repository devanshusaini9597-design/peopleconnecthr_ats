'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { Megaphone, Newspaper, Bell, Sparkles, ChevronRight, Calendar, Inbox, Zap, TrendingUp, Info, Clock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

const STORAGE_KEY = 'devlumiq-welcome-seen';

type TabId = 'all' | 'announcements' | 'news' | 'reminders';

type Item = {
  id: string;
  type: 'announcement' | 'news' | 'reminder';
  title: string;
  summary: string;
  time?: string;
  cta?: string;
  href?: string;
  icon?: string;
};

const tabs: { id: TabId; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'all', label: 'All', icon: Sparkles, color: 'from-brand-500 to-teal-600' },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, color: 'from-brand-500 to-brand-600' },
  { id: 'news', label: 'News', icon: Newspaper, color: 'from-emerald-500 to-emerald-600' },
  { id: 'reminders', label: 'Reminders', icon: Bell, color: 'from-amber-500 to-amber-600' },
];

function getTypeStyles(type: Item['type']) {
  switch (type) {
    case 'announcement':
      return { bg: 'bg-gradient-to-br from-brand-50 to-brand-100/50', text: 'text-brand-700', border: 'border-brand-200', Icon: Megaphone, iconBg: 'bg-brand-100' };
    case 'news':
      return { bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50', text: 'text-emerald-700', border: 'border-emerald-200', Icon: Newspaper, iconBg: 'bg-emerald-100' };
    case 'reminder':
      return { bg: 'bg-gradient-to-br from-amber-50 to-amber-100/50', text: 'text-amber-700', border: 'border-amber-200', Icon: Bell, iconBg: 'bg-amber-100' };
    default:
      return { bg: 'bg-gradient-to-br from-stone-50 to-stone-100/50', text: 'text-stone-700', border: 'border-stone-200', Icon: Bell, iconBg: 'bg-stone-100' };
  }
}

export function getShouldShowWelcome(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(STORAGE_KEY) !== 'true';
  } catch {
    return true;
  }
}

export function setWelcomeSeen() {
  try {
    sessionStorage.setItem(STORAGE_KEY, 'true');
  } catch {}
}

interface DashboardWelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function DashboardWelcomeModal({ open, onClose }: DashboardWelcomeModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFetchError(false);
    fetch('/api/announcements', { credentials: 'include', cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((data: Item[]) => {
        setItems(Array.isArray(data) ? data : []);
        setFetchError(false);
      })
      .catch(() => {
        setItems([]);
        setFetchError(true);
      })
      .finally(() => setLoading(false));
  }, [open]);

  // Tab ID to item type mapping
  const tabTypeMap: Record<Exclude<TabId, 'all'>, Item['type']> = useMemo(() => ({
    announcements: 'announcement',
    news: 'news',
    reminders: 'reminder',
  }), []);

  // Memoize filtered items for performance
  const filtered = useMemo(() => {
    if (activeTab === 'all') return items;
    return items.filter((i) => i.type === tabTypeMap[activeTab]);
  }, [items, activeTab, tabTypeMap]);

  // Memoize stats calculation
  const stats = useMemo(() => ({
    total: items.length,
    announcements: items.filter(i => i.type === 'announcement').length,
    news: items.filter(i => i.type === 'news').length,
    reminders: items.filter(i => i.type === 'reminder').length,
  }), [items]);

  const handleClose = () => {
    if (dontShowAgain) setWelcomeSeen();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} size="xl" showClose>
      <div className="flex flex-col h-[70vh] max-h-[600px]">
        {/* Header - Compact premium styling */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-stone-100 flex-shrink-0 animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shadow-lg shadow-brand-500/25 flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 id="modal-title" className="text-lg font-bold text-stone-900 tracking-tight break-words">
                Welcome back
              </h2>
              <p className="text-stone-500 text-xs break-words">
                Announcements, updates & reminders for you
              </p>
            </div>
          </div>
        </div>

        {/* Stats Summary - Compact cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 animate-fade-in">
          <div className="bg-gradient-to-br from-brand-50 to-brand-100/30 rounded-xl p-3 border border-brand-100/60">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              <span className="text-[10px] font-medium text-brand-700 uppercase">Total</span>
            </div>
            <p className="text-xl font-bold text-brand-900">{stats.total}</p>
          </div>
          <div className="bg-gradient-to-br from-brand-50 to-brand-100/30 rounded-xl p-3 border border-brand-100/60">
            <div className="flex items-center gap-1.5 mb-1">
              <Megaphone className="w-3.5 h-3.5 text-brand-600" />
              <span className="text-[10px] font-medium text-brand-700 uppercase">Updates</span>
            </div>
            <p className="text-xl font-bold text-brand-900">{stats.announcements}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/30 rounded-xl p-3 border border-emerald-100/60">
            <div className="flex items-center gap-1.5 mb-1">
              <Newspaper className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[10px] font-medium text-emerald-700 uppercase">News</span>
            </div>
            <p className="text-xl font-bold text-emerald-900">{stats.news}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/30 rounded-xl p-3 border border-amber-100/60">
            <div className="flex items-center gap-1.5 mb-1">
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[10px] font-medium text-amber-700 uppercase">Alerts</span>
            </div>
            <p className="text-xl font-bold text-amber-900">{stats.reminders}</p>
          </div>
        </div>

        {/* Tabs - Compact styling */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-stone-100/80 mt-3 overflow-x-auto flex-shrink-0 scrollbar-hide animate-fade-in">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? `bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/60`
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-600' : 'text-stone-500'}`} />
                <span>{tab.label}</span>
                {tab.id !== 'all' && (
                  <span className={`ml-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                    isActive ? 'bg-stone-100 text-stone-700' : 'bg-stone-200/50 text-stone-600'
                  }`}>
                    {tab.id === 'announcements' ? stats.announcements : tab.id === 'news' ? stats.news : stats.reminders}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* List - Scrollable content area that takes remaining space */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden mt-3 space-y-2 pr-1 -mr-1 animate-fade-in">
          <AnimatePresence mode="sync" initial={false}>
            {loading ? (
              <div className="py-4 space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-gradient-to-r from-stone-50 to-stone-100/50 rounded-xl w-full animate-pulse" />
                ))}
              </div>
            ) : fetchError ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
                  <Info className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900 mb-2">Unable to load updates</h3>
                <p className="text-sm text-stone-500 max-w-xs mb-4">
                  We couldn&apos;t fetch the latest announcements. Please try again later.
                </p>
                <button
                  onClick={() => {
                    setLoading(true);
                    setFetchError(false);
                    fetch('/api/announcements', { credentials: 'include', cache: 'no-store' })
                      .then(res => res.ok ? res.json() : [])
                      .then(data => setItems(Array.isArray(data) ? data : []))
                      .catch(() => setFetchError(true))
                      .finally(() => setLoading(false));
                  }}
                  className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center mb-3 shadow-inner">
                  <Inbox className="w-8 h-8 text-stone-400" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900 mb-2">
                  {activeTab === 'all' ? 'No updates yet' : `No ${activeTab} found`}
                </h3>
                <p className="text-sm text-stone-500 max-w-xs">
                  {activeTab === 'all' 
                    ? "You're all caught up! New announcements, news, and reminders will appear here."
                    : `No ${activeTab} available at the moment. Check back later for updates.`}
                </p>
              </div>
            ) : (
              filtered.map((entry, i) => {
                if (!entry?.type) return null;
                const styles = getTypeStyles(entry.type);
                const StyleIcon = styles.Icon;
                return (
                  <div
                    key={entry.id}
                    className={`group rounded-xl border ${styles.border} ${styles.bg} p-4 transition-all duration-200 hover:shadow-md hover:shadow-stone-900/5 overflow-hidden cursor-pointer`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.iconBg} ${styles.text} shadow-sm`}>
                        <StyleIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 flex-wrap gap-y-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${styles.iconBg} ${styles.text}`}>
                            {entry.type}
                          </span>
                          {entry.time && (
                            <span className="text-xs text-stone-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 flex-shrink-0" />
                              {entry.time}
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-stone-900 mt-1.5 break-words group-hover:text-brand-700 transition-colors">{entry.title}</h3>
                        <p className="text-sm text-stone-600 mt-1 break-words leading-relaxed line-clamp-2">
                          {entry.summary}
                        </p>
                        {entry.cta && entry.href && (
                          <Link
                            href={entry.href}
                            onClick={handleClose}
                            className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-brand-600 hover:text-brand-700 break-words group/link"
                          >
                            {entry.cta}
                            <ChevronRight className="w-4 h-4 flex-shrink-0 transition-transform group-hover/link:translate-x-0.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Footer - Compact styling */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 mt-3 border-t border-stone-100 flex-shrink-0">
          <label className="flex items-center gap-2.5 cursor-pointer group order-2 sm:order-1">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-stone-300 text-brand-600 focus:ring-brand-500 w-4 h-4 flex-shrink-0"
            />
            <span className="text-sm text-stone-600 group-hover:text-stone-900">
              Don't show again this session
            </span>
          </label>
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-brand-600 to-teal-600 text-white hover:from-brand-700 hover:to-teal-700 transition-all duration-200 text-sm shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30 order-1 sm:order-2 w-full sm:w-auto"
          >
            Got it
          </button>
        </div>
      </div>
    </Modal>
  );
}
