'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Clock, CheckCircle2, Plus, GraduationCap, Trophy, ChevronDown, ChevronRight, AlertCircle, Calendar } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import ActivityDetailModal from './ActivityDetailModal';
import CourseSetupModal from './CourseSetupModal';
import ActivityCreateModal from './ActivityCreateModal';
import { parseLocalTimestamp, formatDateShort } from '@/lib/datetime';

interface AgendaViewProps {
  kidId: number;
  selectedDate: Date;
}

const TIMELINE_START_HOUR = 7;  // 7 AM
const TIMELINE_END_HOUR = 19;   // 7 PM
const HOUR_HEIGHT = 64;         // Pixels per hour slot

// Helper to format any Date or ISO string into YYYY-MM-DD locally
const toLocalYYYYMMDD = (d: Date | string) => {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AgendaView({ kidId, selectedDate }: AgendaViewProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [loading, setLoading] = useState(true);
  const [, setCourses] = useState<any[]>([]);
  const [overdueActivities, setOverdueActivities] = useState<any[]>([]);
  const [todayActivities, setTodayActivities] = useState<any[]>([]);
  
  const [nextModuleActivities, setNextModuleActivities] = useState<any[]>([]);
  const [completedActivities, setCompletedActivities] = useState<any[]>([]);
  const [scheduledClasses, setScheduledClasses] = useState<any[]>([]);
  
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isAddActivityModalOpen, setIsAddActivityModalOpen] = useState(false);

  const [isComingUpOpen, setIsComingUpOpen] = useState(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);

  // Strictly formatted local date string YYYY-MM-DD
  const selectedDateStr = useMemo(() => toLocalYYYYMMDD(selectedDate), [selectedDate]);

  const formattedHeaderDate = useMemo(() => {
    return selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedDate]);

  const loadAgendaData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agenda?kidId=${kidId}&date=${selectedDateStr}`);
      const data = await response.json();

      const courseMap = new Map();

      data.courses?.forEach((course: any) => {
        courseMap.set(course.id, {
          ...course,
          name: course.name || course.course_name || course.courseName || '',
          todayActivities: [],
          overdueActivities: [],
        });
      });

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
      
      setNextModuleActivities(data.next_module_activities || []);
      setCompletedActivities(data.completed_activities || []);

      const scheduledItems = [
        ...(data.scheduled_classes || []),
        ...(data.today_activities?.filter((a: any) => a.start_time) || [])
      ];

      const uniqueScheduledMap = new Map();
      scheduledItems.forEach((item) => {
        if (item && item.id) {
          uniqueScheduledMap.set(item.id, item);
        }
      });
      const uniqueScheduled = Array.from(uniqueScheduledMap.values());
      
      uniqueScheduled.sort((a, b) => {
        if (!a.start_time) return 1;
        if (!b.start_time) return -1;
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
      });

      setScheduledClasses(uniqueScheduled);
    } catch (error) {
      console.error('Error loading agenda:', error);
    } finally {
      setLoading(false);
    }
  }, [kidId, selectedDateStr]);

  useEffect(() => {
    if (kidId) loadAgendaData();
  }, [kidId, selectedDate, loadAgendaData]);

  const openActivityModal = (activity: any) => {
    setSelectedActivity(activity);
    setIsModalOpen(true);
  };

  const closeActivityModal = () => {
    setSelectedActivity(null);
    setIsModalOpen(false);
  };

  const handleActivityRefresh = () => {
    closeActivityModal();
    loadAgendaData();
  };

  // Fixed filter: compares local YYYY-MM-DD date strings properly
  const todaysScheduledEvents = useMemo(() => {
    return scheduledClasses.filter((ev) => {
      if (!ev.start_time) return false;
      const eventDateStr = toLocalYYYYMMDD(ev.start_time);
      return eventDateStr === selectedDateStr;
    });
  }, [scheduledClasses, selectedDateStr]);

  const hasScheduleToday = todaysScheduledEvents.length > 0;

  const focusActivities = useMemo(() => {
    const overdueWithFlag = (overdueActivities || []).map((a) => ({ ...a, isOverdue: true }));
    const todayWithFlag = (todayActivities || []).map((a) => ({ ...a, isOverdue: false }));

    const map = new Map<number | string, any>();
    [...overdueWithFlag, ...todayWithFlag].forEach((a) => {
      if (a && a.id && !map.has(a.id)) {
        map.set(a.id, a);
      }
    });

    return Array.from(map.values());
  }, [overdueActivities, todayActivities]);

  const comingUpActivities = useMemo(() => {
    return (nextModuleActivities || []);
  }, [nextModuleActivities]);

  const hoursArray = useMemo(() => {
    const hours = [];
    for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) {
      hours.push(h);
    }
    return hours;
  }, []);

  const getEventPosition = useCallback((ev: any) => {
    const startParsed = ev.start_time ? parseLocalTimestamp(ev.start_time) : null;
    const endParsed = ev.end_time ? parseLocalTimestamp(ev.end_time) : null;

    if (!startParsed) return null;

    const startMinutes = (startParsed.hour - TIMELINE_START_HOUR) * 60 + startParsed.minute;
    const top = (startMinutes / 60) * HOUR_HEIGHT;

    let durationMinutes = 60;
    if (endParsed) {
      const endMinutes = (endParsed.hour - TIMELINE_START_HOUR) * 60 + endParsed.minute;
      durationMinutes = Math.max(30, endMinutes - startMinutes);
    }

    const height = (durationMinutes / 60) * HOUR_HEIGHT;

    const formatTime = (parsed: any) => {
      if (!parsed) return '';
      const hour12 = parsed.hour === 0 ? 12 : parsed.hour > 12 ? parsed.hour - 12 : parsed.hour;
      const minute = parsed.minute.toString().padStart(2, '0');
      const ampm = parsed.hour >= 12 ? 'PM' : 'AM';
      return `${hour12}:${minute} ${ampm}`;
    };

    const timeLabel = `${formatTime(startParsed)}${endParsed ? ` - ${formatTime(endParsed)}` : ''}`;

    return { top, height, timeLabel };
  }, []);

  if (loading) {
    return (
      <div className={`flex h-full w-full items-center justify-center min-h-[400px] ${c.bg}`}>
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${c.checkboxChecked.split(' ')[0].replace('bg-', 'border-')}`}></div>
      </div>
    );
  }

  return (
    <div className={`w-full min-h-screen flex flex-col ${c.bg}`}>
      {/* Top Header */}
      <div className={`${c.cardBg} border-b ${c.divider} px-6 py-4 w-full`}>
        <div className="flex items-center justify-between max-w-[1600px] mx-auto w-full">
          <div>
            <h1 className={`text-2xl font-bold ${c.moduleText}`}>Agenda</h1>
            <p className={`font-semibold text-xs mt-0.5 ${c.moduleIcon}`}>
              {formattedHeaderDate}
            </p>
          </div>
          <div className="flex gap-2.5 items-center">
            <button
              onClick={() => setIsAddActivityModalOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 ${c.checkboxChecked} text-white rounded-lg hover:opacity-90 transition-opacity text-xs font-semibold shadow-xs`}
            >
              <Plus className="h-4 w-4" />
              Add Activity
            </button>
            <button
              onClick={() => setIsCourseModalOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 border ${c.moduleBorder} rounded-lg text-xs font-semibold ${c.moduleText} ${c.cardBg} hover:opacity-80 transition-opacity shadow-xs`}
            >
              <GraduationCap className="h-4 w-4" />
              New Course
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 p-6 w-full">
        <div className="gap-6 grid grid-cols-1 items-start lg:grid-cols-12 max-w-[1600px] mx-auto w-full">

          {/* Left Column: Timeline */}
          {hasScheduleToday && (
            <div className="lg:col-span-4 space-y-3 w-full">
              <div className="flex items-center justify-between px-1">
                <span className={`text-xs font-bold uppercase tracking-wider ${c.moduleText} flex gap-1.5 items-center`}>
                  <Clock className={`h-4 w-4 ${c.moduleIcon}`} />
                  Schedule (7 AM – 7 PM)
                </span>
                <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${c.workgroupBg} ${c.workgroupText} border ${c.moduleBorder}`}>
                  {todaysScheduledEvents.length} Events
                </span>
              </div>

              <div className={`rounded-xl border ${c.moduleBorder} ${c.cardBg} p-4 shadow-xs relative w-full overflow-hidden`}>
                <div 
                  className="relative w-full" 
                  style={{ height: `${(TIMELINE_END_HOUR - TIMELINE_START_HOUR) * HOUR_HEIGHT}px` }}
                >
                  {/* Hourly Lines */}
                  {hoursArray.map((hour, idx) => {
                    if (hour === TIMELINE_END_HOUR) return null;
                    const displayHour = hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
                    const topPos = idx * HOUR_HEIGHT;

                    return (
                      <div
                        key={hour}
                        className={`absolute left-0 right-0 border-t ${c.divider} flex items-start`}
                        style={{ top: `${topPos}px`, height: `${HOUR_HEIGHT}px` }}
                      >
                        <span className={`text-[11px] font-medium ${c.mutedText} w-14 shrink-0 pt-0.5 select-none`}>
                          {displayHour}
                        </span>
                        <div className={`flex-1 border-t border-dashed ${c.divider} mt-2.5 opacity-60`} />
                      </div>
                    );
                  })}

                  {/* Today's Scheduled Event Cards */}
                  {todaysScheduledEvents.map((ev: any) => {
                    const pos = getEventPosition(ev);
                    if (!pos) return null;

                    return (
                      <button
                        key={ev.id}
                        onClick={() => openActivityModal(ev)}
                        className={`absolute left-14 right-0 rounded-lg border ${c.moduleBorder} ${c.workgroupBg} ${c.activityHover} transition-all p-2.5 text-left shadow-2xs flex flex-col justify-between overflow-hidden z-10`}
                        style={{
                          top: `${pos.top}px`,
                          height: `${Math.max(pos.height - 4, 38)}px`,
                        }}
                      >
                        <div className="min-w-0">
                          <div className={`text-xs font-bold ${c.activityText} truncate leading-tight`}>
                            {ev.title}
                          </div>
                          <div className={`text-[10px] font-medium ${c.statText} truncate mt-0.5`}>
                            {ev.course_name || 'Class'}
                          </div>
                        </div>
                        <div className={`text-[10px] font-semibold ${c.moduleIcon} shrink-0`}>
                          {pos.timeLabel}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Right Column: Cards */}
          <div className={`${hasScheduleToday ? 'lg:col-span-8' : 'lg:col-span-12'} w-full space-y-5 transition-all duration-200`}>

            {/* Upcoming Scheduled Events Banner */}
            {!hasScheduleToday && scheduledClasses.length > 0 && (
              <div className={`rounded-xl border ${c.moduleBorder} ${c.cardBg} p-4 shadow-xs w-full`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-bold uppercase tracking-wider ${c.moduleText} flex gap-1.5 items-center`}>
                    <Calendar className={`h-4 w-4 ${c.moduleIcon}`} />
                    Upcoming Scheduled Events
                  </span>
                  <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${c.workgroupBg} ${c.workgroupText} border ${c.moduleBorder}`}>
                    {scheduledClasses.length}
                  </span>
                </div>

                <div className="gap-2.5 grid grid-cols-1 lg:grid-cols-3 sm:grid-cols-2">
                  {scheduledClasses.slice(0, 3).map((ev) => {
                    const pos = getEventPosition(ev);
                    const eventDate = ev.start_time ? formatDateShort(ev.start_time) : null;

                    return (
                      <button
                        key={ev.id}
                        onClick={() => openActivityModal(ev)}
                        className={`w-full text-left rounded-lg border ${c.divider} ${c.workgroupBg} p-3 ${c.activityHover} transition-all flex flex-col justify-between space-y-2`}
                      >
                        <div className="min-w-0">
                          <p className={`text-xs font-bold ${c.activityText} truncate`}>{ev.title}</p>
                          <p className={`text-[11px] ${c.statText} truncate mt-0.5`}>{ev.course_name || 'Class'}</p>
                        </div>
                        <div className="flex font-semibold items-center justify-between text-[10px]">
                          <span className={`${c.moduleIcon}`}>{pos?.timeLabel}</span>
                          {eventDate && <span className={`${c.mutedText}`}>{eventDate}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Today's Focus */}
            <div className="space-y-3 w-full">
              <div className="flex items-center justify-between px-1">
                <span className={`text-xs font-bold uppercase tracking-wider ${c.moduleText} flex gap-1.5 items-center`}>
                  <CheckCircle2 className={`h-4 w-4 ${c.moduleIcon}`} />
                  Today's Focus
                </span>
                <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${c.workgroupBg} ${c.workgroupText} border ${c.moduleBorder}`}>
                  {focusActivities.length}
                </span>
              </div>

              <div className={`rounded-xl border ${c.moduleBorder} ${c.cardBg} p-4 space-y-2 shadow-xs w-full`}>
                {focusActivities.length === 0 ? (
                  <div className={`text-xs ${c.mutedText} py-6 text-center space-y-1`}>
                    <p className={`font-semibold text-sm ${c.moduleText}`}>🎉 All caught up for today!</p>
                    <p className={`text-xs ${c.statText}`}>No active focus tasks due right now.</p>
                  </div>
                ) : (
                  focusActivities.map((activity: any) => {
                    const planDate = activity.plan_date ? formatDateShort(activity.plan_date) : null;
                    const courseModuleText = [activity.course_name, activity.module_title]
                      .filter(Boolean)
                      .join(' • ');

                    return (
                      <button
                        key={activity.id}
                        onClick={() => openActivityModal(activity)}
                        className={`w-full text-left rounded-lg border ${c.divider} ${c.workgroupBg} px-3.5 py-3 ${c.activityHover} transition-all flex items-center justify-between gap-4`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex gap-2 items-center">
                            {activity.isOverdue && (
                              <span className="bg-rose-100 border border-rose-300 dark:bg-rose-950/80 dark:border-rose-800 dark:text-rose-200 flex font-bold gap-0.5 items-center px-1.5 py-0.5 rounded shrink-0 text-[9px] text-rose-800 uppercase">
                                <AlertCircle className="h-3 w-3" /> Overdue
                              </span>
                            )}
                            <span className={`text-xs font-semibold ${c.activityText} truncate`}>{activity.title}</span>
                          </div>
                          {courseModuleText && (
                            <div className={`text-xs ${c.statText} truncate mt-0.5`}>
                              {courseModuleText}
                            </div>
                          )}
                        </div>

                        {planDate && (
                          <div className={`font-medium shrink-0 text-right text-xs ${c.mutedText}`}>
                            {planDate}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* On the Horizon */}
            <div className={`rounded-xl border ${c.moduleBorder} ${c.cardBg} overflow-hidden shadow-xs w-full`}>
              <button
                onClick={() => setIsComingUpOpen(!isComingUpOpen)}
                className="flex hover:opacity-90 items-center justify-between p-4 text-left transition-opacity w-full"
              >
                <div className="flex gap-2 items-center">
                  <Clock className={`h-4 w-4 ${c.moduleIcon}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${c.moduleText}`}>On the Horizon</span>
                  <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${c.workgroupBg} ${c.workgroupText} border ${c.moduleBorder}`}>
                    {comingUpActivities.length}
                  </span>
                </div>
                {isComingUpOpen ? <ChevronDown className={`h-4 w-4 ${c.mutedText}`} /> : <ChevronRight className={`h-4 w-4 ${c.mutedText}`} />}
              </button>

              {isComingUpOpen && (
                <div className={`p-4 pt-0 border-t ${c.divider} space-y-2 mt-1`}>
                  {comingUpActivities.length === 0 ? (
                    <div className={`text-xs ${c.mutedText} py-3 text-center`}>No upcoming items scheduled for the next 10 days.</div>
                  ) : (
                    comingUpActivities.map((activity) => {
                      const planDate = activity.plan_date ? formatDateShort(activity.plan_date) : null;
                      return (
                        <button
                          key={activity.id}
                          onClick={() => openActivityModal(activity)}
                          className={`w-full text-left rounded-lg border ${c.divider} ${c.workgroupBg} px-3.5 py-2.5 ${c.activityHover} transition-all flex items-center justify-between gap-2`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${c.activityText} truncate`}>{activity.title}</p>
                            <p className={`text-xs ${c.statText} truncate mt-0.5`}>
                              {activity.course_name || 'General'}
                            </p>
                          </div>
                          {planDate && (
                            <span className={`font-medium px-2 py-0.5 rounded shrink-0 text-xs ${c.mutedText}`}>
                              {planDate}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Trophy Case */}
            <div className={`rounded-xl border ${c.moduleBorder} ${c.cardBg} overflow-hidden shadow-xs w-full`}>
              <button
                onClick={() => setIsCompletedOpen(!isCompletedOpen)}
                className="flex hover:opacity-90 items-center justify-between p-4 text-left transition-opacity w-full"
              >
                <div className="flex gap-2 items-center">
                  <Trophy className={`h-4 w-4 ${c.moduleIcon}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${c.moduleText}`}>Trophy Case</span>
                  <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${c.workgroupBg} ${c.workgroupText} border ${c.moduleBorder}`}>
                    {completedActivities.length} Cleared
                  </span>
                </div>
                {isCompletedOpen ? <ChevronDown className={`h-4 w-4 ${c.mutedText}`} /> : <ChevronRight className={`h-4 w-4 ${c.mutedText}`} />}
              </button>

              {isCompletedOpen && (
                <div className={`p-4 pt-0 border-t ${c.divider} space-y-2 mt-1`}>
                  {completedActivities.length === 0 ? (
                    <div className={`text-xs ${c.mutedText} py-3 text-center`}>No completed tasks for this view yet. Keep going! 🏆</div>
                  ) : (
                    completedActivities.map((activity) => (
                      <div
                        key={activity.id}
                        onClick={() => openActivityModal(activity)}
                        className={`w-full flex items-center justify-between rounded-lg border ${c.divider} ${c.workgroupBg} px-3.5 py-2.5 cursor-pointer hover:opacity-90 transition-all`}
                      >
                        <div className="flex gap-2 items-center min-w-0">
                          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${c.moduleIcon}`} />
                          <span className={`line-through ${c.mutedText} text-xs truncate`}>{activity.title}</span>
                        </div>
                        <span className={`ml-2 shrink-0 text-xs ${c.statText}`}>{activity.course_name}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* Modals */}
      {isModalOpen && selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={closeActivityModal}
          onSave={handleActivityRefresh}
          onUpdate={handleActivityRefresh}
        />
      )}

      <CourseSetupModal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        kidId={kidId}
        onSave={() => {
          setIsCourseModalOpen(false);
          loadAgendaData();
          window.dispatchEvent(new CustomEvent('courseCreated'));
        }}
      />

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