'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import React from 'react';
import {
  Clock,
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Play,
  Pause,
  Check,
  Sparkles,
  Flame,
  Star,
  ArrowRight,
  ChevronsRight,
  ChevronsLeft,
  AlertCircle,
  LayoutGrid,
  CalendarDays
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import ActivityDetailModal from './ActivityDetailModal';
import CourseSetupModal from './CourseSetupModal';
import ActivityCreateModal from './ActivityCreateModal';
import {
  getDateStr,
  formatDateLocal,
  formatTimestampLocal,
  parseLocalTimestamp,
} from '@/lib/datetime';

interface CalendarFeed {
  id: number;
  kid_id: number;
  name: string;
  url: string;
}

interface AgendaViewProps {
  kidId: number;
  selectedDate: Date;
  selectedSchoolYear?: string;
}

export default function AgendaView({ kidId, selectedDate, selectedSchoolYear }: AgendaViewProps) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};

  // Map theme tokens directly using exact properties from ThemeColors
  const c = {
    ...colors,
    bgPrimary: colors.bg || 'bg-[#f7f0e6]',
    cardBg: colors.cardBg || 'bg-[#fdfbf7]',
    textPrimary: colors.text || 'text-[#3b2d18]',
    mutedText: colors.mutedText || 'text-[#806a49]',
    statText: colors.statText || 'text-[#614d2e]',
    card: colors.card || 'bg-[#fdfbf7] border border-[#d8c3a5]',
    
    // Header & Module tokens
    moduleHeader: colors.moduleHeader || 'bg-[#ebdec9] hover:bg-[#dfceb3]',
    moduleText: colors.moduleText || 'text-[#3b2d18]',
    moduleIcon: colors.moduleIcon || 'text-[#a86c23]',
    moduleBorder: colors.moduleBorder || 'border-[#d8c3a5]',

    // Workgroup / Event Bar tokens
    workgroupBg: colors.workgroupBg || 'bg-[#f9f3e9]',
    workgroupHeader: colors.workgroupHeader || 'bg-[#f2e6d2] hover:bg-[#ebd8bc]',
    workgroupText: colors.workgroupText || 'text-[#2c200e]',
    workgroupIcon: colors.workgroupIcon || 'text-[#8a5312]',

    // Interactive & Checkbox tokens
    checkboxChecked: colors.checkboxChecked || 'bg-[#a86c23] border-[#a86c23]',
    checkboxBorder: colors.checkboxBorder || 'border-[#c2a176] group-hover:border-[#a86c23]',
    activityHover: colors.activityHover || 'hover:bg-[#f2e6d2] hover:border-[#c2a176]',
    activityText: colors.activityText || 'text-[#3b2d18]',

    // Divider & Fallbacks
    divider: colors.divider || 'divide-[#e3d3ba] border-[#e3d3ba]',
    dangerBg: 'bg-red-50',
    dangerBorder: 'border-red-200',
    dangerText: 'text-red-800',
    successBg: 'bg-emerald-50',
    successText: 'text-emerald-800',
    success: '#22c55e',
  };

  const [loading, setLoading] = useState(true);
  const [overdueActivities, setOverdueActivities] = useState<any[]>([]);
  const [todayActivities, setTodayActivities] = useState<any[]>([]);
  const [nextModuleActivities, setNextModuleActivities] = useState<any[]>([]);
  const [completedActivities, setCompletedActivities] = useState<any[]>([]);
  const [scheduledClasses, setScheduledClasses] = useState<any[]>([]);

  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [icalEvents, setIcalEvents] = useState<any[]>([]);
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);

  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isAddActivityModalOpen, setIsAddActivityModalOpen] = useState(false);

  const [todayWorkChunks, setTodayWorkChunks] = useState<any[]>([]);
  const [isWorkChunksModalOpen, setIsWorkChunksModalOpen] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set());
  const [activityChildren, setActivityChildren] = useState<Record<number, any[]>>({});

  // Pagination state for schedule items
  const [schedulePageIndex, setSchedulePageIndex] = useState(0);
  const pageSize = 4;

  const selectedDateStr = useMemo(() => formatDateLocal(selectedDate), [selectedDate]);

  const formattedHeaderDate = useMemo(() => {
    const dateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
    if (isNaN(dateObj.getTime())) return '';

    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedDate]);

  const loadAgendaData = useCallback(async () => {
    if (!kidId) return;
    setLoading(true);
    try {
      // Get today's date in user's timezone (YYYY-MM-DD format)
      const today = new Date();
      const currentDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const yearParam = selectedSchoolYear ? `&academicYear=${encodeURIComponent(selectedSchoolYear)}` : '';
      const agendaRes = await fetch(`/api/agenda?kidId=${kidId}&date=${selectedDateStr}&currentDate=${currentDateStr}${yearParam}`);
      const data = await agendaRes.json();

      setOverdueActivities(data.overdue_activities || []);
      setTodayActivities(data.today_activities || []);
      setNextModuleActivities(data.next_module_activities ?? data[Object.keys(data)[4]] ?? []);
      setCompletedActivities(data.completed_activities ?? data[Object.keys(data)[5]] ?? []);
      setScheduledClasses(data.scheduled_classes || []);

      const feedsRes = await fetch(`/api/calendars/ical?kidId=${kidId}`);
      const feedsData = await feedsRes.json();
      const currentFeeds: CalendarFeed[] = feedsData.feeds || [];
      setFeeds(currentFeeds);

      const googleStatusRes = await fetch(`/api/auth/google/status?kidId=${kidId}`);
      const googleStatus = await googleStatusRes.json();
      setGoogleConnected(googleStatus.connected || false);

      const googleEventsPromise = googleStatus.connected
        ? fetch(`/api/calendars/google/events?kidId=${kidId}&startDate=${selectedDateStr}&endDate=${selectedDateStr}`)
            .then((res) => res.json())
            .then((data) => (data.events || []).map((e: any) => ({ ...e, is_google: true })))
            .catch(() => [])
        : Promise.resolve([]);

      const icalPromises = currentFeeds.map((feed) =>
        fetch(`/api/calendars/ical/parse?url=${encodeURIComponent(feed.url)}`)
          .then((res) => res.json())
          .then((parsed) =>
            (parsed.events || []).map((e: any) => ({
              ...e,
              feedName: feed.name,
              is_ical: true,
            }))
          )
          .catch(() => [])
      );

      const [googleEventsData, ...parsedIcalResults] = await Promise.all([
        googleEventsPromise,
        ...icalPromises,
      ]);

      setGoogleEvents(googleEventsData);
      setIcalEvents(parsedIcalResults.flat());

      const chunksRes = await fetch(`/api/analytics?kidId=${kidId}&startDate=${selectedDateStr}&endDate=${selectedDateStr}`);
      if (chunksRes.ok) {
        const chunksData = await chunksRes.json();
        setTodayWorkChunks(chunksData.chunks || []);
      }
    } catch (error) {
      console.error('Error loading agenda data:', error);
    } finally {
      setLoading(false);
    }
  }, [kidId, selectedDateStr, selectedSchoolYear]);

  useEffect(() => {
    loadAgendaData();
    setSchedulePageIndex(0);
  }, [kidId, selectedDate, loadAgendaData]);

  const openActivityModal = (activity: any) => {
    if (activity.is_ical) return;
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

  const courseGroups = useMemo(() => {
    const groups = new Map<string, any[]>();

    const allTodayActivities = [
      ...(overdueActivities || []).map((a) => ({ ...a, isOverdue: true })),
      ...(todayActivities || []),
      ...(completedActivities || [])
    ];

    allTodayActivities.forEach((activity) => {
      const courseName = activity.course_name || activity.course?.name || 'General';
      if (!groups.has(courseName)) {
        groups.set(courseName, []);
      }
      groups.get(courseName)!.push(activity);
    });

    return Array.from(groups.entries())
      .map(([courseName, tasks]) => {
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.is_completed).length;
        const hasOverdue = tasks.some(t => t.isOverdue && !t.is_completed);

        return {
          courseName,
          tasks,
          totalTasks,
          completedTasks,
          allComplete: completedTasks === totalTasks,
          hasOverdue,
        };
      })
      .sort((a, b) => {
        if (a.hasOverdue && !b.hasOverdue) return -1;
        if (!a.hasOverdue && b.hasOverdue) return 1;
        return a.courseName.localeCompare(b.courseName);
      });
  }, [overdueActivities, todayActivities, completedActivities]);

  const todaysAscendingEvents = useMemo(() => {
    const todayStr = selectedDateStr;
    const currentDayEvents: any[] = [];

    (scheduledClasses || []).forEach((ev) => {
      if (!ev.start_time) return;
      if (getDateStr(ev.start_time) === todayStr) {
        currentDayEvents.push(ev);
      }
    });

    (icalEvents || []).forEach((ev) => {
      if (!ev.start_time) return;
      if (getDateStr(ev.start_time) === todayStr) {
        currentDayEvents.push(ev);
      }
    });

    (googleEvents || []).forEach((ev) => {
      if (!ev.start_time) return;
      if (getDateStr(ev.start_time) === todayStr) {
        currentDayEvents.push({ ...ev, is_google: true });
      }
    });

    return currentDayEvents.sort((a, b) => {
      const timeA = new Date(a.start_time.replace(' ', 'T')).getTime();
      const timeB = new Date(b.start_time.replace(' ', 'T')).getTime();
      return timeA - timeB;
    });
  }, [scheduledClasses, icalEvents, googleEvents, selectedDateStr]);

  const visibleScheduleEvents = useMemo(() => {
    const start = schedulePageIndex * pageSize;
    return todaysAscendingEvents.slice(start, start + pageSize);
  }, [todaysAscendingEvents, schedulePageIndex, pageSize]);

  const hasMoreNext = (schedulePageIndex + 1) * pageSize < todaysAscendingEvents.length;
  const hasMorePrev = schedulePageIndex > 0;

  const handleStartWork = async (activity: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Create a new work chunk
      await fetch('/api/work-chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: activity.id,
          kid_id: kidId,
          start_time: new Date().toISOString(),
          is_active: true,
          is_manual: false,
          minutes_worked: 0,
        }),
      });

      // Update activity to mark as in progress
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          updates: { start_time: formatTimestampLocal(new Date()) },
        }),
      });

      await loadAgendaData();
    } catch (error) {
      console.error('Error starting work:', error);
    }
  };

  const handlePauseWork = async (activity: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Get active work chunk
      const chunksRes = await fetch(`/api/work-chunks?activity_id=${activity.id}&is_active=true`);
      const chunksData = await chunksRes.json();
      const activeChunk = chunksData.chunks?.[0];

      if (activeChunk) {
        // Calculate minutes worked
        const startTime = new Date(activeChunk.start_time);
        const endTime = new Date();
        const minutesWorked = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000));

        // Stop the work chunk
        await fetch('/api/work-chunks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chunkId: activeChunk.id,
            updates: {
              end_time: new Date().toISOString(),
              is_active: false,
              minutes_worked: minutesWorked,
            },
          }),
        });
      }

      // Clear activity start_time
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          updates: { start_time: null },
        }),
      });

      await loadAgendaData();
    } catch (error) {
      console.error('Error pausing work:', error);
    }
  };

  const handleCompleteWork = async (activity: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const nowTimestamp = formatTimestampLocal(new Date());

    try {
      // First, stop any active work chunk
      const chunksRes = await fetch(`/api/work-chunks?activity_id=${activity.id}&is_active=true`);
      const chunksData = await chunksRes.json();
      const activeChunk = chunksData.chunks?.[0];

      let calculatedActualMinutes = activity.actual_minutes;

      if (activeChunk) {
        // Calculate minutes worked
        const startTime = new Date(activeChunk.start_time);
        const endTime = new Date();
        const minutesWorked = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000));

        // Stop the work chunk
        await fetch('/api/work-chunks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chunkId: activeChunk.id,
            updates: {
              end_time: new Date().toISOString(),
              is_active: false,
              minutes_worked: minutesWorked,
            },
          }),
        });

        calculatedActualMinutes = minutesWorked;
      }

      // Mark activity as complete
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          updates: {
            is_completed: true,
            completed_at: nowTimestamp,
            end_time: nowTimestamp,
            start_time: null,
            actual_minutes: calculatedActualMinutes,
          },
        }),
      });
      await loadAgendaData();
    } catch (error) {
      console.error('Error completing work:', error);
    }
  };

  const loadActivityChildren = async (activityId: number) => {
    try {
      const response = await fetch(`/api/activities?parent_id=${activityId}`);
      if (response.ok) {
        const data = await response.json();
        const tasks = data.filter((child: any) => child.activity_type === 'task');
        setActivityChildren(prev => ({ ...prev, [activityId]: tasks }));
        return tasks;
      }
    } catch (error) {
      console.error('Error loading activity children:', error);
    }
    return [];
  };

  const toggleActivityExpansion = async (activityId: number) => {
    const isExpanded = expandedActivities.has(activityId);
    const newExpanded = new Set(expandedActivities);

    if (isExpanded) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
      // Load children if not already loaded
      if (!activityChildren[activityId]) {
        await loadActivityChildren(activityId);
      }
    }

    setExpandedActivities(newExpanded);
  };

  const handleToggleChildTask = async (childId: number, currentCompleted: boolean, parentActivityId: number) => {
    const nowTimestamp = formatTimestampLocal(new Date());

    try {
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: childId,
          updates: {
            is_completed: !currentCompleted,
            completed_at: !currentCompleted ? nowTimestamp : null,
          },
        }),
      });

      // Reload children for this parent
      await loadActivityChildren(parentActivityId);
      await loadAgendaData();
    } catch (error) {
      console.error('Error toggling child task:', error);
    }
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatEventTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString.replace(' ', 'T'));
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const todayTotalMinutes = todayWorkChunks.reduce((sum, chunk) => {
    if (chunk.minutes_worked) return sum + chunk.minutes_worked;
    if (chunk.start_time && chunk.end_time) {
      const start = new Date(chunk.start_time);
      const end = new Date(chunk.end_time);
      return sum + Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    }
    return sum;
  }, 0);

  if (loading) {
    return (
      <div className={`flex h-full items-center justify-center min-h-[400px] w-full ${c.bgPrimary}`}>
        <div className={`animate-spin border-4 border-b-current border-l-current border-r-current border-t-transparent h-10 rounded-full w-10 ${c.moduleIcon}`} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-screen w-full ${c.bgPrimary} ${c.textPrimary}`}>
      {/* Outer Header Bar matching outer theme background */}
      <div className={`px-6 py-4 ${c.bgPrimary}`}>
        <div className="flex items-center justify-between max-w-[1500px] mx-auto w-full">
          <div className="flex gap-3 items-center">
            <div className={`p-2 rounded-2xl ${c.moduleHeader}`}>
              <Sparkles className={`h-6 w-6 ${c.moduleIcon}`} />
            </div>
            <div>
              <h1 className={`font-extrabold text-xl tracking-tight ${c.moduleText}`}>
                {formattedHeaderDate}
              </h1>
              <p className={`font-medium text-xs ${c.mutedText}`}>
                Ready to tackle today's goals?
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 items-center">
            {todayWorkChunks.length > 0 && (
              <button
                onClick={() => setIsWorkChunksModalOpen(true)}
                className={`border flex font-bold gap-2 items-center px-3.5 py-2 rounded-xl text-xs transition-all ${c.moduleHeader} ${c.moduleBorder} ${c.moduleText}`}
              >
                <Flame className={`fill-current h-4 w-4 ${c.moduleIcon}`} />
                <span>{formatTime(todayTotalMinutes)} Worked</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-[1500px] mx-auto p-6 space-y-5 w-full">

        {/* Schedule Bar */}
        {todaysAscendingEvents.length > 0 && (
          <div className={`border flex flex-col gap-2.5 p-3.5 rounded-2xl shadow-2xs transition-colors w-full ${c.card}`}>
            <div className="flex items-center justify-between">
              <div className="flex gap-2 items-center">
                <Calendar className={`h-4 w-4 ${c.moduleIcon}`} />
                <h2 className={`font-extrabold text-xs tracking-wider uppercase ${c.textPrimary}`}>
                  Schedule
                </h2>
              </div>
              
              {todaysAscendingEvents.length > pageSize && (
                <span className={`font-bold text-[10px] ${c.statText}`}>
                  Showing {schedulePageIndex * pageSize + 1}-
                  {Math.min((schedulePageIndex + 1) * pageSize, todaysAscendingEvents.length)} of {todaysAscendingEvents.length}
                </span>
              )}
            </div>

            <div className="flex gap-2 items-center overflow-hidden w-full">
              {/* Prev Button */}
              {hasMorePrev && (
                <button
                  onClick={() => setSchedulePageIndex(prev => prev - 1)}
                  className={`border flex font-bold gap-1 hover:opacity-90 items-center px-2 py-1.5 rounded-xl shrink-0 text-xs transition-all ${c.moduleHeader} ${c.moduleBorder} ${c.moduleText}`}
                  title="Previous events"
                >
                  <ChevronsLeft className={`h-4 w-4 ${c.moduleIcon}`} />
                </button>
              )}

              {/* Sequential Event List */}
              {visibleScheduleEvents.map((ev, idx) => {
                const startTime = formatEventTime(ev.start_time);
                const endTime = formatEventTime(ev.end_time);
                const isLastVisible = idx === visibleScheduleEvents.length - 1;

                return (
                  <div key={ev.id || ev.title || idx} className="flex flex-1 gap-2 items-center min-w-0">
                    <div
                      onClick={() => openActivityModal(ev)}
                      className={`border cursor-pointer flex gap-2 hover:shadow-2xs items-center min-w-0 px-2.5 py-1.5 rounded-xl transition-all w-full ${c.workgroupBg} ${c.moduleBorder}`}
                    >
                      <span className={`font-bold px-1.5 py-0.5 rounded-md shrink-0 text-[10px] whitespace-nowrap ${c.moduleHeader} ${c.moduleText}`}>
                        {startTime}
                      </span>

                      <span className={`font-bold text-xs truncate ${c.workgroupText}`}>
                        {ev.title}
                      </span>

                      {endTime && (
                        <span className={`font-semibold shrink-0 text-[10px] whitespace-nowrap ${c.mutedText}`}>
                          – {endTime}
                        </span>
                      )}
                    </div>

                    {(!isLastVisible || hasMoreNext) && (
                      <ArrowRight className={`h-3.5 opacity-40 shrink-0 w-3.5 ${c.mutedText}`} />
                    )}
                  </div>
                );
              })}

              {/* Next Button */}
              {hasMoreNext && (
                <button
                  onClick={() => setSchedulePageIndex(prev => prev + 1)}
                  className={`border flex font-bold gap-1 hover:opacity-90 items-center px-2.5 py-1.5 rounded-xl shrink-0 text-xs transition-all ${c.moduleHeader} ${c.moduleBorder} ${c.moduleText}`}
                  title="Next events"
                >
                  <ChevronsRight className={`h-4 w-4 ${c.moduleIcon}`} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Course Grid with Equal Height Alignment */}
        {courseGroups.length === 0 ? (
          <div className={`border-2 border-dashed py-16 rounded-2xl text-center transition-colors ${c.card}`}>
            <Star className="animate-bounce h-10 mb-2 mx-auto text-amber-500 w-10" />
            <p className={`font-bold text-base ${c.textPrimary}`}>All caught up!</p>
            <p className={`mt-0.5 text-xs ${c.mutedText}`}>No school assignments scheduled for today.</p>
          </div>
        ) : (
          <div className="gap-4 grid grid-cols-1 items-stretch lg:grid-cols-3 md:grid-cols-2">
            {courseGroups.map((group) => {
              const isExpanded = expandedCourses.has(group.courseName) || true;
              const toggleExpand = () => {
                const newSet = new Set(expandedCourses);
                if (newSet.has(group.courseName)) {
                  newSet.delete(group.courseName);
                } else {
                  newSet.add(group.courseName);
                }
                setExpandedCourses(newSet);
              };

              return (
                <div
                  key={group.courseName}
                  className={`border flex flex-col h-full overflow-hidden rounded-2xl transition-all ${c.card}`}
                >
                  <button
                    onClick={toggleExpand}
                    className={`border-b flex gap-2 hover:opacity-95 items-center justify-between p-3.5 shrink-0 transition-opacity w-full ${c.workgroupHeader} ${c.moduleBorder}`}
                  >
                    <div className="flex gap-2.5 items-center min-w-0">
                      <div className={`p-1.5 rounded-lg shadow-2xs shrink-0 ${c.cardBg}`}>
                        <BookOpen className={`h-4 w-4 ${c.workgroupIcon}`} />
                      </div>
                      <span className={`font-extrabold text-left text-xs truncate ${c.workgroupText}`}>
                        {group.courseName}
                      </span>
                    </div>

                    <div className="flex gap-2 items-center shrink-0">
                      {group.allComplete ? (
                        <span className={`flex font-bold gap-1 items-center px-2 py-0.5 rounded-full shadow-2xs text-[10px] ${c.successBg} ${c.successText}`}>
                          <CheckCircle2 className="h-3 w-3" /> Done
                        </span>
                      ) : (
                        <span className={`border font-bold px-2 py-0.5 rounded-full text-[10px] ${c.cardBg} ${c.statText} ${c.moduleBorder}`}>
                          {group.completedTasks}/{group.totalTasks}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className={`h-4 w-4 ${c.mutedText}`} />
                      ) : (
                        <ChevronDown className={`h-4 w-4 ${c.mutedText}`} />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className={`flex flex-1 flex-col justify-start p-3 space-y-2 transition-colors ${c.cardBg}`}>
                      {group.tasks.map((activity) => {
                        const isWorking = Boolean(activity.start_time);
                        const isOverdue = activity.isOverdue && !activity.is_completed;
                        const isCompleted = activity.is_completed;

                        // Use child_tasks from SQL if available, otherwise fallback to activityChildren state
                        const children = activity.child_tasks || activityChildren[activity.id] || [];
                        const hasTaskChildren = children.length > 0;
                        const isExpanded = expandedActivities.has(activity.id);

                        return (
                          <div key={activity.id} className={`${group.tasks.indexOf(activity) !== group.tasks.length - 1 ? `border-b ${c.divider}` : ''}`}>
                            <div
                              onClick={() => openActivityModal(activity)}
                              className={`p-2.5 flex items-center justify-between cursor-pointer transition-all ${
                                isCompleted
                                  ? 'opacity-60'
                                  : `${c.activityHover}`
                              } ${isWorking ? 'ring-2 ring-amber-500 rounded-lg' : ''}`}
                            >
                              <div className="flex flex-1 gap-2.5 items-center min-w-0 pr-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isCompleted) {
                                      fetch('/api/activities', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          activityId: activity.id,
                                          updates: { is_completed: false, completed_at: null },
                                        }),
                                      }).then(() => loadAgendaData());
                                    } else {
                                      handleCompleteWork(activity, e);
                                    }
                                  }}
                                  className={`border-2 flex h-5 items-center justify-center rounded-full shrink-0 transition-all w-5 ${c.checkboxBorder} ${
                                    isCompleted ? c.checkboxChecked : ''
                                  }`}
                                >
                                  {isCompleted && <Check className="h-3 stroke-[3] text-white w-3" />}
                                </button>

                                {hasTaskChildren && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleActivityExpansion(activity.id);
                                    }}
                                    className={`shrink-0 ${c.mutedText} hover:opacity-70 transition-opacity`}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronUp className="h-4 w-4" />
                                    )}
                                  </button>
                                )}

                                <div className="flex flex-col min-w-0">
                                  <div className="flex gap-1 items-center min-w-0">
                                    {isOverdue && (
                                      <AlertCircle className="h-3.5 shrink-0 text-red-500 w-3.5" />
                                    )}
                                    <span className={`text-xs font-bold truncate ${
                                      isCompleted
                                        ? 'line-through'
                                        : c.activityText
                                    }`}>
                                      {activity.title}
                                    </span>
                                    {hasTaskChildren && (
                                      <span className={`text-[10px] font-medium ${c.mutedText}`}>
                                        ({children.filter((child: any) => child.is_completed).length}/{children.length})
                                      </span>
                                    )}
                                  </div>
                                  {activity.estimated_minutes && (
                                    <span className={`font-semibold opacity-75 text-[10px] ${c.mutedText}`}>
                                      ⏱️ {activity.estimated_minutes}m
                                    </span>
                                  )}
                                </div>
                              </div>

                              {!isCompleted && (
                                <div className="flex items-center shrink-0">
                                  {!isWorking ? (
                                    <button
                                      onClick={(e) => handleStartWork(activity, e)}
                                      className={`active:scale-95 flex font-bold gap-1 hover:opacity-90 items-center px-2.5 py-1 rounded-lg text-[11px] transition-all ${c.checkboxChecked} text-white`}
                                    >
                                      <Play className="fill-current h-2.5 w-2.5" /> Start
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => handlePauseWork(activity, e)}
                                      className="active:scale-95 bg-amber-600 flex font-bold gap-1 hover:opacity-90 items-center px-2.5 py-1 rounded-lg text-[11px] text-white transition-all"
                                    >
                                      <Pause className="h-2.5 w-2.5" /> Pause
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Child Tasks */}
                            {hasTaskChildren && isExpanded && (
                              <div className="ml-10 space-y-1">
                                {children.map((child: any) => (
                                  <div
                                    key={child.id}
                                    onClick={() => openActivityModal(child)}
                                    className={`p-2 rounded-lg flex items-center gap-2 cursor-pointer transition-all ${c.activityHover}`}
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleChildTask(child.id, child.is_completed, activity.id);
                                      }}
                                      className={`border-2 flex h-4 items-center justify-center rounded-full shrink-0 transition-all w-4 ${c.checkboxBorder} ${
                                        child.is_completed ? c.checkboxChecked : ''
                                      }`}
                                    >
                                      {child.is_completed && <Check className="h-2.5 stroke-[3] text-white w-2.5" />}
                                    </button>
                                    <span className={`text-[11px] font-medium ${
                                      child.is_completed
                                        ? 'line-through opacity-60'
                                        : c.activityText
                                    }`}>
                                      {child.title}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
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

      {/* Modals */}
      {isModalOpen && selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={closeActivityModal}
          onUpdate={handleActivityRefresh}
        />
      )}

      {isCourseModalOpen && (
        <CourseSetupModal
          kidId={kidId}
          isOpen={isCourseModalOpen}
          onClose={() => setIsCourseModalOpen(false)}
          onSave={loadAgendaData}
        />
      )}

      {isAddActivityModalOpen && (
        <ActivityCreateModal
          kidId={kidId}
          selectedDate={selectedDateStr}
          isOpen={isAddActivityModalOpen}
          onClose={() => setIsAddActivityModalOpen(false)}
          onSave={loadAgendaData}
        />
      )}
    </div>
  );
}