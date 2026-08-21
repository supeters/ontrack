'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, CheckCircle2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import ActivityDetailModal from './ActivityDetailModal';
import { formatDateLocal } from '@/lib/datetime';

interface PlannerViewProps {
  kidId: number;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}

export default function PlannerView({ kidId, selectedDate, setSelectedDate }: PlannerViewProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [activities, setActivities] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideWeekends, setHideWeekends] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggedActivity, setDraggedActivity] = useState<any>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

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
      setCourses(data.courses || []);
    } catch (error) {
      console.error('Error loading planner data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load activities and courses
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidId, currentWeekStart]);

  // Calculate time totals per day
  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    weekDates.forEach(date => {
      const dateStr = formatDateLocal(date);
      const dayActivities = activities.filter(a => a.plan_date?.split('T')[0] === dateStr);
      totals[dateStr] = dayActivities.reduce((sum, a) => sum + (a.estimated_minutes || 0), 0);
    });
    return totals;
  }, [activities, weekDates]);

  // Calculate time totals per course
  const courseTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    courses.forEach(course => {
      const courseActivities = activities.filter(a => a.course_id === course.id);
      totals[course.id] = courseActivities.reduce((sum, a) => sum + (a.estimated_minutes || 0), 0);
    });
    return totals;
  }, [activities, courses]);

  // Group activities by course and date
  const activitiesByCourseAndDate = useMemo(() => {
    const grouped: Record<string | number, Record<string, any[]>> = {};

    courses.forEach(course => {
      grouped[course.id] = {};
      weekDates.forEach(date => {
        const dateStr = formatDateLocal(date);
        grouped[course.id][dateStr] = [];
      });
    });

    // Add "No Course" group
    grouped['no-course'] = {};
    weekDates.forEach(date => {
      const dateStr = formatDateLocal(date);
      grouped['no-course'][dateStr] = [];
    });

    activities.forEach(activity => {
      const courseId = activity.course_id || 'no-course';
      const dateStr = activity.plan_date?.split('T')[0];

      if (dateStr && grouped[courseId] && grouped[courseId][dateStr]) {
        grouped[courseId][dateStr].push(activity);
      }
    });

    return grouped;
  }, [activities, courses, weekDates]);

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  // Format time
  const formatTime = (minutes: number) => {
    if (!minutes || minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  // Navigate weeks
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

  // Handle activity modal
  const openActivityModal = (activity: any) => {
    setSelectedActivity(activity);
    setIsModalOpen(true);
  };

  const closeActivityModal = () => {
    setSelectedActivity(null);
    setIsModalOpen(false);
  };

  // Drag and drop handlers
  const handleDragStart = (activity: any) => {
    setDraggedActivity(activity);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetDate: Date) => {
    if (!draggedActivity) return;

    const newPlanDate = formatDateLocal(targetDate);

    try {
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: draggedActivity.id,
          updates: { plan_date: newPlanDate },
        }),
      });
      setDraggedActivity(null);
      loadData();
    } catch (error) {
      console.error('Error moving activity:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${c.checkboxChecked.split(' ')[0].replace('bg-', 'border-')} mx-auto mb-4`}></div>
          <p className={c.mutedText}>Loading planner...</p>
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
            <Calendar className={`w-5 h-5 ${c.moduleIcon}`} />
            <h2 className={`text-lg font-semibold ${c.moduleText}`}>Weekly Planner</h2>
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

            {/* Date Picker */}
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium ${c.activityText} hover:bg-opacity-10 rounded-lg transition-colors border ${c.moduleBorder}`}
              >
                <Calendar className="h-4 w-4" />
                Week of {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </button>

              {showDatePicker && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowDatePicker(false)} />
                  <div className={`absolute right-0 mt-2 ${c.cardBg} border ${c.moduleBorder} rounded-lg shadow-xl p-4 z-30 min-w-[280px]`}>
                    <div className="text-xs">
                      <label className={`block ${c.moduleText} mb-2`}>Jump to date:</label>
                      <input
                        type="date"
                        value={formatDateLocal(selectedDate)}
                        onChange={(e) => {
                          if (e.target.value) {
                            setSelectedDate(new Date(e.target.value + 'T12:00:00'));
                            setShowDatePicker(false);
                          }
                        }}
                        className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.moduleText}`}
                      />
                    </div>
                    <div className={`border-t ${c.divider} flex gap-2 mt-3 pt-3`}>
                      <button
                        onClick={() => {
                          setSelectedDate(new Date());
                          setShowDatePicker(false);
                        }}
                        className={`flex-1 px-3 py-1.5 text-xs ${c.checkboxChecked} text-white rounded hover:opacity-90 transition-opacity`}
                      >
                        This Week
                      </button>
                      <button
                        onClick={() => setShowDatePicker(false)}
                        className={`px-3 py-1.5 text-xs ${c.activityText} hover:bg-opacity-10 rounded transition-colors`}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid View - Course-grouped */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse text-xs w-full">
          <thead>
            <tr>
              <th className={`sticky left-0 z-10 ${c.cardBg} border-b ${c.divider} p-2 text-left text-xs font-semibold ${c.moduleText} w-32`}>
                Course
              </th>
              {weekDates.map((date, index) => {
                const dateStr = formatDateLocal(date);
                const dayTotal = dailyTotals[dateStr] || 0;
                return (
                  <th
                    key={index}
                    className={`border-b ${c.divider} p-2 text-xs font-semibold ${
                      isToday(date) ? `${c.checkboxChecked} text-white` : c.moduleText
                    }`}
                  >
                    <div className="whitespace-nowrap">{formatDate(date)}</div>
                    {dayTotal > 0 && (
                      <div className={`text-[10px] font-medium mt-0.5 ${isToday(date) ? 'text-white' : c.statText}`}>
                        {formatTime(dayTotal)}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 && (
              <tr>
                <td colSpan={weekDates.length + 1} className={`p-4 text-center ${c.mutedText} text-sm`}>
                  No courses with activities this week
                </td>
              </tr>
            )}
            {courses.map(course => {
              const courseTotal = courseTotals[course.id] || 0;

              return (
                <tr key={course.id} className={`border-b ${c.divider}`}>
                  <td className={`sticky left-0 z-10 ${c.cardBg} p-2 font-medium text-xs ${c.moduleText}`}>
                    <div className="truncate">{course.course_name}</div>
                    {courseTotal > 0 && (
                      <div className={`text-[10px] ${c.statText} font-medium mt-0.5`}>
                        {formatTime(courseTotal)}
                      </div>
                    )}
                  </td>
                  {weekDates.map((date, dateIndex) => {
                    const dateStr = formatDateLocal(date);
                    const dayActivities = activitiesByCourseAndDate[course.id]?.[dateStr] || [];

                    return (
                      <td
                        key={dateIndex}
                        className={`p-1 align-top ${isToday(date) ? 'bg-opacity-5 ' + c.checkboxChecked : ''} border-l ${c.divider}`}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(date)}
                      >
                        <div className="min-h-[40px] space-y-1">
                          {dayActivities.map(activity => {
                            const isEvent = activity.activity_type === 'event' || activity.activity_type === 'class';

                            return (
                              <div
                                key={activity.id}
                                draggable
                                onDragStart={() => handleDragStart(activity)}
                                onClick={() => openActivityModal(activity)}
                                className={`px-2 py-1.5 rounded text-[11px] border ${c.moduleBorder} ${
                                  activity.is_completed ? 'opacity-60' : ''
                                } ${c.workgroupBg} cursor-pointer hover:shadow-sm transition-shadow`}
                              >
                                <div className="flex gap-1.5 items-start">
                                  {/* Activity Type Icon */}
                                  <div className={`${isEvent ? 'bg-blue-100' : 'bg-orange-100'} rounded-sm p-0.5 flex-shrink-0 mt-0.5`}>
                                    {isEvent ? (
                                      <div className="border-2 border-blue-500 h-2 rounded-full w-2"></div>
                                    ) : (
                                      <div className="bg-orange-500 h-2 w-2"></div>
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className={`font-medium leading-tight line-clamp-2 ${activity.is_completed ? 'line-through text-gray-500' : c.activityText}`}>
                                      {activity.title}
                                    </div>
                                    {activity.estimated_minutes > 0 && (
                                      <div className={`text-[10px] ${c.mutedText} mt-0.5 flex items-center gap-1`}>
                                        <Clock className="h-2.5 w-2.5" />
                                        <span>{formatTime(activity.estimated_minutes)}</span>
                                        {activity.is_completed && (
                                          <CheckCircle2 className="flex-shrink-0 h-3 text-green-500 w-3" />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Activity Modal */}
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