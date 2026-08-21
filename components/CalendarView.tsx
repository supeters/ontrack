'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Globe,
  Plus,
  Trash2,
  X,
  RefreshCw,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import ActivityDetailModal from './ActivityDetailModal';
import { formatDateLocal } from '@/lib/datetime';

interface CalendarFeed {
  id: number;
  kid_id: number;
  name: string;
  url: string;
}

interface CalendarViewProps {
  kidId: number;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}

export default function CalendarView({ kidId, selectedDate, setSelectedDate }: CalendarViewProps) {
  const { theme } = useTheme();

  // Safe theme fallback
  const c = theme?.colors || {
    bg: 'bg-white',
    cardBg: 'bg-white',
    divider: 'border-gray-200',
    moduleIcon: 'text-gray-700',
    moduleText: 'text-gray-900',
    moduleBorder: 'border-gray-300',
    activityText: 'text-gray-800',
    mutedText: 'text-gray-500',
    statText: 'text-gray-600',
    checkboxChecked: 'bg-indigo-600',
    workgroupBg: 'bg-stone-50',
  };

  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideWeekends, setHideWeekends] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Google OAuth Sync State
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleCalendarName, setGoogleCalendarName] = useState<string>('');
  
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleTitle, setGoogleTitle] = useState('');
  const [googleDesc, setGoogleDesc] = useState('');
  const [googleDate, setGoogleDate] = useState('');
  const [googleStartTime, setGoogleStartTime] = useState('09:00');
  const [googleEndTime, setGoogleEndTime] = useState('10:00');
  const [isSavingGoogleEvent, setIsSavingGoogleEvent] = useState(false);

  // iCal Feeds Modal State
  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [newFeedName, setNewFeedName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [isSavingFeed, setIsSavingFeed] = useState(false);

  function getStartOfWeek(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  const currentWeekStart = useMemo(() => getStartOfWeek(selectedDate), [selectedDate]);

  const weekDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);

      if (hideWeekends && (date.getDay() === 0 || date.getDay() === 6)) {
        continue;
      }

      dates.push(date);
    }
    return dates;
  }, [currentWeekStart, hideWeekends]);

  const loadData = async () => {
    if (!kidId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const startDate = new Date(currentWeekStart);
      const endDate = new Date(currentWeekStart);
      endDate.setDate(endDate.getDate() + 6);

      const startDateStr = formatDateLocal(startDate);
      const endDateStr = formatDateLocal(endDate);

      const feedsPromise = fetch(`/api/calendars/ical?kidId=${kidId}`).then((res) => res.json());
      
      const googleStatusPromise = fetch(`/api/auth/google/status?kidId=${kidId}`)
        .then((res) => res.json())
        .catch(() => ({ connected: false, calendarName: '' }));

      const [feedsData, googleStatusData] = await Promise.all([feedsPromise, googleStatusPromise]);

      const currentFeeds: CalendarFeed[] = feedsData.feeds || [];
      setFeeds(currentFeeds);
      setGoogleConnected(Boolean(googleStatusData.connected));
      setGoogleCalendarName(googleStatusData.calendarName || '');

      const plannerPromise = fetch(
        `/api/planner?kidId=${kidId}&startDate=${startDateStr}&endDate=${endDateStr}`
      ).then((res) => res.json());

      const googleEventsPromise = googleStatusData.connected
        ? fetch(`/api/calendars/google/events?kidId=${kidId}&startDate=${startDateStr}&endDate=${endDateStr}`)
            .then((res) => res.json())
            .then((data) => data.events || [])
            .catch(() => [])
        : Promise.resolve([]);

      const icalPromises = currentFeeds.map((feed) =>
        fetch(`/api/calendars/ical/parse?url=${encodeURIComponent(feed.url)}`)
          .then((res) => res.json())
          .then((data) =>
            (data.events || []).map((e: any) => ({ ...e, feedName: feed.name, is_ical: true }))
          )
          .catch(() => [])
      );

      const [plannerData, googleEvents, ...icalResults] = await Promise.all([
        plannerPromise,
        googleEventsPromise,
        ...icalPromises,
      ]);

      setActivities([
        ...(plannerData.activities || []),
        ...googleEvents,
        ...icalResults.flat(),
      ]);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidId, currentWeekStart]);

  const handleCreateGoogleEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleTitle || !googleDate || !googleStartTime || !googleEndTime) return;

    try {
      setIsSavingGoogleEvent(true);

      const startDateTime = `${googleDate}T${googleStartTime}:00`;
      const endDateTime = `${googleDate}T${googleEndTime}:00`;

      const response = await fetch('/api/calendars/google/create-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kidId,
          title: googleTitle,
          description: googleDesc,
          startTime: startDateTime,
          endTime: endDateTime,
        }),
      });

      if (!response.ok) throw new Error('Failed to create event');

      setGoogleTitle('');
      setGoogleDesc('');
      setIsGoogleModalOpen(false);
      await loadData();
    } catch (error) {
      console.error('Error adding event to Google Calendar:', error);
    } finally {
      setIsSavingGoogleEvent(false);
    }
  };

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedName || !newFeedUrl) return;

    try {
      setIsSavingFeed(true);
      await fetch('/api/calendars/ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kidId, name: newFeedName, url: newFeedUrl }),
      });

      setNewFeedName('');
      setNewFeedUrl('');
      await loadData();
    } catch (error) {
      console.error('Error adding feed:', error);
    } finally {
      setIsSavingFeed(false);
    }
  };

  const handleDeleteFeed = async (feedId: number) => {
    try {
      await fetch(`/api/calendars/ical?feedId=${feedId}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      console.error('Error deleting feed:', error);
    }
  };

  const goToPrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (minutes: number) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const openActivityModal = (activity: any) => {
    if (activity.is_ical || activity.is_google) return;
    setSelectedActivity(activity);
    setIsModalOpen(true);
  };

  const closeActivityModal = () => {
    setSelectedActivity(null);
    setIsModalOpen(false);
  };

  const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return null;
    const dateObj = new Date(timeStr);
    return dateObj.getHours() * 60 + dateObj.getMinutes();
  };

  const computeEventPositions = (dayEvents: any[]) => {
    if (!dayEvents || dayEvents.length === 0) return [];

    const eventsWithTimes = dayEvents
      .map((e) => {
        const start = timeToMinutes(e.start_time);
        if (start === null) return null;

        let duration = 60;
        if (e.end_time) {
          const end = timeToMinutes(e.end_time);
          if (end && end > start) duration = end - start;
        } else if (e.estimated_minutes) {
          duration = e.estimated_minutes;
        }

        return { ...e, _start: start, _end: start + duration };
      })
      .filter(Boolean)
      .sort((a, b) => a._start - b._start || (b._end - b._start) - (a._end - a._start));

    const columns: any[][] = [];

    return eventsWithTimes.map((event) => {
      let columnIndex = 0;

      while (
        columns[columnIndex] &&
        columns[columnIndex].some((e) => event._start < e._end && event._end > e._start)
      ) {
        columnIndex++;
      }

      if (!columns[columnIndex]) {
        columns[columnIndex] = [];
      }
      columns[columnIndex].push(event);

      return { event, columnIndex };
    }).map(({ event, columnIndex }) => {
      const overlappingCols = columns.filter((col) =>
        col.some((e) => event._start < e._end && event._end > e._start)
      ).length;

      const totalCols = Math.max(overlappingCols, 1);
      const widthPct = 100 / totalCols;
      const leftPct = columnIndex * widthPct;

      return {
        ...event,
        layout: {
          width: `${widthPct}%`,
          left: `${leftPct}%`,
        },
      };
    });
  };

  if (loading) {
    return (
      <div className={`flex h-full items-center justify-center ${c.bg}`}>
        <div className="text-center">
          <div className="animate-spin border-b-2 border-indigo-600 h-12 mb-4 mx-auto rounded-full w-12" />
          <p className={c.mutedText}>Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${c.bg}`}>
      {/* Header Bar */}
      <div className={`${c.cardBg} border-b ${c.divider} p-3`}>
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2 items-center">
            <CalendarIcon className={`w-5 h-5 ${c.moduleIcon}`} />
            <h2 className={`text-lg font-semibold ${c.moduleText}`}>Weekly Calendar</h2>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
           {/* Add Event to Google Calendar (only if connected) */}
            {googleConnected && (
              <button
                onClick={() => {
                  setGoogleDate(formatDateLocal(selectedDate));
                  setIsGoogleModalOpen(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border ${c.moduleBorder} ${c.cardBg} ${c.activityText} rounded-lg hover:opacity-80 transition-opacity`}
              >
                <Plus className="h-3.5 text-emerald-500 w-3.5" />
                <span>Add to {googleCalendarName || 'Google Calendar'}</span>
              </button>
            )}

            {/* iCal Feeds Modal Button */}
            <button
              onClick={() => setIsFeedModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border ${c.moduleBorder} ${c.cardBg} ${c.activityText} rounded-lg hover:opacity-80 transition-opacity`}
            >
              <Globe className="h-3.5 text-blue-500 w-3.5" />
              <span>iCal Feeds ({feeds.length})</span>
            </button>

            <label className="flex gap-1.5 items-center text-xs">
              <input
                type="checkbox"
                checked={hideWeekends}
                onChange={(e) => setHideWeekends(e.target.checked)}
                className="rounded"
              />
              <span className={c.activityText}>Hide Weekends</span>
            </label>

            <div className={`flex items-center border ${c.moduleBorder} rounded-lg ${c.cardBg}`}>
              <button
                onClick={goToPrevWeek}
                className={`p-1.5 hover:opacity-75 transition-opacity ${c.activityText}`}
                title="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={goToToday}
                className={`px-3 py-1.5 text-xs font-medium hover:opacity-75 transition-opacity border-x ${c.moduleBorder} ${c.activityText}`}
              >
                Today
              </button>
              <button
                onClick={goToNextWeek}
                className={`p-1.5 hover:opacity-75 transition-opacity ${c.activityText}`}
                title="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium ${c.activityText} ${c.cardBg} border ${c.moduleBorder} rounded-lg`}>
              <CalendarIcon className="h-4 w-4" />
              Week of {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-auto">
        <div className={`grid gap-0 border ${c.divider}`} style={{ gridTemplateColumns: `repeat(${weekDates.length}, 1fr)` }}>
          {weekDates.map((date, index) => {
            const dateStr = formatDateLocal(date);
            const dayActivities = activities.filter(a => a.plan_date?.split('T')[0] === dateStr && a.start_time);
            const dayTotal = dayActivities.reduce((sum, a) => sum + (a.estimated_minutes || 0), 0);

            return (
              <div
                key={index}
                className={`${isToday(date) ? `${c.checkboxChecked} text-white` : c.cardBg} border-b ${c.divider} p-2 text-center`}
              >
                <div className={`text-xs font-semibold ${isToday(date) ? 'text-white' : c.moduleText}`}>{formatDate(date)}</div>
                {dayTotal > 0 && (
                  <div className={`text-[10px] mt-0.5 ${isToday(date) ? 'text-white' : c.statText}`}>
                    {formatTime(dayTotal)}
                  </div>
                )}
              </div>
            );
          })}

          <div className="relative" style={{ gridColumn: `span ${weekDates.length}` }}>
            <div className="grid" style={{ gridTemplateColumns: `auto repeat(${weekDates.length}, 1fr)` }}>
              <div className={c.cardBg}>
                {Array.from({ length: 15 }, (_, i) => i + 7).map(hour => (
                  <div key={hour} className={`border-b ${c.divider} px-2 py-1 text-xs ${c.mutedText} flex items-center h-12`}>
                    {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </div>
                ))}
              </div>

              {weekDates.map((date, dayIndex) => {
                const dateStr = formatDateLocal(date);
                const rawDayActivities = activities.filter(a => a.plan_date?.split('T')[0] === dateStr && a.start_time);
                const positionedActivities = computeEventPositions(rawDayActivities);

                return (
                  <div key={dayIndex} className={`border-l ${c.divider} relative`}>
                    {Array.from({ length: 15 }).map((_, i) => (
                      <div key={i} className={`border-b ${c.divider} h-12 opacity-50`} />
                    ))}

                    {positionedActivities.map(activity => {
                      const startMinutes = activity._start;
                      const duration = activity._end - startMinutes;

                      const startHour = 7;
                      const relativeMinutes = startMinutes - (startHour * 60);
                      const topPosition = (relativeMinutes / 60) * 48;
                      const heightPixels = Math.max((duration / 60) * 48, 22);

                      const formatDisplayTime = (timeStr: string) => {
                        if (!timeStr) return '';
                        const d = new Date(timeStr);
                        const hours = d.getHours();
                        const minutes = d.getMinutes();
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
                        return `${displayHour}:${minutes.toString().padStart(2, '0')}${ampm}`;
                      };

                      const startTime = formatDisplayTime(activity.start_time);
                      const endTime = activity.end_time ? formatDisplayTime(activity.end_time) : '';

                      return (
                        <div
                          key={activity.id}
                          className={`absolute p-1 rounded border z-10 transition-all overflow-hidden ${
                            activity.is_google
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 cursor-default'
                              : activity.is_ical
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-900 cursor-default'
                              : `${c.moduleBorder} ${c.cardBg} ${c.activityText} cursor-pointer hover:shadow-md ${
                                  activity.is_completed ? 'opacity-60' : ''
                                }`
                          }`}
                          style={{
                            top: `${topPosition}px`,
                            height: `${heightPixels}px`,
                            left: activity.layout.left,
                            width: activity.layout.width,
                          }}
                          onClick={() => openActivityModal(activity)}
                        >
                          <div className="flex gap-1 items-center justify-between mb-0.5">
                            <span
                              className={`font-semibold leading-tight text-[10px] truncate ${
                                activity.is_completed ? 'line-through opacity-70' : ''
                              }`}
                            >
                              {activity.title}
                            </span>
                            {activity.is_google ? (
                              <span className="bg-emerald-500/20 font-medium px-1 rounded shrink-0 text-[8px] text-emerald-700 truncate">
                                 {googleCalendarName || 'Google'}
                              </span>
                            ) : activity.is_ical ? (
                              <span className="bg-blue-500/20 font-medium px-1 rounded shrink-0 text-[8px] text-blue-700 truncate">
                                {activity.feedName}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between text-[9px]">
                            <span
                              className={`font-medium truncate ${
                                activity.is_google
                                  ? 'text-emerald-600'
                                  : activity.is_ical
                                  ? 'text-blue-600'
                                  : c.mutedText
                              }`}
                            >
                              {startTime}{endTime && `-${endTime}`}
                            </span>
                            {!activity.is_ical && !activity.is_google && activity.is_completed && (
                              <CheckCircle2 className="h-3 shrink-0 text-green-500 w-3" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add Google Calendar Event Modal */}
      {isGoogleModalOpen && (
        <div className="bg-black/50 fixed flex inset-0 items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md ${c.cardBg} rounded-xl shadow-xl border ${c.divider} p-5 space-y-4`}>
            <div className={`border-b ${c.divider} flex items-center justify-between pb-3`}>
              <div className="flex gap-2 items-center">
                <CalendarIcon className="h-5 text-emerald-500 w-5" />
                <h3 className={`text-base font-semibold ${c.moduleText}`}>Add to Google Calendar</h3>
              </div>
              <button onClick={() => setIsGoogleModalOpen(false)}>
                <X className={`h-5 w-5 ${c.mutedText}`} />
              </button>
            </div>

            <form onSubmit={handleCreateGoogleEvent} className="space-y-3">
              <div>
                <label className={`block font-medium mb-1 text-xs ${c.moduleText}`}>Event Title</label>
                <input
                  type="text"
                  placeholder="e.g., Varsity Soccer Practice"
                  value={googleTitle}
                  onChange={(e) => setGoogleTitle(e.target.value)}
                  className={`border ${c.moduleBorder} ${c.cardBg} ${c.activityText} p-2 rounded-lg text-xs w-full`}
                  required
                />
              </div>

              <div>
                <label className={`block font-medium mb-1 text-xs ${c.moduleText}`}>Description (Optional)</label>
                <textarea
                  placeholder="Additional event details..."
                  value={googleDesc}
                  onChange={(e) => setGoogleDesc(e.target.value)}
                  className={`border ${c.moduleBorder} ${c.cardBg} ${c.activityText} p-2 rounded-lg text-xs w-full h-20`}
                />
              </div>

              <div>
                <label className={`block font-medium mb-1 text-xs ${c.moduleText}`}>Date</label>
                <input
                  type="date"
                  value={googleDate}
                  onChange={(e) => setGoogleDate(e.target.value)}
                  className={`border ${c.moduleBorder} ${c.cardBg} ${c.activityText} p-2 rounded-lg text-xs w-full`}
                  required
                />
              </div>

              <div className="gap-2 grid grid-cols-2">
                <div>
                  <label className={`block font-medium mb-1 text-xs ${c.moduleText}`}>Start Time</label>
                  <input
                    type="time"
                    value={googleStartTime}
                    onChange={(e) => setGoogleStartTime(e.target.value)}
                    className={`border ${c.moduleBorder} ${c.cardBg} ${c.activityText} p-2 rounded-lg text-xs w-full`}
                    required
                  />
                </div>
                <div>
                  <label className={`block font-medium mb-1 text-xs ${c.moduleText}`}>End Time</label>
                  <input
                    type="time"
                    value={googleEndTime}
                    onChange={(e) => setGoogleEndTime(e.target.value)}
                    className={`border ${c.moduleBorder} ${c.cardBg} ${c.activityText} p-2 rounded-lg text-xs w-full`}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingGoogleEvent}
                className={`flex font-semibold gap-1.5 items-center justify-center py-2 rounded-lg text-xs transition-opacity w-full mt-2 border ${c.moduleBorder} ${c.cardBg} ${c.activityText} hover:opacity-80 disabled:opacity-50`}
              >
                <Plus className="h-4 text-emerald-500 w-4" /> Save Event to Google Calendar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Manage iCal Feeds Modal */}
      {isFeedModalOpen && (
        <div className="bg-black/50 fixed flex inset-0 items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md ${c.cardBg} rounded-xl shadow-xl border ${c.divider} p-5 space-y-4`}>
            <div className={`border-b ${c.divider} flex items-center justify-between pb-3`}>
              <div className="flex gap-2 items-center">
                <Globe className="h-5 text-blue-500 w-5" />
                <h3 className={`text-base font-semibold ${c.moduleText}`}>Manage iCal Feeds</h3>
              </div>
              <button onClick={() => setIsFeedModalOpen(false)}>
                <X className={`h-5 w-5 ${c.mutedText}`} />
              </button>
            </div>

            <form onSubmit={handleAddFeed} className="space-y-3">
              <div>
                <label className={`block font-medium mb-1 text-xs ${c.moduleText}`}>Feed Name</label>
                <input
                  type="text"
                  placeholder="e.g., School Calendar, Varsity Soccer"
                  value={newFeedName}
                  onChange={(e) => setNewFeedName(e.target.value)}
                  className={`border ${c.moduleBorder} ${c.cardBg} ${c.activityText} focus:outline-none p-2 rounded-lg text-xs w-full`}
                  required
                />
              </div>
              <div>
                <label className={`block font-medium mb-1 text-xs ${c.moduleText}`}>Google iCal URL (.ics)</label>
                <input
                  type="url"
                  placeholder="https://calendar.google.com/calendar/ical/..."
                  value={newFeedUrl}
                  onChange={(e) => setNewFeedUrl(e.target.value)}
                  className={`border ${c.moduleBorder} ${c.cardBg} ${c.activityText} focus:outline-none p-2 rounded-lg text-xs w-full`}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSavingFeed}
                className={`flex font-semibold gap-1.5 items-center justify-center py-2 rounded-lg text-xs transition-opacity w-full border ${c.moduleBorder} ${c.cardBg} ${c.activityText} hover:opacity-80 disabled:opacity-50`}
              >
                <Plus className="h-4 text-blue-500 w-4" /> Add Calendar Feed
              </button>
            </form>

            <div className={`border-t ${c.divider} pt-2 space-y-2`}>
              <h4 className={`font-semibold text-xs ${c.mutedText}`}>Connected Feeds</h4>
              {feeds.length === 0 ? (
                <p className={`italic text-xs ${c.mutedText}`}>No external feeds linked for this student.</p>
              ) : (
                feeds.map((feed) => (
                  <div key={feed.id} className={`${c.cardBg} border ${c.moduleBorder} flex items-center justify-between p-2 rounded-lg text-xs`}>
                    <div className="min-w-0 pr-2">
                      <p className={`font-semibold truncate ${c.moduleText}`}>{feed.name}</p>
                      <p className={`text-[10px] truncate ${c.mutedText}`}>{feed.url}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteFeed(feed.id)}
                      className="hover:text-red-700 p-1 text-red-500"
                      title="Remove Feed"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Activity Detail Modal */}
      {isModalOpen && selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={closeActivityModal}
          onUpdate={loadData}
        />
      )}
    </div>
  );
}