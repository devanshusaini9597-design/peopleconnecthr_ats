'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import allLocales from '@fullcalendar/core/locales-all';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useLocale } from '@/components/providers/LocaleProvider';
import type { CalendarEventData } from './CalendarEventModal';

interface FullCalendarClientProps {
  events: { id: string; title: string; start: Date; end: Date; extendedProps?: { type?: string; candidate?: string } }[];
  onEventClick?: (event: CalendarEventData) => void;
}

const EVENT_COLORS: Record<string, { bg: string; accent: string; text: string }> = {
  interview: { bg: 'rgba(13,148,136,0.08)', accent: '#0d9488', text: '#0f766e' },
  callback: { bg: 'rgba(217,119,6,0.08)', accent: '#d97706', text: '#b45309' },
  offer: { bg: 'rgba(5,150,105,0.08)', accent: '#059669', text: '#047857' },
};

type ViewType = 'dayGridMonth' | 'timeGridWeek';

export default function FullCalendarClient({ events, onEventClick }: FullCalendarClientProps) {
  const { locale } = useLocale();
  const [isMobile, setIsMobile] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('dayGridMonth');
  const [currentTitle, setCurrentTitle] = useState('');
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const api = calendarRef.current?.getApi();
      if (api && isMobile) {
        api.changeView('timeGridWeek');
        setCurrentView('timeGridWeek');
      } else if (api && !isMobile) {
        api.changeView('dayGridMonth');
        setCurrentView('dayGridMonth');
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isMobile]);

  const handleViewChange = useCallback((view: 'today' | 'dayGridMonth' | 'timeGridWeek') => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    if (view === 'today') {
      api.today();
      setCurrentView(api.view.type as ViewType);
    } else {
      api.changeView(view);
      setCurrentView(view);
    }
  }, []);

  const handleDatesSet = useCallback((arg: { view: { type: string; title: string } }) => {
    setCurrentView(arg.view.type as ViewType);
    setCurrentTitle(arg.view.title || '');
  }, []);

  return (
    <React.Fragment>
      {isMobile && (
        <div className="flex flex-col gap-2 py-3 px-2 border-b border-stone-200/80 bg-stone-50/50 rounded-t-xl">
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => calendarRef.current?.getApi().prev()}
              className="p-2 rounded-lg hover:bg-stone-200/60 active:bg-stone-300/60 transition-colors touch-manipulation"
              aria-label="Previous"
            >
              <ChevronLeft className="w-5 h-5 text-stone-600" />
            </button>
            <span className="text-sm font-semibold text-stone-800 min-w-[140px] text-center truncate">
              {currentTitle}
            </span>
            <button
              type="button"
              onClick={() => calendarRef.current?.getApi().next()}
              className="p-2 rounded-lg hover:bg-stone-200/60 active:bg-stone-300/60 transition-colors touch-manipulation"
              aria-label="Next"
            >
              <ChevronRight className="w-5 h-5 text-stone-600" />
            </button>
          </div>
          <div className="flex rounded-xl bg-stone-200/60 p-1 gap-0.5 w-full overflow-hidden">
            {(['today', 'dayGridMonth', 'timeGridWeek'] as const).map((view) => {
              const label = view === 'today' ? 'Today' : view === 'dayGridMonth' ? 'Month' : 'Week';
              const isActive =
                view === 'today' ? false : currentView === view;
              return (
                <button
                  key={view}
                  type="button"
                  onClick={() => handleViewChange(view)}
                  className={`flex-1 min-w-0 py-2.5 rounded-lg text-sm font-medium transition-all touch-manipulation ${
                    isActive
                      ? 'bg-white text-brand-700 shadow-sm'
                      : 'text-stone-600 hover:text-stone-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className={isMobile ? 'calendar-ats-mobile-toolbar' : ''}>
      <FullCalendar
      ref={calendarRef}
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      locales={allLocales}
      locale={locale}
      initialView={isMobile ? 'timeGridWeek' : 'dayGridMonth'}
      headerToolbar={
        isMobile
          ? false
          : { left: 'prev,next', center: 'title', right: 'today dayGridMonth,timeGridWeek' }
      }
      datesSet={handleDatesSet}
      events={events.map((e) => {
        const type = e.extendedProps?.type ?? 'interview';
        return { ...e, extendedProps: { ...e.extendedProps, type } };
      })}
      eventDisplay="block"
      height="auto"
      contentHeight={isMobile ? 320 : 460}
      firstDay={0}
      slotMinTime="06:00:00"
      slotMaxTime="22:00:00"
      nowIndicator
      dayMaxEvents={3}
      moreLinkClick="popover"
      dayHeaderFormat={isMobile ? { weekday: 'short' } : { weekday: 'long' }}
      slotLabelFormat={isMobile ? { hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' }}
      buttonText={{ today: 'Today', month: 'Month', week: 'Week' }}
      eventClick={(info) => {
        info.jsEvent.preventDefault();
        onEventClick?.({
          id: info.event.id,
          title: info.event.title ?? '',
          start: info.event.start ?? new Date(),
          end: info.event.end ?? new Date(),
          type: info.event.extendedProps?.type,
          candidate: info.event.extendedProps?.candidate,
        });
      }}
      eventClassNames={(arg) => {
        const type = arg.event.extendedProps?.type ?? 'interview';
        return [`fc-event-type-${type}`, 'enterprise-event'];
      }}
      eventContent={(arg) => {
        const type = arg.event.extendedProps?.type ?? 'interview';
        const colors = EVENT_COLORS[type] ?? EVENT_COLORS.interview;
        const timeStr = arg.timeText ? `${arg.timeText} · ` : '';
        return (
          <div
            className="enterprise-event-chip flex items-center gap-1.5 w-full min-h-[26px] px-2 py-1 rounded border-l-2 hover:opacity-90 transition-opacity cursor-pointer text-left"
            style={{ borderLeftColor: colors.accent }}
          >
            <span className="text-[11px] font-semibold text-stone-600 flex-shrink-0">{timeStr}</span>
            <span className="text-[11px] font-medium text-stone-800 truncate flex-1">{arg.event.title}</span>
            <ChevronRight className="w-3 h-3 text-stone-400 flex-shrink-0" />
          </div>
        );
      }}
    />
      </div>
    </React.Fragment>
  );
}
