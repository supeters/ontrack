'use client';

import React, { useMemo } from 'react';
import { Play, Square } from 'lucide-react';

interface CalendarEventsTimelineProps {
  events: any[];
  activeEventId: string | number | null;
  onToggleActive: (eventId: string | number, e: React.MouseEvent) => void;
  onEventClick: (event: any) => void;
  theme: any;
  defaultStartHour?: number;
  defaultEndHour?: number;
}

export default function CalendarEventsTimeline({
  events,
  activeEventId,
  onToggleActive,
  onEventClick,
  theme,
  defaultStartHour = 7,
  defaultEndHour = 17,
}: CalendarEventsTimelineProps) {
  const c = theme?.colors || {};

  // Dynamically calculate both start and end hours based on the day's events
  const { computedStartHour, computedEndHour } = useMemo(() => {
    if (events.length === 0) {
      return { computedStartHour: defaultStartHour, computedEndHour: defaultEndHour };
    }

    let minHour = 23;
    let maxHour = 0;

    events.forEach((ev) => {
      if (!ev.start_time) return;

      const startDate = new Date(ev.start_time.replace(' ', 'T'));
      if (!isNaN(startDate.getTime())) {
        const startH = startDate.getHours();
        if (startH < minHour) minHour = startH;

        let endH = startH + 1;
        if (ev.end_time) {
          const endDate = new Date(ev.end_time.replace(' ', 'T'));
          if (!isNaN(endDate.getTime())) {
            endH = endDate.getHours();
            if (endDate.getMinutes() > 0) endH += 1;
          }
        }
        if (endH > maxHour) maxHour = endH;
      }
    });

    if (minHour > maxHour) {
      return { computedStartHour: defaultStartHour, computedEndHour: defaultEndHour };
    }

    return {
      computedStartHour: minHour,
      computedEndHour: Math.min(23, Math.max(minHour + 1, maxHour)),
    };
  }, [events, defaultStartHour, defaultEndHour]);

  const totalHours = computedEndHour - computedStartHour + 1;
  const hoursArray = useMemo(
    () => Array.from({ length: Math.max(1, totalHours) }, (_, i) => i + computedStartHour),
    [computedStartHour, totalHours]
  );

  if (events.length === 0) {
    return (
      <div className={`p-8 text-center text-xs ${c.mutedText || 'text-stone-500'} italic`}>
        No events scheduled for today.
      </div>
    );
  }

  return (
    <div className="overflow-hidden relative select-none w-full">
      <div className="flex">
        {/* Time Labels Sidebar */}
        <div className={`w-14 shrink-0 border-r ${c.divider}`}>
          {hoursArray.map((hour) => {
            const displayHour =
              hour === 0
                ? '12 AM'
                : hour === 12
                ? '12 PM'
                : hour > 12
                ? `${hour - 12} PM`
                : `${hour} AM`;
            return (
              <div
                key={hour}
                className={`h-12 border-b ${c.divider} pr-2 pt-1 text-[10px] font-medium ${c.mutedText} text-right`}
              >
                {displayHour}
              </div>
            );
          })}
        </div>

        {/* Timeline Grid Container */}
        <div className="flex-1 relative" style={{ height: `${totalHours * 48}px` }}>
          {/* Background Grid Lines */}
          {hoursArray.map((hour) => (
            <div key={hour} className={`h-12 border-b ${c.divider} w-full`} />
          ))}

          {/* Event Cards */}
          {events.map((ev) => {
            const eventId = ev.id || ev.title;
            const isEventActive = activeEventId === eventId;

            const startTime = ev.start_time ? new Date(ev.start_time.replace(' ', 'T')) : null;
            if (!startTime || isNaN(startTime.getTime())) return null;

            const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
            const minBound = computedStartHour * 60;
            const maxBound = (computedEndHour + 1) * 60;

            const relativeMinutes = startMinutes - minBound;
            if (startMinutes < minBound || startMinutes >= maxBound) return null;

            const topPosition = (relativeMinutes / 60) * 48;

            let duration = 60;
            if (ev.end_time) {
              const endTime = new Date(ev.end_time.replace(' ', 'T'));
              if (!isNaN(endTime.getTime())) {
                const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
                duration = Math.max(15, endMinutes - startMinutes);
              }
            }
            const heightPixels = Math.max((duration / 60) * 48, 28);

            const formattedTime = startTime.toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            });

            // Accent color border indicator based on feed source
            const feedAccentClass = ev.is_google
              ? 'border-l-4 border-l-emerald-500'
              : ev.is_ical
              ? 'border-l-4 border-l-sky-500'
              : 'border-l-4 border-l-amber-600';

            // Resolve calendar name from available database/feed fields
            const calendarDisplayName =
              ev.feedName ||
              ev.calendar_name ||
              ev.calendarName ||
              ev.summary ||
              (ev.is_google ? 'Google Calendar' : null);

            return (
              <div
                key={eventId}
                onClick={() => onEventClick(ev)}
                className={`absolute left-1.5 right-1.5 px-2.5 py-1.5 rounded-md border cursor-pointer transition-all overflow-hidden ${
                  isEventActive
                    ? `${c.moduleBorder} ${c.moduleHeader} shadow-md ring-1 ring-amber-500/50`
                    : `${c.cardBg} ${c.moduleBorder} ${c.activityHover} ${feedAccentClass}`
                }`}
                style={{
                  top: `${topPosition}px`,
                  height: `${heightPixels}px`,
                }}
              >
                <div className="flex gap-1.5 h-full items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-1.5 items-center">
                      <span
                        className={`text-[9px] font-semibold px-1 py-0.2 rounded shrink-0 ${c.moduleHeader} ${c.moduleText}`}
                      >
                        {formattedTime}
                      </span>
                      <span className={`text-[11px] font-semibold truncate ${c.activityText}`}>
                        {ev.title}
                      </span>
                    </div>

                    {calendarDisplayName && heightPixels > 40 && (
                      <p className={`text-[9px] mt-0.5 truncate ${c.mutedText}`}>
                        {calendarDisplayName}
                      </p>
                    )}
                  </div>

                  {!ev.is_ical && !ev.is_google && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleActive(eventId, e);
                      }}
                      className={`shrink-0 p-1 rounded transition-opacity ${
                        isEventActive
                          ? `${c.moduleHeader} ${c.moduleText} border ${c.moduleBorder}`
                          : `${c.checkboxChecked} text-white hover:opacity-90`
                      }`}
                      title={isEventActive ? 'Stop activity' : 'Start activity'}
                    >
                      {isEventActive ? (
                        <Square className="fill-current h-2.5 w-2.5" />
                      ) : (
                        <Play className="fill-current h-2.5 w-2.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}