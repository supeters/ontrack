'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Clock, CheckCircle2, Plus, GraduationCap, ChevronDown } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import ActivityModal from './ActivityModal';
import CourseSetupModal from './CourseSetupModal';
import ActivityCreateModal from './ActivityCreateModal';
import { parseLocalTimestamp } from '@/lib/datetime';

interface AgendaViewProps {
  kidId: number;
  selectedDate: Date;
}

export default function AgendaView({ kidId, selectedDate }: AgendaViewProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [overdueActivities, setOverdueActivities] = useState<any[]>([]);
  const [todayActivities, setTodayActivities] = useState<any[]>([]);
  const [currentModuleActivities, setCurrentModuleActivities] = useState<any[]>([]);
  const [nextModuleActivities, setNextModuleActivities] = useState<any[]>([]);
  const [scheduledClasses, setScheduledClasses] = useState<any[]>([]);
  const [activeBucket, setActiveBucket] = useState<'overdue' | 'today' | 'current' | 'next'>('overdue');
  const [collapsedCourses, setCollapsedCourses] = useState<Set<number>>(new Set());
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isAddActivityModalOpen, setIsAddActivityModalOpen] = useState(false);

  const timeSlots = Array.from({ length: 15 }, (_, i) => i + 7); // 7am-9pm

  // Use formatDateLocal to avoid timezone shift when converting date to string
  const selectedDateStr = selectedDate.getFullYear() + '-' +
    String(selectedDate.getMonth() + 1).padStart(2, '0') + '-' +
    String(selectedDate.getDate()).padStart(2, '0');

  const loadAgendaData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agenda?kidId=${kidId}&date=${selectedDateStr}`);
      const data = await response.json();

      const courseMap = new Map();

      // Initialize all courses with scheduled_today flag from SQL
      data.courses?.forEach((course: any) => {
        courseMap.set(course.id, {
          ...course,
          name: course.name || course.course_name || course.courseName || '',
          todayActivities: [],
          overdueActivities: [],
        });
      });

      // Add activities to courses
      data.today_activities?.forEach((activity: any) => {
        if (activity.course_id && courseMap.has(activity.course_id)) {
          courseMap.get(activity.course_id).todayActivities.push(activity);
        }
      });

      data.overdue_activities?.forEach((activity: any) => {
        if (activity.course_id && courseMap.has(activity.course_id)) {
          courseMap.get(activity.course_id).overdueActivities.push(activity);
        }
      });

      const coursesToShow = Array.from(courseMap.values()).filter((course: any) => {
        const hasActivities = course.todayActivities.length > 0 || course.overdueActivities.length > 0;
        return course.scheduled_today || hasActivities;
      });

      setCourses(coursesToShow);
      setOverdueActivities(data.overdue_activities || []);
      setTodayActivities(data.today_activities || []);
      setCurrentModuleActivities(data.current_module_activities || []);
      setNextModuleActivities(data.next_module_activities || []);

      // Combine scheduled classes (events) with scheduled activities (tasks with start_time)
      const scheduledActivities = data.today_activities?.filter((a: any) => a.start_time) || [];
      setScheduledClasses([...(data.scheduled_classes || []), ...scheduledActivities]);
    } catch (error) {
      console.error('Error loading agenda:', error);
    } finally {
      setLoading(false);
    }
  }, [kidId, selectedDateStr]);

  useEffect(() => {
    if (kidId) loadAgendaData();
  }, [kidId, selectedDate, loadAgendaData]);

  const toggleCourse = (courseId: number) => {
    const newCollapsed = new Set(collapsedCourses);
    if (newCollapsed.has(courseId)) {
      newCollapsed.delete(courseId);
    } else {
      newCollapsed.add(courseId);
    }
    setCollapsedCourses(newCollapsed);
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
      loadAgendaData();
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  const addQuickTask = async (courseId: number, courseName: string) => {
    const title = prompt(`Add task for ${courseName}:`);
    if (!title) return;

    try {
      await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kidId,
          courseId,
          title,
          activityType: 'task',
          planDate: selectedDateStr,
        }),
      });
      loadAgendaData();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleDragStart = (item: any, type: 'activity' | 'course') => {
    setDraggedItem({ ...item, dragType: type });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = async (hour: number) => {
    if (!draggedItem) return;

    try {
      const startTime = new Date(selectedDate);
      startTime.setHours(hour, 0, 0, 0);

      if (draggedItem.dragType === 'activity') {
        // Schedule an activity by setting start_time
        await fetch('/api/activities', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityId: draggedItem.id,
            updates: {
              start_time: startTime.toISOString(),
              end_time: draggedItem.estimated_minutes
                ? new Date(startTime.getTime() + draggedItem.estimated_minutes * 60000).toISOString()
                : null
            },
          }),
        });
      } else if (draggedItem.dragType === 'course') {
        // Create a "work on course" event
        const title = prompt(`Work on ${draggedItem.course_name} - enter task name (optional):`);
        await fetch('/api/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kidId,
            courseId: draggedItem.id,
            title: title || `Work on ${draggedItem.course_name}`,
            activityType: 'task',
            planDate: selectedDateStr,
            startTime: startTime.toISOString(),
            estimatedMinutes: 60, // Default 1 hour
            isAction: true,
          }),
        });
      }

      setDraggedItem(null);
      loadAgendaData();
    } catch (error) {
      console.error('Error scheduling item:', error);
    }
  };

  const activeBucketItems = useMemo(() => {
    switch (activeBucket) {
      case 'today':
        return todayActivities;
      case 'current':
        return currentModuleActivities;
      case 'next':
        return nextModuleActivities;
      default:
        return overdueActivities;
    }
  }, [activeBucket, overdueActivities, todayActivities, currentModuleActivities, nextModuleActivities]);

  const groupedActivitiesByCourse = useMemo(() => {
    const groups: Record<string, { courseId: number; courseName: string; activities: any[] }> = {};

    (activeBucketItems || []).forEach((activity: any) => {
      const courseId = activity.course_id ?? 0;
      const courseName = activity.course_name || activity.course?.name || 'No course assigned';
      const key = `${courseId}`;

      if (!groups[key]) {
        groups[key] = { courseId, courseName, activities: [] };
      }
      groups[key].activities.push(activity);
    });

    const grouped = Object.values(groups);

    grouped.forEach((group) => {
      group.activities.sort((a: any, b: any) => {
        const moduleA = (a.module_title || '').toLowerCase();
        const moduleB = (b.module_title || '').toLowerCase();
        if (moduleA < moduleB) return -1;
        if (moduleA > moduleB) return 1;
        const titleA = (a.title || '').toLowerCase();
        const titleB = (b.title || '').toLowerCase();
        return titleA.localeCompare(titleB);
      });
    });

    return grouped.sort((a, b) => a.courseName.localeCompare(b.courseName));
  }, [activeBucketItems]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${c.checkboxChecked.split(' ')[0].replace('bg-', 'border-')}`}></div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${c.bg}`}>
      {/* Header */}
      <div className={`${c.cardBg} border-b ${c.divider} px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-2xl font-semibold ${c.moduleText}`}>Agenda</h1>
            <p className={`text-sm ${c.mutedText} mt-1`}>
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddActivityModalOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 ${c.checkboxChecked} text-white rounded-lg hover:opacity-90 transition-opacity`}
            >
              <Plus className="w-4 h-4" />
              Add Activity
            </button>
            <button
              onClick={() => setIsCourseModalOpen(true)}
              className={`flex items-center gap-2 px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText} ${c.cardBg} hover:opacity-80 transition-opacity`}
            >
              <GraduationCap className="w-4 h-4" />
              New Course
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Agenda Buckets (3/4 width) */}
        <div className={`w-3/4 border-r ${c.divider} overflow-y-auto p-4`}>
          <h2 className={`text-sm font-semibold ${c.moduleText} mb-3 flex items-center gap-2`}>
            <Calendar className={`w-4 h-4 ${c.moduleIcon}`} />
            My Agenda
          </h2>

          <div className="mb-4 rounded-2xl border bg-white/5 p-2 flex flex-wrap gap-2">
            {[
              { key: 'overdue', label: 'Overdue', count: overdueActivities.length },
              { key: 'today', label: 'Today', count: todayActivities.length },
              { key: 'current', label: 'Current module', count: currentModuleActivities.length },
              { key: 'next', label: 'Next module', count: nextModuleActivities.length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveBucket(tab.key as typeof activeBucket)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  activeBucket === tab.key
                    ? `${c.checkboxChecked} text-white`
                    : `${c.moduleText} border border-transparent hover:border-slate-300/40 hover:bg-slate-100/10`
                }`}
              >
                {tab.label}
                <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-200/80 px-2 text-xs font-semibold text-slate-700">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {(() => {
            const bucket = {
              overdue: {
                title: 'Overdue tasks',
                activities: overdueActivities,
                emptyText: 'No overdue tasks. Great job staying on track!',
                badgeColor: 'bg-red-500 text-white',
              },
              today: {
                title: 'Tasks planned for today',
                activities: todayActivities,
                emptyText: 'No tasks planned for today yet.',
                badgeColor: 'bg-blue-600 text-white',
              },
              current: {
                title: 'Tasks in current module',
                activities: currentModuleActivities,
                emptyText: 'No current module tasks found.',
                badgeColor: 'bg-emerald-600 text-white',
              },
              next: {
                title: 'Tasks in next module',
                activities: nextModuleActivities,
                emptyText: 'No upcoming module tasks yet.',
                badgeColor: 'bg-slate-600 text-white',
              },
            }[activeBucket];

            return (
              <div className={`border ${c.moduleBorder} rounded-2xl ${c.cardBg} p-4 space-y-3`}>
                {bucket.activities.length === 0 ? (
                  <div className={`rounded-xl border ${c.divider} p-4 text-sm ${c.mutedText}`}>
                    {bucket.emptyText}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedActivitiesByCourse.map((group) => {
                      const isExpanded = !collapsedCourses.has(group.courseId);
                      const moduleTitles = Array.from(
                        new Set(
                          group.activities
                            .map((activity) => activity.module_title)
                            .filter(Boolean)
                        )
                      );

                      return (
                        <div key={`${group.courseId}-${group.courseName}`} className="space-y-3">
                          <button
                            type="button"
                            onClick={() => toggleCourse(group.courseId)}
                            className={`w-full rounded-2xl border ${c.moduleBorder} bg-slate-50/50 p-3 text-left flex items-center justify-between gap-3`}
                          >
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{group.courseName}</div>
                              {moduleTitles.length > 0 && (
                                <div className="mt-1 text-[11px] text-slate-500">
                                  {moduleTitles.join(' • ')}
                                </div>
                              )}
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>

                          {isExpanded && (
                            <div className="space-y-2">
                              {group.activities.map((activity: any) => {
                                const planDate = activity.plan_date ? new Date(activity.plan_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                }) : null;

                                return (
                                  <button
                                    key={activity.id}
                                    onClick={() => openActivityModal(activity)}
                                    className={`w-full text-left rounded-xl border ${c.divider} p-3 ${c.activityHover} transition-colors hover:bg-opacity-10`}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <span className={`text-sm font-medium ${c.activityText}`}>{activity.title}</span>
                                      {planDate && (
                                        <span className="text-[11px] text-gray-500 tracking-wide">{planDate}</span>
                                      )}
                                    </div>
                                    <div className="mt-2 text-xs text-gray-500">
                                      {activity.module_title ? `Module: ${activity.module_title}` : 'No module'}
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                                      <span>{group.courseName || 'No course assigned'}</span>
                                      {activity.is_completed ? <span className="text-emerald-600 font-semibold">Done</span> : <span className="text-slate-700">Actionable</span>}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* RIGHT: Schedule (1/4 width) */}
        <div className={`w-1/4 overflow-y-auto p-4`}>
          <h2 className={`text-sm font-semibold ${c.moduleText} mb-3 flex items-center gap-2`}>
            <Clock className={`w-4 h-4 ${c.moduleIcon}`} />
            Schedule
          </h2>

          <div className="space-y-2">
            {timeSlots.map((hour) => {
              const classesAtHour = scheduledClasses.filter((cls: any) => {
                if (!cls.start_time) return false;
                const parsed = parseLocalTimestamp(cls.start_time);
                return parsed.hour === hour;
              });

              return (
                <div key={hour} className="flex gap-3">
                  <div className={`w-16 text-sm ${c.mutedText} pt-1`}>
                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                  </div>
                  <div
                    className={`flex-1 min-h-[60px] border-l-2 ${draggedItem ? 'border-blue-400' : 'border-gray-200'} pl-3 transition-colors`}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(hour)}
                  >
                    {classesAtHour.length === 0 && draggedItem && (
                      <div className={`p-2 text-xs ${c.mutedText} italic`}>
                        Drop here to schedule
                      </div>
                    )}
                    {classesAtHour.map((cls: any) => {
                      const startParsed = parseLocalTimestamp(cls.start_time);
                      const endParsed = cls.end_time ? parseLocalTimestamp(cls.end_time) : null;

                      const formatTime = (parsed: any) => {
                        if (!parsed.date) return '';
                        const hour12 = parsed.hour === 0 ? 12 : parsed.hour > 12 ? parsed.hour - 12 : parsed.hour;
                        const minute = parsed.minute.toString().padStart(2, '0');
                        const ampm = parsed.hour >= 12 ? 'PM' : 'AM';
                        return `${hour12}:${minute} ${ampm}`;
                      };

                      return (
                        <div
                          key={cls.id}
                          className={`p-2 rounded-lg ${c.checkboxChecked} text-white mb-2`}
                        >
                          <div className="font-medium text-sm">{cls.title}</div>
                          <div className="text-xs opacity-90">
                            {formatTime(startParsed)}
                            {endParsed && ` - ${formatTime(endParsed)}`}
                            {cls.estimated_minutes && ` (${cls.estimated_minutes}m)`}
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

      {/* Activity Modal */}
      <ActivityModal
        isOpen={isModalOpen}
        onClose={closeActivityModal}
        activity={selectedActivity}
        onSave={handleActivitySave}
        courses={courses.map(c => ({ id: c.id, name: c.name }))}
      />

      {/* Course Setup Modal */}
      <CourseSetupModal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        kidId={kidId}
        onSave={() => {
          setIsCourseModalOpen(false);
          loadAgendaData();
          // Notify MainLayout to reload courses
          window.dispatchEvent(new CustomEvent('courseCreated'));
        }}
      />

      {/* Activity Create Modal */}
      <ActivityCreateModal
        isOpen={isAddActivityModalOpen}
        onClose={() => setIsAddActivityModalOpen(false)}
        kidId={kidId}
        selectedDate={selectedDateStr}
        onSave={() => {
          setIsAddActivityModalOpen(false);
          loadAgendaData();
        }}
      />
    </div>
  );
}
