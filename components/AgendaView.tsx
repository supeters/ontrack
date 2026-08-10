'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle2, Plus, GraduationCap } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import ActivityModal from './ActivityModal';
import CourseSetupModal from './CourseSetupModal';
import ActivityCreateModal from './ActivityCreateModal';
import { parseLocalTimestamp } from '@/lib/datetime';

interface AgendaViewProps {
  kidId: number;
}

export default function AgendaView({ kidId }: AgendaViewProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [courses, setCourses] = useState<any[]>([]);
  const [scheduledClasses, setScheduledClasses] = useState<any[]>([]);
  const [expandedCourses, setExpandedCourses] = useState<Set<number>>(new Set());
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

  useEffect(() => {
    if (kidId) loadAgendaData();
  }, [kidId, selectedDate]);

  const loadAgendaData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agenda?kidId=${kidId}&date=${selectedDateStr}`);
      const data = await response.json();

      const courseMap = new Map();

      // Initialize all courses with scheduled_today flag from SQL
      data.courses?.forEach((course: any) => {
        courseMap.set(course.id, {
          ...course,
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

      // Show courses that are either scheduled today OR have activities
      const coursesToShow = Array.from(courseMap.values()).filter((course: any) => {
        const hasActivities = course.todayActivities.length > 0 || course.overdueActivities.length > 0;
        return course.scheduled_today || hasActivities;
      });

      setCourses(coursesToShow);

      // Combine scheduled classes (events) with scheduled activities (tasks with start_time)
      const scheduledActivities = data.today_activities?.filter((a: any) => a.start_time) || [];
      setScheduledClasses([...(data.scheduled_classes || []), ...scheduledActivities]);
    } catch (error) {
      console.error('Error loading agenda:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCourse = (courseId: number) => {
    const newExpanded = new Set(expandedCourses);
    if (newExpanded.has(courseId)) {
      newExpanded.delete(courseId);
    } else {
      newExpanded.add(courseId);
    }
    setExpandedCourses(newExpanded);
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

  const handleDragOver = (e: React.DragEvent) => {
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
            <input
              type="date"
              value={selectedDateStr}
              onChange={(e) => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
              className={`px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText} ${c.cardBg}`}
            />
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Courses & Tasks (3/4 width) */}
        <div className={`w-3/4 border-r ${c.divider} overflow-y-auto p-4`}>
          <h2 className={`text-sm font-semibold ${c.moduleText} mb-3 flex items-center gap-2`}>
            <Calendar className={`w-4 h-4 ${c.moduleIcon}`} />
            Courses & Tasks
          </h2>

          <div className="space-y-2">
            {courses.map((course) => {
              const allActivities = [...course.todayActivities, ...course.overdueActivities];
              const todayCompleted = course.todayActivities.filter((a: any) => a.is_completed).length;
              const todayPending = course.todayActivities.length - todayCompleted;
              const overdueCount = course.overdueActivities.length;
              const isExpanded = expandedCourses.has(course.id);

              // Course already filtered - show if scheduled today OR has activities

              return (
                <div
                  key={course.id}
                  className={`border ${c.moduleBorder} rounded-lg ${c.cardBg} overflow-hidden`}
                  draggable
                  onDragStart={() => handleDragStart(course, 'course')}
                >
                  <div className={`p-3 flex items-center justify-between ${c.moduleHeader} cursor-move`}>
                    <button
                      onClick={() => toggleCourse(course.id)}
                      className="flex-1 text-left"
                    >
                      <div className={`font-medium text-sm ${c.moduleText}`}>{course.course_name}</div>
                      <div className={`text-xs ${c.mutedText}`}>{course.subject}</div>
                    </button>
                    <div className="flex items-center gap-2">
                      <div className={`text-xs ${c.statText}`}>
                        {todayCompleted > 0 && (
                          <><span className="font-semibold text-green-600">{todayCompleted}</span> done{todayPending > 0 || overdueCount > 0 ? ', ' : ''}</>
                        )}
                        {todayPending > 0 && (
                          <><span className="font-semibold">{todayPending}</span> planned{overdueCount > 0 ? ', ' : ''}</>
                        )}
                        {todayCompleted === 0 && todayPending === 0 && overdueCount === 0 && (
                          <><span className="font-semibold">0</span> planned</>
                        )}
                        {overdueCount > 0 && (
                          <><span className="font-semibold text-red-500">{overdueCount}</span> overdue</>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addQuickTask(course.id, course.course_name);
                        }}
                        className={`p-1 rounded hover:bg-opacity-20 ${c.checkboxChecked.split(' ')[0]} transition-colors`}
                        title="Add quick task"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className={`border-t ${c.divider} ${c.workgroupBg}`}>
                      {allActivities.length === 0 ? (
                        <div className={`p-3 text-sm ${c.mutedText}`}>
                          No work planned
                        </div>
                      ) : (
                        allActivities.map((activity: any) => {
                          const isOverdue = course.overdueActivities.includes(activity);

                          return (
                            <div
                              key={activity.id}
                              draggable
                              onDragStart={() => handleDragStart(activity, 'activity')}
                              onClick={() => openActivityModal(activity)}
                              className={`w-full p-2 flex items-center gap-2 ${c.activityHover} border-b ${c.divider} last:border-0 hover:bg-opacity-10 transition-colors cursor-move`}
                            >
                              <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                  activity.is_completed ? c.checkboxChecked : c.checkboxBorder
                                }`}
                              >
                                {activity.is_completed && (
                                  <CheckCircle2 className="w-3 h-3 text-white" />
                                )}
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <span
                                  className={`text-sm block ${
                                    activity.is_completed ? 'line-through text-gray-400' : c.activityText
                                  }`}
                                >
                                  {activity.title}
                                </span>
                                {isOverdue && activity.plan_date && (
                                  <span className="text-[10px] text-red-500 mt-0.5 block">
                                    Due: {new Date(activity.plan_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
