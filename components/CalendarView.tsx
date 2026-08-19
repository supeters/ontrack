'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Globe,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
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

  // Safe fallback for theme colors
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

  // iCal Feeds Modal & Form State
  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [newFeedName, setNewFeedName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [isSavingFeed, setIsSavingFeed] = useState(false);

  // Get start of week (Sunday)
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

      // 1. Fetch saved iCal feeds
      const feedsRes = await fetch(`/api/calendars/ical?kidId=${kidId}`);
      const feedsData = await feedsRes.json();
      const currentFeeds: CalendarFeed[] = feedsData.feeds || [];
      setFeeds(currentFeeds);

      // 2. Fetch & parse external iCal events ONLY
      const icalPromises = currentFeeds.map((feed) =>
        fetch(`/api/calendars/ical/parse?url=${encodeURIComponent(feed.url)}`)
          .then((res) => res.json())
          .then((data) =>
            (data.events || []).map((e: any) => ({ ...e, feedName: feed.name }))
          )
          .catch(() => [])
      );

      const icalResults = await Promise.all(icalPromises);
      setActivities(icalResults.flat());
    } catch (error) {
      console.error('Error loading iCal stream data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidId, currentWeekStart]);

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

  const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return null;
    if (timeStr.includes('T')) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.getHours() * 60 + d.getMinutes();
      }
      const timePart = timeStr.split('T')[1];
      const [hours, minutes] = timePart.split(':').map(Number);
      return hours * 60 + (minutes || 0);
    }
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
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
          <div className={`animate-spin border-b-2 border-current h-12 mb-4 mx-auto rounded-full w-12 ${c.moduleIcon}`} />
          <p className={c.mutedText}>Loading iCal events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${c.bg}`}>
      {/* Header */}
      <div className={`${c.cardBg} border-b ${c.divider} p-3`}>
        <div className="flex items-center justify-between">
          <div className="flex gap-2 items-center">
            <CalendarIcon className={`w-5 h-5 ${c.moduleIcon}`} />
            <h2 className={`text-lg font-semibold ${c.moduleText}`}>Weekly iCal Calendar</h2>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setIsFeedModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border ${c.moduleBorder} rounded-lg ${c.activityText} hover:bg-opacity-10 transition-colors`}
            >
              <Globe className={`h-3.5 w-3.5 ${c.moduleIcon}`} />
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

            <div className={`flex items-center border ${c.moduleBorder} rounded-lg`}>
              <button
                onClick={goToPrevWeek}
                className={`p-1.5 hover:bg-opacity-10 transition-colors ${c.activityText}`}
                title="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={goToToday}
                className={`px-3 py-1.5 text-xs font-medium hover:bg-opacity-10 transition-colors border-x ${c.moduleBorder} ${c.activityText}`}
              >
                Today
              </button>
              <button
                onClick={goToNextWeek}
                className={`p-1.5 hover:bg-opacity-10 transition-colors ${c.activityText}`}
                title="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium ${c.activityText} border ${c.moduleBorder} rounded-lg`}>
              <CalendarIcon className="h-4 w-4" />
              Week of {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="flex-1 overflow-auto">
        <div className={`grid gap-0 border ${c.divider}`} style={{ gridTemplateColumns: `repeat(${weekDates.length}, 1fr)` }}>
          {/* Day headers */}
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

          {/* Time grid */}
          <div className="relative" style={{ gridColumn: `span ${weekDates.length}` }}>
            <div className="grid" style={{ gridTemplateColumns: `auto repeat(${weekDates.length}, 1fr)` }}>
              {/* Time labels column */}
              <div className={c.cardBg}>
                {Array.from({ length: 15 }, (_, i) => i + 7).map(hour => (
                  <div key={hour} className={`border-b ${c.divider} px-2 py-1 text-xs ${c.mutedText} flex items-center h-12`}>
                    {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDates.map((date, dayIndex) => {
                const dateStr = formatDateLocal(date);
                const rawDayActivities = activities.filter(a => a.plan_date?.split('T')[0] === dateStr && a.start_time);
                const positionedActivities = computeEventPositions(rawDayActivities);

                return (
                  <div key={dayIndex} className={`border-l ${c.divider} relative h-[720px]`}>
                    {/* Background hour grid lines */}
                    <div className="absolute inset-0">
                      {Array.from({ length: 15 }).map((_, i) => (
                        <div key={i} className={`border-b ${c.divider} h-12 opacity-50`} />
                      ))}
                    </div>

                    <div className="h-full relative w-full">
                      {positionedActivities.map(activity => {
                        const startMinutes = activity._start;
                        const duration = Math.max(activity._end - startMinutes, 15);

                        const startHourGrid = 7;
                        const gridStartMinutes = startHourGrid * 60;

                        const relativeMinutes = startMinutes - gridStartMinutes;
                        const topPosition = (relativeMinutes / 60) * 48;
                        const heightPixels = Math.max((duration / 60) * 48, 22);

                        if (topPosition < 0) return null;

                        const formatDisplayTime = (timeStr: string) => {
                          if (!timeStr) return '';
                          const totalMins = timeToMinutes(timeStr);
                          if (totalMins === null) return '';
                          const hours = Math.floor(totalMins / 60);
                          const minutes = totalMins % 60;
                          const ampm = hours >= 12 ? 'PM' : 'AM';
                          const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
                          return `${displayHour}:${minutes.toString().padStart(2, '0')}${ampm}`;
                        };

                        const startTime = formatDisplayTime(activity.start_time);
                        const endTime = activity.end_time ? formatDisplayTime(activity.end_time) : '';

                        return (
                          <div
                            key={activity.id || `${activity.title}-${activity.start_time}`}
                            className={`absolute p-1 rounded border z-10 transition-all overflow-hidden ${c.cardBg} ${c.moduleBorder} ${c.activityText} cursor-default shadow-sm`}
                            style={{
                              top: `${Math.max(topPosition, 0)}px`,
                              height: `${heightPixels}px`,
                              left: activity.layout.left,
                              width: activity.layout.width,
                            }}
                          >
                            <div className="flex gap-1 items-center justify-between mb-0.5">
                              <span className={`font-semibold leading-tight text-[10px] truncate ${c.moduleText}`}>
                                {activity.title}
                              </span>
                              <span className={`px-1 rounded shrink-0 text-[8px] font-medium truncate ${c.workgroupBg} ${c.mutedText} border ${c.moduleBorder}`}>
                                {activity.feedName}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[9px]">
                              <span className={`font-medium truncate ${c.mutedText}`}>
                                {startTime}{endTime && `-${endTime}`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* iCal Feeds Modal */}
      {isFeedModalOpen && (
        <div className="bg-black/50 fixed flex inset-0 items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md ${c.cardBg} rounded-xl shadow-xl border ${c.divider} p-5 space-y-4`}>
            <div className={`border-b ${c.divider} flex items-center justify-between pb-3`}>
              <div className="flex gap-2 items-center">
                <Globe className={`h-5 w-5 ${c.moduleIcon}`} />
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
                  className={`border ${c.moduleBorder} ${c.cardBg} ${c.activityText} focus:outline-none focus:ring-1 focus:ring-indigo-500 p-2 rounded-lg text-xs w-full`}
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
                  className={`border ${c.moduleBorder} ${c.cardBg} ${c.activityText} focus:outline-none focus:ring-1 focus:ring-indigo-500 p-2 rounded-lg text-xs w-full`}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSavingFeed}
                className={`${c.checkboxChecked} text-white disabled:opacity-50 flex font-semibold gap-1.5 hover:opacity-90 items-center justify-center py-2 rounded-lg text-xs transition-opacity w-full`}
              >
                <Plus className="h-4 w-4" /> Add Calendar Feed
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
    </div>
  );
}