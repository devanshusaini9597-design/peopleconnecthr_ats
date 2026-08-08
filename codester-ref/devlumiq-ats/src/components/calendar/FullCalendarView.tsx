'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { CalendarEventData } from './CalendarEventModal';

const FullCalendarClient = dynamic(() => import('./FullCalendarClient'), { ssr: false });

type CalendarEvent = { id: string; title: string; start: Date; end: Date; type?: string; candidate?: string };

export default function FullCalendarView({
  events,
  onEventClick,
}: {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEventData) => void;
}) {
  const fcEvents = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        extendedProps: { type: e.type ?? 'interview', candidate: e.candidate },
      })),
    [events]
  );

  return (
    <div className="calendar-ats rounded-xl overflow-hidden min-h-[360px] xs:min-h-[400px] sm:min-h-[440px] md:min-h-[520px] w-full min-w-0">
      <FullCalendarClient events={fcEvents} onEventClick={onEventClick} />
    </div>
  );
}
