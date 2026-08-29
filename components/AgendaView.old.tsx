'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  Plus,
  GraduationCap,
  Calendar,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Globe,
  Play,
  Pause,
  Check,
  Sparkles,
  Flame,
  Star,
  ArrowRight,
  ChevronsRight,
  ChevronsLeft
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
}

export default function AgendaView({ kidId, selectedDate }: AgendaViewProps) {
  const { theme } = useTheme();
  const c = theme?.colors || {};

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
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);

  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isAddActivityModalOpen, setIsAddActivityModalOpen] = useState(false);

  const [todayWorkChunks, setTodayWorkChunks] = useState<any[]>([]);
  const [isWorkChunksModalOpen, setIsWorkChunksModalOpen] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

  // Pagination state for schedule items
  const [schedulePageIndex, setSchedulePageIndex] = useState(0);
  const pageSize = 4; // Max events to show per row page

  const selectedDateStr = useMemo(() => formatDateLocal(selectedDate), [selectedDate]);

  const formattedHeaderDate = useMemo(() => {
    return selectedDate.toLocaleDateString('en-US', {
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
      const agendaRes = await fetch(`/api/agenda?kidId=${kidId}&date=${selectedDateStr}`);
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
  }, [kidId, selectedDateStr]);

  useEffect(() => {
    loadAgendaData();
    setSchedulePageIndex(0); // Reset page on date change
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

  // Paginate schedule items
  const visibleScheduleEvents = useMemo(() => {
    const start = schedulePageIndex * pageSize;
    return todaysAscendingEvents.slice(start, start + pageSize);
  }, [todaysAscendingEvents, schedulePageIndex, pageSize]);

  const hasMoreNext = (schedulePageIndex + 1) * pageSize < todaysAscendingEvents.length;
  const hasMorePrev = schedulePageIndex > 0;

  const handleStartWork = async (activity: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
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

    let calculatedActualMinutes = activity.actual_minutes;
    if (
      activity.start_time &&
      (activity.actual_minutes === null || activity.actual_minutes === undefined)
    ) {
      const { date: startDate } = parseLocalTimestamp(activity.start_time);
      if (startDate && !isNaN(startDate.getTime()) && startDate.getFullYear() > 2020) {
        const elapsedMs = new Date().getTime() - startDate.getTime();
        calculatedActualMinutes = Math.max(0, Math.round(elapsedMs / 60000));
      } else {
        calculatedActualMinutes = null;
      }
    }

    try {
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          updates: {
            is_completed: true,
            completed_at: nowTimestamp,
            end_time: nowTimestamp,
            actual_minutes: calculatedActualMinutes,
          },
        }),
      });
      await loadAgendaData();
    } catch (error) {
      console.error('Error completing work:', error);
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
      <div
        className="flex h-full items-center justify-center min-h-[400px] w-full"
        style={{ backgroundColor: theme?.colors?.bg || '#f8fafc' }}
      >
        <div
          className="animate-spin border-4 border-t-transparent h-10 rounded-full w-10"
          style={{ borderColor: theme?.colors?.moduleIcon || '#9333ea', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div
      className="duration-200 flex flex-col font-sans min-h-screen transition-colors w-full"
      style={{
        backgroundColor: theme?.colors?.bg || '#f8fafc',
        color: theme?.colors?.text || '#1e293b'
      }}
    >
      {/* Top Header Bar */}
      <div 
        className="border-b duration-200 px-6 py-4 shadow-2xs transition-colors"
        style={{ 
          backgroundColor: theme?.colors?.cardBg || '#ffffff', 
          borderColor: theme?.colors?.divider || '#e2e8f0' 
        }}
      >
        <div className="flex items-center justify-between max-w-[1500px] mx-auto w-full">
          <div className="flex gap-3 items-center">
            <div 
              className="p-2 rounded-2xl"
              style={{ 
                backgroundColor: theme?.colors?.cardBg || '#f3e8ff', 
                color: theme?.colors?.moduleIcon || '#9333ea' 
              }}
            >
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 
                className="font-extrabold text-xl tracking-tight"
                style={{ color: theme?.colors?.text || '#1e293b' }}
              >
                {formattedHeaderDate}
              </h1>
              <p 
                className="font-medium text-xs"
                style={{ color: theme?.colors?.mutedText || '#64748b' }}
              >
                Ready to tackle today's goals?
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 items-center">
            {todayWorkChunks.length > 0 && (
              <button
                onClick={() => setIsWorkChunksModalOpen(true)}
                className="border flex font-bold gap-2 items-center px-3.5 py-2 rounded-xl shadow-2xs text-xs transition-all"
                style={{
                  backgroundColor: theme?.colors?.cardBg || '#f3e8ff',
                  borderColor: theme?.colors?.moduleBorder || '#e9d5ff',
                  color: theme?.colors?.moduleIcon || '#9333ea'
                }}
              >
                <Flame className="fill-current h-4 w-4" />
                <span>{formatTime(todayTotalMinutes)} Worked</span>
              </button>
            )}

            <button
              onClick={() => setIsFeedModalOpen(true)}
              className="flex font-bold gap-1.5 items-center px-3.5 py-2 rounded-xl text-xs transition-all"
              style={{
                backgroundColor: theme?.colors?.sidebarItemBg || '#f1f5f9',
                color: theme?.colors?.text || '#334155'
              }}
            >
              <Globe className="h-4 opacity-70 w-4" />
              <span>Feeds</span>
            </button>

            <button
              onClick={() => setIsCourseModalOpen(true)}
              className="flex font-bold gap-1.5 items-center px-3.5 py-2 rounded-xl text-xs transition-all"
              style={{
                backgroundColor: theme?.colors?.sidebarItemBg || '#f1f5f9',
                color: theme?.colors?.text || '#334155'
              }}
            >
              <GraduationCap className="h-4 opacity-70 w-4" />
              <span>New Course</span>
            </button>

            <button
              onClick={() => setIsAddActivityModalOpen(true)}
              className="active:scale-95 flex font-bold gap-1.5 items-center px-4 py-2 rounded-xl shadow-sm text-xs transition-all"
              style={{
                backgroundColor: theme?.colors?.moduleIcon || '#9333ea',
                color: theme?.buttonText || '#ffffff'
              }}
            >
              <Plus className="h-4 stroke-[3] w-4" />
              <span>Add Task</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-[1500px] mx-auto p-6 space-y-5 w-full">

        {/* Schedule Block - Paginated Inline Flow */}
        {todaysAscendingEvents.length > 0 && (
          <div 
            className="border flex flex-col gap-2.5 p-3.5 rounded-2xl shadow-2xs transition-colors w-full"
            style={{
              backgroundColor: theme?.colors?.cardBg || '#f3e8ff',
              borderColor: theme?.colors?.moduleBorder || '#e9d5ff',
              color: theme?.colors?.moduleIcon || '#9333ea'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex gap-2 items-center">
                <Calendar className="h-4 w-4" />
                <h2 className="font-extrabold text-xs tracking-wider uppercase">
                  Schedule
                </h2>
              </div>
              
              {todaysAscendingEvents.length > pageSize && (
                <span className="font-bold opacity-75 text-[10px]">
                  Showing {schedulePageIndex * pageSize + 1}-
                  {Math.min((schedulePageIndex + 1) * pageSize, todaysAscendingEvents.length)} of {todaysAscendingEvents.length}
                </span>
              )}
            </div>

            {/* Single horizontal row with pagination triggers */}
            <div className="flex gap-2 items-center overflow-hidden w-full">
              {/* Prev Button (<<) */}
              {hasMorePrev && (
                <button
                  onClick={() => setSchedulePageIndex(prev => prev - 1)}
                  className="border flex font-bold gap-1 hover:opacity-90 items-center px-2 py-1.5 rounded-xl shadow-2xs shrink-0 text-xs transition-all"
                  style={{
                    backgroundColor: theme?.colors?.cardBg || '#ffffff',
                    borderColor: theme?.colors?.moduleBorder || '#e9d5ff',
                    color: theme?.colors?.moduleIcon || '#9333ea'
                  }}
                  title="Previous events"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
              )}

              {/* Event Items */}
              {visibleScheduleEvents.map((ev, idx) => {
                const startTime = formatEventTime(ev.start_time);
                const endTime = formatEventTime(ev.end_time);
                const isLastVisible = idx === visibleScheduleEvents.length - 1;

                return (
                  <div key={ev.id || ev.title || idx} className="flex flex-1 gap-2 items-center min-w-0">
                    <div
                      onClick={() => openActivityModal(ev)}
                      className="border cursor-pointer flex gap-2 hover:shadow-2xs items-center min-w-0 px-2.5 py-1.5 rounded-xl transition-all w-full"
                      style={{
                        backgroundColor: theme?.colors?.cardBg || '#ffffff',
                        borderColor: theme?.colors?.divider || '#e2e8f0',
                        color: theme?.colors?.text || '#1e293b'
                      }}
                    >
                      <span 
                        className="font-bold px-1.5 py-0.5 rounded-md shrink-0 text-[10px] whitespace-nowrap"
                        style={{
                          backgroundColor: theme?.badgeBg || '#f1f5f9',
                          color: theme?.colors?.moduleIcon || '#9333ea'
                        }}
                      >
                        {startTime}
                      </span>

                      <span className="font-bold text-xs truncate">
                        {ev.title}
                      </span>

                      {endTime && (
                        <span 
                          className="font-semibold opacity-70 shrink-0 text-[10px] whitespace-nowrap"
                          style={{ color: theme?.colors?.mutedText || '#64748b' }}
                        >
                          – {endTime}
                        </span>
                      )}
                    </div>

                    {/* Standard Inline Arrow */}
                    {(!isLastVisible || hasMoreNext) && (
                      <ArrowRight className="h-3.5 opacity-40 shrink-0 w-3.5" />
                    )}
                  </div>
                );
              })}

              {/* Next Button (>>) */}
              {hasMoreNext && (
                <button
                  onClick={() => setSchedulePageIndex(prev => prev + 1)}
                  className="active:scale-95 border flex font-bold gap-1 hover:opacity-90 items-center px-2.5 py-1.5 rounded-xl shadow-2xs shrink-0 text-xs transition-all"
                  style={{
                    backgroundColor: theme?.colors?.moduleIcon || '#9333ea',
                    color: theme?.buttonText || '#ffffff',
                    borderColor: theme?.colors?.moduleIcon || '#9333ea'
                  }}
                  title="Next events"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Course Cards Grid Layout */}
        {courseGroups.length === 0 ? (
          <div 
            className="border-2 border-dashed py-16 rounded-2xl text-center transition-colors"
            style={{ 
              backgroundColor: theme?.colors?.cardBg || '#ffffff', 
              borderColor: theme?.colors?.divider || '#e2e8f0' 
            }}
          >
            <Star 
              className="animate-bounce h-10 mb-2 mx-auto w-10" 
              style={{ color: theme?.warning || '#f59e0b' }} 
            />
            <p className="font-bold text-base" style={{ color: theme?.colors?.text || '#334155' }}>All caught up!</p>
            <p className="mt-0.5 text-xs" style={{ color: theme?.colors?.mutedText || '#94a3b8' }}>No school assignments scheduled for today.</p>
          </div>
        ) : (
          <div className="gap-4 grid grid-cols-1 items-stretch lg:grid-cols-3 md:grid-cols-2">
            {courseGroups.map((group) => {
              const isExpanded = expandedCourses.has(group.courseName) || !group.allComplete;
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
                  className="border-2 flex flex-col h-full overflow-hidden rounded-2xl shadow-2xs transition-all"
                  style={{
                    backgroundColor: theme?.colors?.cardBg || '#ffffff',
                    borderColor: group.hasOverdue 
                      ? (theme?.dangerBorder || '#fca5a5') 
                      : (theme?.colors?.moduleBorder || theme?.colors?.divider || '#e2e8f0')
                  }}
                >
                  <button
                    onClick={toggleExpand}
                    className="border-b flex gap-2 hover:opacity-95 items-center justify-between p-3.5 shrink-0 transition-opacity w-full"
                    style={{
                      backgroundColor: group.hasOverdue 
                        ? (theme?.dangerBg || '#fff1f2')
                        : (theme?.colors?.cardBg || '#f3e8ff'),
                      borderColor: group.hasOverdue
                        ? (theme?.dangerBorder || '#fca5a5')
                        : (theme?.colors?.moduleBorder || '#e9d5ff')
                    }}
                  >
                    <div className="flex gap-2.5 items-center min-w-0">
                      <div 
                        className="p-1.5 rounded-lg shadow-2xs shrink-0"
                        style={{
                          backgroundColor: theme?.colors?.cardBg || '#ffffff',
                          color: group.hasOverdue ? (theme?.colors?.activityIcon || '#e11d48') : (theme?.colors?.moduleIcon || '#9333ea')
                        }}
                      >
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <span 
                        className="font-extrabold text-left text-xs truncate"
                        style={{ color: theme?.colors?.text || '#1e293b' }}
                      >
                        {group.courseName}
                      </span>
                    </div>

                    <div className="flex gap-2 items-center shrink-0">
                      {group.allComplete ? (
                        <span 
                          className="flex font-bold gap-1 items-center px-2 py-0.5 rounded-full shadow-2xs text-[10px]"
                          style={{
                            backgroundColor: theme?.successBg || '#d1fae5',
                            color: theme?.successText || '#065f46'
                          }}
                        >
                          <CheckCircle2 className="h-3 w-3" /> Done
                        </span>
                      ) : (
                        <span 
                          className="border font-bold px-2 py-0.5 rounded-full text-[10px]"
                          style={{
                            backgroundColor: theme?.colors?.cardBg || '#ffffff',
                            borderColor: theme?.colors?.divider || '#cbd5e1',
                            color: theme?.colors?.mutedText || '#475569'
                          }}
                        >
                          {group.completedTasks}/{group.totalTasks}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" style={{ color: theme?.colors?.mutedText || '#64748b' }} />
                      ) : (
                        <ChevronDown className="h-4 w-4" style={{ color: theme?.colors?.mutedText || '#64748b' }} />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div 
                      className="flex flex-1 flex-col justify-start p-3 space-y-2 transition-colors"
                      style={{ 
                        backgroundColor: theme?.taskContainerBg || '#ffffff'
                      }}
                    >
                      {group.tasks.map((activity) => {
                        const isWorking = Boolean(activity.start_time);
                        const isOverdue = activity.isOverdue && !activity.is_completed;
                        const isCompleted = activity.is_completed;

                        let cardBg = theme?.colors?.cardBg || '#ffffff';
                        let cardBorder = theme?.colors?.divider || '#e2e8f0';
                        let textColor = theme?.colors?.text || '#1e293b';

                        if (isCompleted) {
                          cardBg = theme?.completedBg || '#f8fafc';
                          cardBorder = theme?.completedBorder || '#e2e8f0';
                          textColor = theme?.completedText || '#94a3b8';
                        } else if (isWorking) {
                          cardBg = theme?.activeTaskBg || '#fffbeb';
                          cardBorder = theme?.activeTaskBorder || '#fcd34d';
                        } else if (isOverdue) {
                          cardBg = theme?.dangerBg || '#fff1f2';
                          cardBorder = theme?.dangerBorder || '#fca5a5';
                          textColor = theme?.colors?.activityIcon || '#e11d48';
                        }

                        return (
                          <div
                            key={activity.id}
                            onClick={() => openActivityModal(activity)}
                            className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                              isCompleted ? 'opacity-60' : ''
                            } ${isWorking ? 'ring-2' : 'hover:shadow-2xs'}`}
                            style={{
                              backgroundColor: cardBg,
                              borderColor: cardBorder,
                              boxShadow: isWorking ? `0 0 0 2px ${theme?.colors?.moduleIcon || '#9333ea'}33` : undefined
                            }}
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
                                className="border-2 flex h-5 items-center justify-center rounded-full shrink-0 transition-all w-5"
                                style={{
                                  backgroundColor: isCompleted ? (theme?.success || '#10b981') : 'transparent',
                                  borderColor: isCompleted ? (theme?.success || '#10b981') : (theme?.colors?.divider || '#cbd5e1')
                                }}
                              >
                                {isCompleted && <Check className="h-3 stroke-[3] text-white w-3" />}
                              </button>

                              <div className="flex flex-col min-w-0">
                                <span 
                                  className={`text-xs font-bold truncate ${isCompleted ? 'line-through' : ''}`}
                                  style={{ color: textColor }}
                                >
                                  {isOverdue && <span className="mr-1">⚠️</span>}
                                  {activity.title}
                                </span>
                                {activity.estimated_minutes && (
                                  <span 
                                    className="font-semibold opacity-75 text-[10px]"
                                    style={{ color: theme?.colors?.mutedText || '#64748b' }}
                                  >
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
                                    className="active:scale-95 flex font-bold gap-1 hover:opacity-90 items-center px-2.5 py-1 rounded-lg shadow-2xs text-[11px] transition-all"
                                    style={{
                                      backgroundColor: theme?.colors?.moduleIcon || '#9333ea',
                                      color: theme?.buttonText || '#ffffff'
                                    }}
                                  >
                                    <Play className="fill-current h-2.5 w-2.5" /> Start
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => handlePauseWork(activity, e)}
                                    className="active:scale-95 flex font-bold gap-1 hover:opacity-90 items-center px-2.5 py-1 rounded-lg shadow-2xs text-[11px] transition-all"
                                    style={{
                                      backgroundColor: theme?.warning || '#f59e0b',
                                      color: '#ffffff'
                                    }}
                                  >
                                    <Pause className="h-2.5 w-2.5" /> Pause
                                  </button>
                                )}
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

      {/* Modal Dialogs */}
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