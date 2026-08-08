'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Video, Phone, FileCheck, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import { useLocale } from '@/components/providers/LocaleProvider';
import FullCalendarView from '@/components/calendar/FullCalendarView';
import CalendarEventModal, { type CalendarEventData } from '@/components/calendar/CalendarEventModal';

type ApiEvent = { id: string; title: string; start: string; end: string | null; type: string; candidate: string | null };

const typeStyles: Record<string, { icon: typeof Video; bg: string; border: string; text: string; badge: string }> = {
  interview: { icon: Video, bg: 'bg-brand-50', border: 'border-brand-200/60', text: 'text-brand-700', badge: 'bg-brand-500/15 text-brand-700' },
  technical: { icon: Video, bg: 'bg-brand-50', border: 'border-brand-200/60', text: 'text-brand-700', badge: 'bg-brand-500/15 text-brand-700' },
  behavioral: { icon: Phone, bg: 'bg-warm-50', border: 'border-amber-200/60', text: 'text-warm-700', badge: 'bg-amber-500/15 text-amber-700' },
  callback: { icon: Phone, bg: 'bg-warm-50', border: 'border-amber-200/60', text: 'text-warm-700', badge: 'bg-amber-500/15 text-amber-700' },
  offer: { icon: FileCheck, bg: 'bg-emerald-50', border: 'border-emerald-200/60', text: 'text-emerald-700', badge: 'bg-emerald-500/15 text-emerald-700' },
};

function getIcon(type: string) {
  const key = (type ?? '').toLowerCase();
  return typeStyles[key]?.icon ?? typeStyles.interview?.icon ?? FileCheck;
}

function getTypeStyle(type: string) {
  const key = (type ?? '').toLowerCase();
  return typeStyles[key] ?? typeStyles.interview ?? typeStyles.offer;
}

export default function CalendarPage() {
  const { t } = useLocale();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventData | null>(null);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    fetch(`/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`, { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ApiEvent[]) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const eventsForCalendar = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: new Date(e.start),
        end: e.end ? new Date(e.end) : new Date(e.start),
        type: e.type,
        candidate: e.candidate ?? undefined,
      })),
    [events]
  );

  const upcoming = useMemo(() => eventsForCalendar.slice(0, 5), [eventsForCalendar]);

  return (
    <PageShell>
      <PageHeader icon={CalendarIcon} title={t('calendar.title')} subtitle={t('calendar.subtitle')} />

      {loading ? (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 space-y-4 animate-pulse">
          <div className="h-8 w-48 bg-stone-100 rounded-lg" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 w-[85vw] max-w-[200px] bg-stone-50 rounded-xl flex-shrink-0" />
            ))}
          </div>
          <div className="h-64 bg-stone-50 rounded-xl w-full mt-4" />
        </div>
      ) : (
        <>
        {/* Upcoming events — card slider on mobile, grid on desktop */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-5 shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-brand-600" />
              </div>
              <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">
                {t('calendar.upcomingEvents')}
              </h2>
            </div>
          </div>
          {/* Mobile: swipeable cards with snap scroll */}
          <div className="sm:hidden relative">
            {upcoming.length === 0 ? (
              <p className="text-stone-500 text-sm py-4 text-center font-medium">No record found.</p>
            ) : (
            <div
              className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 -mx-1 px-1 snap-x snap-mandatory scroll-smooth scrollbar-hide touch-pan-x"
              style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              {upcoming.map((e, i) => {
                const Icon = getIcon(e.type);
                const style = getTypeStyle(e.type);
                return (
                  <motion.button
                    type="button"
                    key={e.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedEvent({ id: e.id, title: e.title, start: e.start, end: e.end, type: e.type, candidate: e.candidate })}
                    className={`flex items-center gap-3 p-4 rounded-xl border ${style.border} w-[85vw] max-w-[320px] flex-shrink-0 snap-center bg-white hover:bg-stone-50/80 active:bg-stone-100/80 transition-colors cursor-pointer text-left shadow-sm`}
                  >
                    <div className={`w-11 h-11 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${style.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${style.badge} mb-1`}>
                        {e.type}
                      </span>
                      <p className="font-semibold text-stone-900 text-sm truncate">{e.title}</p>
                      <p className="text-xs text-stone-500 mt-0.5">{format(e.start, 'EEE, MMM d')}</p>
                      <p className="text-xs font-medium text-stone-600">{format(e.start, 'h:mm a')}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
            )}
          </div>
          {/* Desktop: grid */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {upcoming.length === 0 ? (
              <p className="text-stone-500 text-sm py-4 col-span-full text-center font-medium">No record found.</p>
            ) : upcoming.map((e, i) => {
              const Icon = getIcon(e.type);
              const style = getTypeStyle(e.type);
              return (
                <motion.button
                  type="button"
                  key={e.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedEvent({ id: e.id, title: e.title, start: e.start, end: e.end, type: e.type, candidate: e.candidate })}
                  className={`flex items-center gap-3 p-4 rounded-xl border ${style.border} bg-white hover:bg-stone-50/80 transition-colors cursor-pointer text-left w-full`}
                >
                  <div className={`w-11 h-11 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${style.text}`} />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${style.badge} mb-1`}>
                      {e.type}
                    </span>
                    <p className="font-semibold text-stone-900 text-sm truncate">{e.title}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{format(e.start, 'EEE, MMM d')}</p>
                    <p className="text-xs font-medium text-stone-600">{format(e.start, 'h:mm a')}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <FullCalendarView
            events={eventsForCalendar}
            onEventClick={(ev) => setSelectedEvent(ev)}
          />
        </motion.div>

      <CalendarEventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
        </>
      )}
    </PageShell>
  );
}
