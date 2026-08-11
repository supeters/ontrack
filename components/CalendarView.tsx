'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import ActivityModal from './ActivityModal';
import { formatDateLocal } from '@/lib/datetime';

interface CalendarViewProps {
  kidId: number;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}

export default function CalendarView({ kidId, selectedDate, setSelectedDate }: CalendarViewProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideWeekends, setHideWeekends] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get start of week (Sunday)
  function getStartOfWeek(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  // Get week dates
  const currentWeekStart = useMemo(() => getStartOfWeek(selectedDate), [selectedDate]);

  const weekDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);

      // Skip weekends if hideWeekends is true
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

      // Fetch planner data from API
      const response = await fetch(
        `/api/planner?kidId=${kidId}&startDate=${startDateStr}&endDate=${endDateStr}`
      );
      const data = await response.json();

      setActivities(data.activities || []);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load activities
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidId, currentWeekStart]);

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
    setSelectedActivity(activity);
    setIsModalOpen(true);
  };

  const closeActivityModal = () => {
    setSelectedActivity(null);
    setIsModalOpen(false);
  };

  const handleActivitySave = async ({ activityId, updates }: any) => {
    try {
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, updates }),
      });
      closeActivityModal();
      loadData();
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${c.checkboxChecked.split(' ')[0].replace('bg-', 'border-')} mx-auto mb-4`}></div>
          <p className={c.mutedText}>Loading calendar...</p>
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
            <h2 className={`text-lg font-semibold ${c.moduleText}`}>Weekly Calendar</h2>
          </div>
          <div className="flex gap-2 items-center">
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

      {/* Calendar View - Time-based */}
      <div className="flex-1 overflow-auto">
        <div className={`grid gap-0 border ${c.divider}`} style={{ gridTemplateColumns: `repeat(${weekDates.length}, 1fr)` }}>
          {/* Day headers */}
          {weekDates.map((date, index) => {
            const dateStr = date.toISOString().split('T')[0];
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

          {/* Time grid spanning all columns */}
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

              {/* Day columns with activities */}
              {weekDates.map((date, dayIndex) => {
                const dateStr = formatDateLocal(date);
                const dayActivities = activities.filter(a => a.plan_date?.split('T')[0] === dateStr && a.start_time);

                // Helper to convert time to minutes from midnight
                const timeToMinutes = (timeStr: string) => {
                  if (!timeStr) return null;
                  const dateObj = new Date(timeStr);
                  return dateObj.getHours() * 60 + dateObj.getMinutes();
                };

                return (
                  <div key={dayIndex} className={`border-l ${c.divider} relative`}>
                    {/* Grid lines */}
                    {Array.from({ length: 15 }).map((_, i) => (
                      <div key={i} className="border-b border-gray-100 h-12" />
                    ))}

                    {/* Activities positioned absolutely */}
                    {dayActivities.map(activity => {
                      const startMinutes = timeToMinutes(activity.start_time);
                      if (startMinutes === null) return null;

                      // Calculate duration
                      let duration = 60; // Default 1 hour
                      if (activity.end_time) {
                        const endMinutes = timeToMinutes(activity.end_time);
                        if (endMinutes) duration = endMinutes - startMinutes;
                      } else if (activity.estimated_minutes) {
                        duration = activity.estimated_minutes;
                      }

                      // Calculate position (7 AM = 0px)
                      const startHour = 7;
                      const relativeMinutes = startMinutes - (startHour * 60);
                      const topPosition = (relativeMinutes / 60) * 48; // 48px per hour
                      const heightPixels = Math.max((duration / 60) * 48, 12);

                      // Format time for display
                      const formatDisplayTime = (timeStr: string) => {
                        if (!timeStr) return '';
                        const date = new Date(timeStr);
                        const hours = date.getHours();
                        const minutes = date.getMinutes();
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
                        return `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                      };

                      const startTime = formatDisplayTime(activity.start_time);
                      const endTime = activity.end_time ? formatDisplayTime(activity.end_time) : '';

                      return (
                        <div
                          key={activity.id}
                          className={`absolute left-0 right-0 mx-1 px-2 py-1.5 rounded border-2 ${c.moduleBorder} ${
                            activity.is_completed ? 'opacity-60' : ''
                          } ${c.workgroupBg} cursor-pointer hover:shadow-md transition-shadow z-10`}
                          style={{
                            top: `${topPosition}px`,
                            height: `${heightPixels}px`,
                            minHeight: '20px'
                          }}
                          onClick={() => openActivityModal(activity)}
                        >
                          <div className={`font-semibold leading-tight mb-1 text-[11px] ${activity.is_completed ? 'line-through text-gray-500' : c.moduleText}`}>
                            {activity.title}
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={`font-medium ${c.mutedText}`}>
                              {startTime}{endTime && ` - ${endTime}`}
                            </span>
                            {activity.is_completed && (
                              <CheckCircle2 className="h-3 text-green-500 w-3" />
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

      {/* Activity Modal */}
      <ActivityModal
        isOpen={isModalOpen}
        onClose={closeActivityModal}
        activity={selectedActivity}
        onSave={handleActivitySave}
      />
    </div>
  );
}
