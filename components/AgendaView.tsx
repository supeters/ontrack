'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  Plus,
  GraduationCap,
  Trophy,
  Calendar,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Globe,
  Trash2,
  X,
  Play,
  Pause,
  Check,
  BarChart3,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import ActivityDetailModal from './ActivityDetailModal';
import CourseSetupModal from './CourseSetupModal';
import ActivityCreateModal from './ActivityCreateModal';
import CalendarEventsTimeline from './CalendarEventsTimeline';
import {
  formatDateShort,
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

  const c = theme?.colors || {
    bg: 'bg-[#f4efe6]',
    cardBg: 'bg-[#fcfaf7]',
    card: 'bg-[#fcfaf7] border border-[#d4c5b0]',
    text: 'text-[#3d3122]',
    moduleHeader: 'bg-[#e6ddcd] hover:bg-[#ded2bf]',
    moduleText: 'text-[#3d3122]',
    moduleIcon: 'text-[#8c5a2b]',
    moduleBorder: 'border-[#d4c5b0]',
    workgroupHeader: 'bg-[#eee7db] hover:bg-[#e4dacb]',
    workgroupText: 'text-[#2b2217]',
    workgroupIcon: 'text-[#73421d]',
    workgroupBg: 'bg-[#f7f3ec]',
    activityHover: 'hover:bg-[#efe8dc] hover:border-[#b8a383]',
    activityText: 'text-[#2c2318]',
    activityIcon: 'text-[#8c5a2b]',
    statText: 'text-[#615241]',
    mutedText: 'text-[#7d6c59]',
    divider: 'divide-[#e0d5c3] border-[#e0d5c3]',
    checkboxBorder: 'border-[#b8a383]',
    checkboxChecked: 'bg-[#8c5a2b] border-[#8c5a2b]',
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
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [newFeedName, setNewFeedName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [isSavingFeed, setIsSavingFeed] = useState(false);

  const [activeEventId, setActiveEventId] = useState<string | number | null>(null);

  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isAddActivityModalOpen, setIsAddActivityModalOpen] = useState(false);

  const [todayWorkChunks, setTodayWorkChunks] = useState<any[]>([]);
  const [isWorkChunksModalOpen, setIsWorkChunksModalOpen] = useState(false);

  const [isBacklogOpen, setIsBacklogOpen] = useState(false);
  const [backlogGroupBy, setBacklogGroupBy] = useState<'date' | 'course'>('date');

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
      // Fetch today's work chunks for daily summary
      const chunksRes = await fetch(`/api/analytics?kidId=${kidId}&startDate=${selectedDateStr}&endDate=${selectedDateStr}`);
      if (chunksRes.ok) {
        const chunksData = await chunksRes.json();
        setTodayWorkChunks(chunksData.chunks || []);
      }
    } catch (error) {
      console.error('Error loading agenda or iCal data:', error);
    } finally {
      setLoading(false);
    }
  }, [kidId, selectedDateStr]);

  useEffect(() => {
    loadAgendaData();
  }, [kidId, selectedDate, loadAgendaData]);

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
      await loadAgendaData();
    } catch (error) {
      console.error('Error adding feed:', error);
    } finally {
      setIsSavingFeed(false);
    }
  };

  const handleDeleteFeed = async (feedId: number) => {
    try {
      await fetch(`/api/calendars/ical?feedId=${feedId}`, { method: 'DELETE' });
      await loadAgendaData();
    } catch (error) {
      console.error('Error deleting feed:', error);
    }
  };

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

  const focusActivities = useMemo(() => {
    const overdueWithFlag = (overdueActivities || []).map((a) => ({ ...a, isOverdue: true }));
    const todayWithFlag = (todayActivities || []).map((a) => ({ ...a, isOverdue: false }));
    const map = new Map<number | string, any>();
    [...overdueWithFlag, ...todayWithFlag].forEach((a) => {
      if (a && a.id && !map.has(a.id)) map.set(a.id, a);
    });
    return Array.from(map.values());
  }, [overdueActivities, todayActivities]);

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

  const backlogGroupedByCourse = useMemo(() => {
    const map = new Map<string, any[]>();
    (nextModuleActivities || []).forEach((activity) => {
      const courseName = activity.course_name || activity.course?.name || 'General / Other';
      if (!map.has(courseName)) map.set(courseName, []);
      map.get(courseName)!.push(activity);
    });

    return Array.from(map.entries()).map(([courseName, activities]) => ({
      groupKey: courseName,
      activities: activities.sort(
        (a, b) =>
          new Date(a.plan_date || a.start_time || 0).getTime() -
          new Date(b.plan_date || b.start_time || 0).getTime()
      ),
    }));
  }, [nextModuleActivities]);

  const backlogGroupedByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    (nextModuleActivities || []).forEach((activity) => {
      const rawDate = activity.plan_date || activity.start_time;
      const dateKey = rawDate ? getDateStr(rawDate) : 'Unscheduled';
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(activity);
    });

    const sortedEntries = Array.from(map.entries()).sort(([dateA], [dateB]) => {
      if (dateA === 'Unscheduled') return 1;
      if (dateB === 'Unscheduled') return -1;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    return sortedEntries.map(([dateKey, activities]) => ({
      groupKey: dateKey,
      displayName: dateKey === 'Unscheduled' ? 'Unscheduled / Someday' : formatDateShort(dateKey),
      activities: activities.sort(
        (a, b) =>
          new Date(a.plan_date || a.start_time || 0).getTime() -
          new Date(b.plan_date || b.start_time || 0).getTime()
      ),
    }));
  }, [nextModuleActivities]);

  const moveFocusItem = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= focusActivities.length) return;

    const updated = [...focusActivities];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(newIndex, 0, movedItem);

    setTodayActivities(updated);

    try {
      const updates = updated.map((activity, idx) =>
        fetch('/api/activities', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityId: activity.id,
            updates: { position: idx },
          }),
        })
      );
      await Promise.all(updates);
    } catch (error) {
      console.error('Error updating positions:', error);
      loadAgendaData();
    }
  };

  const handleDragStart = (e: React.DragEvent, activity: any, sourceList: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ activity, sourceList }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnFocus = async (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const { activity, sourceList } = JSON.parse(dataStr);
      if (sourceList === 'backlog') {
        await fetch('/api/activities', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityId: activity.id,
            updates: { plan_date: selectedDateStr },
          }),
        });
        loadAgendaData();
      }
    } catch (err) {
      console.error('Error dropping item into focus:', err);
    }
  };

  const handleDropOnBacklog = async (e: React.DragEvent, targetDateKey?: string) => {
    e.preventDefault();
    if (backlogGroupBy !== 'date' || !targetDateKey) return;

    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const { activity, sourceList } = JSON.parse(dataStr);

      if (sourceList === 'focus' || sourceList === 'backlog') {
        const newPlanDate = targetDateKey === 'Unscheduled' ? null : targetDateKey;
        const currentPlanDate = activity.plan_date ? getDateStr(activity.plan_date) : 'Unscheduled';
        if (currentPlanDate === targetDateKey) return;

        await fetch('/api/activities', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityId: activity.id,
            updates: { plan_date: newPlanDate },
          }),
        });
        loadAgendaData();
      }
    } catch (err) {
      console.error('Error dropping item into backlog bin:', err);
    }
  };

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

  const toggleEventActive = (eventId: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveEventId((prev) => (prev === eventId ? null : eventId));
  };

  // Helper functions for daily summary
  const getChunkMinutes = (chunk: any): number => {
    if (chunk.minutes_worked) return chunk.minutes_worked;
    if (chunk.start_time && chunk.end_time) {
      const start = new Date(chunk.start_time);
      const end = new Date(chunk.end_time);
      return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    }
    return 0;
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const todayTotalMinutes = todayWorkChunks.reduce((sum, chunk) => sum + getChunkMinutes(chunk), 0);
  const todayMoods = todayWorkChunks.filter(c => c.mood).map(c => c.mood);
  const mostCommonMood = todayMoods.length > 0
    ? todayMoods.sort((a, b) =>
        todayMoods.filter(m => m === b).length - todayMoods.filter(m => m === a).length
      )[0]
    : null;


  // Helper function to format time range
  const formatTimeRange = (startTime: string | null, endTime: string | null): string => {
    if (!startTime || !endTime) return 'Unknown time';
    const start = new Date(startTime);
    const end = new Date(endTime);
    return `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  };

  // Helper function to get mood emoji
  const getMoodEmoji = (mood: string | null): string => {
    if (!mood) return '';
    const moodMap: { [key: string]: string } = {
      'struggled': '😫',
      'okay': '😐',
      'good': '🙂',
      'great': '😊',
      'focused': '🎯'
    };
    return moodMap[mood] || '';
  };

  if (loading) {
    return (
      <div className={`flex h-full w-full items-center justify-center min-h-[400px] ${c.bg}`}>
        <div
          className={`animate-spin rounded-full h-8 w-8 border-b-2 ${
            c.checkboxChecked ? c.checkboxChecked.split(' ')[0].replace('bg-', 'border-') : 'border-current'
          }`}
        />
      </div>
    );
  }

  return (
    <div className={`w-full min-h-screen flex flex-col ${c.bg} ${c.text}`}>
      {/* Header Bar */}
      <div className={`${c.cardBg} border-b ${c.divider} px-6 py-4 w-full`}>
        <div className="flex items-center justify-between max-w-[1500px] mx-auto w-full">
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${c.moduleText}`}>Agenda Board</h1>
            <p className={`font-medium text-xs mt-0.5 ${c.mutedText}`}>{formattedHeaderDate}</p>
          </div>
          <div className="flex gap-2 items-center">
            {/* Daily Summary Button */}
            {todayWorkChunks.length > 0 && (
              <button
                onClick={() => setIsWorkChunksModalOpen(true)}
                className={`flex items-center gap-2 px-3 py-1.5 border ${c.moduleBorder} rounded-lg text-xs font-medium ${c.moduleText} ${c.cardBg} ${c.activityHover} transition-all`}
              >
                <BarChart3 className={`h-3.5 w-3.5 ${c.moduleIcon}`} />
                <span>{formatTime(todayTotalMinutes)} worked</span>
                <span className="text-gray-400">•</span>
                <span>{completedActivities.length} done</span>
              </button>
            )}
            <button
              onClick={() => setIsFeedModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border ${c.moduleBorder} rounded-lg text-xs font-medium ${c.moduleText} ${c.cardBg} ${c.activityHover} transition-all`}
            >
              <Globe className={`h-3.5 w-3.5 ${c.moduleIcon}`} />
              <span>iCal Feeds ({feeds.length})</span>
            </button>
            <button
              onClick={() => setIsCourseModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border ${c.moduleBorder} rounded-lg text-xs font-medium ${c.moduleText} ${c.cardBg} ${c.activityHover} transition-all`}
            >
              <GraduationCap className={`h-3.5 w-3.5 ${c.moduleIcon}`} />
              <span>New Course</span>
            </button>
            <button
              onClick={() => setIsAddActivityModalOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 ${c.checkboxChecked} text-white rounded-lg hover:opacity-95 transition-all text-xs font-semibold shadow-xs`}
            >
              <Plus className="h-4 w-4" />
              <span>Add Activity</span>
            </button>
          </div>
        </div>
      </div>




      {/* Main Board - 12-Column Layout Grid */}
      <div className="flex-1 max-w-[1500px] mx-auto p-6 space-y-6 w-full">
        <div className="gap-5 grid grid-cols-1 items-start lg:grid-cols-12">
          
          {/* COLUMN 1 (3/12): Calendar Schedule */}
          <div className={`lg:col-span-3 rounded-xl border ${c.moduleBorder} ${c.cardBg} flex flex-col shadow-xs overflow-hidden`}>
            <div className={`px-3.5 py-3 border-b ${c.divider} flex items-center justify-between ${c.workgroupBg}`}>
              <div className="flex gap-2 items-center">
                <Calendar className={`h-4 w-4 ${c.workgroupIcon}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${c.workgroupText}`}>
                  Schedule ({todaysAscendingEvents.length})
                </span>
              </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              <CalendarEventsTimeline
                events={todaysAscendingEvents}
                activeEventId={activeEventId}
                onToggleActive={toggleEventActive}
                onEventClick={openActivityModal}
                theme={theme}
              />
            </div>
          </div>

          {/* COLUMN 2 (5/12): Focus To-Do List */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDropOnFocus}
            className={`lg:col-span-5 rounded-xl border ${c.moduleBorder} ${c.cardBg} flex flex-col shadow-xs overflow-hidden`}
          >
            <div className={`px-3.5 py-3 border-b ${c.divider} flex items-center justify-between ${c.workgroupBg}`}>
              <div className="flex gap-2 items-center">
                <Clock className={`h-4 w-4 ${c.workgroupIcon}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${c.workgroupText}`}>
                  Focus To-Do ({focusActivities.filter((a) => !a.is_completed).length})
                </span>
              </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto p-3 space-y-2">
              {focusActivities.filter((a) => !a.is_completed).length === 0 ? (
                <div className={`text-xs ${c.mutedText} py-12 text-center italic`}>
                  No tasks set for today.
                </div>
              ) : (
                focusActivities
                  .filter((a) => !a.is_completed)
                  .map((activity, index) => {
                    const isWorking = Boolean(activity.start_time);

                    return (
                      <div
                        key={activity.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, activity, 'focus')}
                        onClick={() => openActivityModal(activity)}
                        className={`rounded-lg border p-2.5 flex items-center justify-between cursor-pointer transition-all shadow-2xs ${
                          isWorking
                            ? `${c.moduleBorder} ${c.moduleHeader} ring-1 ring-amber-500/40`
                            : `${c.divider} ${c.workgroupBg} ${c.activityHover}`
                        }`}
                      >
                        <div
                          className={`flex flex-col gap-0.5 shrink-0 ${c.mutedText} mr-2`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => moveFocusItem(index, 'up')}
                            disabled={index === 0}
                            className="disabled:opacity-20 hover:opacity-100 leading-none text-[10px]"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveFocusItem(index, 'down')}
                            disabled={index === focusActivities.length - 1}
                            className="disabled:opacity-20 hover:opacity-100 leading-none text-[10px]"
                          >
                            ▼
                          </button>
                        </div>

                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex gap-1.5 items-center">
                            {activity.isOverdue && (
                              <span className={`border ${c.moduleBorder} ${c.cardBg} text-amber-800 font-bold px-1 py-0.2 rounded text-[8px] uppercase`}>
                                Overdue
                              </span>
                            )}
                            {isWorking && (
                              <span className={`${c.checkboxChecked} text-white font-bold px-1 py-0.2 rounded text-[8px] uppercase animate-pulse`}>
                                Active
                              </span>
                            )}
                            <span className={`text-xs font-semibold ${c.activityText} truncate`}>
                              {activity.title}
                            </span>
                          </div>
                          <p className={`text-[10px] ${c.statText} truncate mt-0.5`}>
                            {activity.course_name || 'General'}
                          </p>
                        </div>

                        {/* Streamlined Action Buttons */}
                        <div className="flex gap-1 items-center shrink-0">
                          {!isWorking ? (
                            <button
                              onClick={(e) => handleStartWork(activity, e)}
                              className={`flex items-center gap-1 border ${c.moduleBorder} hover:bg-emerald-50 text-emerald-800 font-semibold px-2 py-1 rounded text-[11px] transition-colors`}
                            >
                              <Play className="fill-current h-3 w-3" />
                              <span>Start</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={(e) => handlePauseWork(activity, e)}
                                className={`border ${c.moduleBorder} bg-white hover:bg-slate-50 text-slate-700 font-medium px-2 py-1 rounded text-[11px] transition-colors`}
                              >
                                <Pause className="h-3 w-3" />
                              </button>
                              <button
                                onClick={(e) => handleCompleteWork(activity, e)}
                                className={`${c.checkboxChecked} text-white font-medium px-2 py-1 rounded text-[11px] hover:opacity-90 transition-opacity flex items-center gap-0.5`}
                              >
                                <Check className="h-3 w-3" />
                                <span>Done</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* COLUMN 3 (4/12): Completed Tasks */}
          <div className={`lg:col-span-4 rounded-xl border ${c.moduleBorder} ${c.cardBg} flex flex-col shadow-xs overflow-hidden`}>
            <div className={`px-3.5 py-3 border-b ${c.divider} flex items-center justify-between ${c.workgroupBg}`}>
              <div className="flex gap-2 items-center">
                <Trophy className={`h-4 w-4 ${c.workgroupIcon}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${c.workgroupText}`}>
                  Completed ({completedActivities.length})
                </span>
              </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto p-3 space-y-2">
              {completedActivities.length === 0 ? (
                <div className={`text-xs ${c.mutedText} py-12 text-center italic`}>
                  No completed tasks yet.
                </div>
              ) : (
                completedActivities.map((activity) => (
                  <div
                    key={activity.id}
                    onClick={() => openActivityModal(activity)}
                    className={`rounded-lg border ${c.divider} ${c.workgroupBg} p-2.5 flex items-center justify-between cursor-pointer ${c.activityHover} shadow-2xs`}
                  >
                    <div className="flex gap-2 items-center min-w-0 pr-2">
                      <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 text-emerald-600`} />
                      <span className={`line-through ${c.mutedText} text-xs truncate`}>
                        {activity.title}
                      </span>
                    </div>
                    <span className={`text-[10px] ${c.statText} shrink-0`}>
                      {activity.course_name}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* BACKLOG QUEUE DRAWER */}
        <div className={`rounded-xl border ${c.moduleBorder} ${c.cardBg} shadow-xs overflow-hidden`}>
          <div className={`w-full px-4 py-3 flex items-center justify-between ${c.workgroupBg}`}>
            <button
              onClick={() => setIsBacklogOpen(!isBacklogOpen)}
              className="flex flex-1 gap-2 items-center text-left"
            >
              <Clock className={`h-4 w-4 ${c.workgroupIcon}`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${c.workgroupText}`}>
                Coming Up
              </span>
            </button>

            <div className="flex gap-3 items-center" onClick={(e) => e.stopPropagation()}>
              <div className={`flex items-center rounded-lg border ${c.moduleBorder} p-0.5 text-[11px] ${c.cardBg}`}>
                <button
                  onClick={() => setBacklogGroupBy('date')}
                  className={`px-2 py-0.5 rounded font-medium transition-all ${
                    backlogGroupBy === 'date' ? `${c.checkboxChecked} text-white` : `${c.mutedText} hover:opacity-80`
                  }`}
                >
                  By Date
                </button>
                <button
                  onClick={() => setBacklogGroupBy('course')}
                  className={`px-2 py-0.5 rounded font-medium transition-all ${
                    backlogGroupBy === 'course' ? `${c.checkboxChecked} text-white` : `${c.mutedText} hover:opacity-80`
                  }`}
                >
                  By Course
                </button>
              </div>

              <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${c.cardBg} ${c.moduleText} border ${c.moduleBorder}`}>
                {nextModuleActivities.length}
              </span>

              <button onClick={() => setIsBacklogOpen(!isBacklogOpen)}>
                {isBacklogOpen ? <ChevronUp className={`h-4 w-4 ${c.workgroupIcon}`} /> : <ChevronDown className={`h-4 w-4 ${c.workgroupIcon}`} />}
              </button>
            </div>
          </div>

          {isBacklogOpen && (
            <div className={`border-t ${c.divider} p-3.5 space-y-4`}>
              {nextModuleActivities.length === 0 ? (
                <p className={`text-xs ${c.mutedText} text-center py-4 italic`}>No backlog items found.</p>
              ) : backlogGroupBy === 'date' ? (
                <div className="gap-3 grid grid-cols-1 lg:grid-cols-5 md:grid-cols-3 sm:grid-cols-2">
                  {backlogGroupedByDate.map((group) => (
                    <div
                      key={group.groupKey}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnBacklog(e, group.groupKey)}
                      className={`rounded-lg border ${c.moduleBorder} ${c.workgroupBg} p-2.5 flex flex-col justify-between`}
                    >
                      <div className={`border-b ${c.divider} flex items-center justify-between mb-2 pb-1.5`}>
                        <div className="flex gap-1.5 items-center min-w-0">
                          <Calendar className={`h-3.5 w-3.5 shrink-0 ${c.workgroupIcon}`} />
                          <h4 className={`text-[10px] font-bold uppercase tracking-wider ${c.workgroupText} truncate`}>
                            {group.displayName}
                          </h4>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${c.cardBg} border ${c.moduleBorder} ${c.mutedText} shrink-0`}>
                          {group.activities.length}
                        </span>
                      </div>

                      <div className="flex-1 min-h-[50px] space-y-1.5">
                        {group.activities.map((activity) => (
                          <div
                            key={activity.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, activity, 'backlog')}
                            onClick={() => openActivityModal(activity)}
                            className={`rounded border ${c.divider} ${c.cardBg} p-2 shadow-2xs cursor-pointer ${c.activityHover} transition-all`}
                          >
                            <div className={`text-[11px] font-medium ${c.activityText} truncate`}>{activity.title}</div>
                            <p className={`text-[9px] ${c.statText} truncate mt-0.5`}>{activity.course_name || 'General'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {backlogGroupedByCourse.map((group) => (
                    <div
                      key={group.groupKey}
                      className={`w-64 shrink-0 rounded-lg border ${c.moduleBorder} ${c.workgroupBg} p-2.5 flex flex-col justify-between`}
                    >
                      <div className={`border-b ${c.divider} flex items-center justify-between mb-2 pb-1.5`}>
                        <div className="flex gap-1.5 items-center min-w-0">
                          <BookOpen className={`h-3.5 w-3.5 shrink-0 ${c.workgroupIcon}`} />
                          <h4 className={`text-[10px] font-bold uppercase tracking-wider ${c.workgroupText} truncate`} title={group.groupKey}>
                            {group.groupKey}
                          </h4>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${c.cardBg} border ${c.moduleBorder} ${c.mutedText} shrink-0`}>
                          {group.activities.length}
                        </span>
                      </div>

                      <div className="flex-1 min-h-[50px] space-y-1.5">
                        {group.activities.map((activity) => (
                          <div
                            key={activity.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, activity, 'backlog')}
                            onClick={() => openActivityModal(activity)}
                            className={`rounded border ${c.divider} ${c.cardBg} p-2 shadow-2xs cursor-pointer ${c.activityHover} transition-all`}
                          >
                            <div className={`text-[11px] font-medium ${c.activityText} truncate`}>{activity.title}</div>
                            <p className={`text-[9px] ${c.statText} truncate mt-0.5`}>
                              {activity.plan_date ? formatDateShort(activity.plan_date) : 'Unscheduled'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
                  placeholder="e.g., Varsity Soccer, High School Schedule"
                  value={newFeedName}
                  onChange={(e) => setNewFeedName(e.target.value)}
                  className={`border ${c.moduleBorder} ${c.cardBg} ${c.activityText} focus:outline-none p-2 rounded-lg text-xs w-full`}
                  required
                />
              </div>
              <div>
                <label className={`block font-medium mb-1 text-xs ${c.moduleText}`}>iCal URL (.ics)</label>
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
                className={`${c.checkboxChecked} disabled:opacity-50 flex font-semibold gap-1.5 hover:opacity-90 items-center justify-center py-2 rounded-lg text-white text-xs transition-colors w-full`}
              >
                <Plus className="h-4 w-4" /> Add Feed
              </button>
            </form>

            <div className={`border-t ${c.divider} pt-2 space-y-2`}>
              <h4 className={`font-semibold text-xs ${c.mutedText}`}>Connected Feeds</h4>
              {feeds.length === 0 ? (
                <p className={`italic text-xs ${c.mutedText}`}>No feeds linked.</p>
              ) : (
                feeds.map((feed) => (
                  <div key={feed.id} className={`${c.cardBg} border ${c.moduleBorder} flex items-center justify-between p-2 rounded-lg text-xs`}>
                    <div className="min-w-0 pr-2">
                      <p className={`font-semibold truncate ${c.moduleText}`}>{feed.name}</p>
                      <p className={`text-[10px] truncate ${c.mutedText}`}>{feed.url}</p>
                    </div>
                    <button onClick={() => handleDeleteFeed(feed.id)} className={`p-1 ${c.mutedText} hover:opacity-100`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modals */}
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

      {/* Work Chunks Modal */}
      {isWorkChunksModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsWorkChunksModalOpen(false)}>
          <div className={`${c.cardBg} rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col`} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b ${c.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <BarChart3 className={`h-5 w-5 ${c.moduleIcon}`} />
                <h2 className={`text-lg font-bold ${c.moduleText}`}>Work Summary</h2>
              </div>
              <button
                onClick={() => setIsWorkChunksModalOpen(false)}
                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className={`${c.cardBg} border ${c.moduleBorder} rounded-lg p-4 text-center`}>
                  <div className={`text-2xl font-bold ${c.moduleText}`}>{formatTime(todayTotalMinutes)}</div>
                  <div className={`text-xs ${c.mutedText} mt-1`}>Total Time</div>
                </div>
                <div className={`${c.cardBg} border ${c.moduleBorder} rounded-lg p-4 text-center`}>
                  <div className={`text-2xl font-bold text-emerald-600`}>{completedActivities.length}</div>
                  <div className={`text-xs ${c.mutedText} mt-1`}>Completed Tasks</div>
                </div>
                <div className={`${c.cardBg} border ${c.moduleBorder} rounded-lg p-4 text-center`}>
                  <div className={`text-2xl font-bold ${c.moduleText}`}>{todayWorkChunks.length}</div>
                  <div className={`text-xs ${c.mutedText} mt-1`}>Work Sessions</div>
                </div>
              </div>

              {/* Work Sessions List */}
              <div>
                <h3 className={`text-sm font-bold ${c.moduleText} mb-3`}>Work Sessions</h3>
                <div className="space-y-3">
                  {todayWorkChunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className={`${c.cardBg} border ${c.moduleBorder} rounded-lg p-4`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className={`font-medium ${c.moduleText} text-sm`}>
                            {chunk.activity_title}
                          </div>
                          {chunk.course_name && (
                            <div className={`text-xs ${c.mutedText} mt-0.5`}>
                              {chunk.course_name}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {chunk.mood && (
                            <span className="text-lg">{getMoodEmoji(chunk.mood)}</span>
                          )}
                          <span className={`text-sm font-bold ${c.moduleText}`}>
                            {formatTime(getChunkMinutes(chunk))}
                          </span>
                        </div>
                      </div>
                      <div className={`text-xs ${c.mutedText}`}>
                        {formatTimeRange(chunk.start_time, chunk.end_time)}
                      </div>
                      {chunk.notes && (
                        <div className={`mt-2 text-xs ${c.text} bg-gray-50 dark:bg-gray-800 rounded p-2`}>
                          {chunk.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}