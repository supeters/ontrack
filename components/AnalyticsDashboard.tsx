'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Clock, BookOpen, Calendar, GraduationCap, TrendingUp, X } from 'lucide-react';
import { formatDateLocal } from '@/lib/datetime';

interface AnalyticsDashboardProps {
  kidId: number;
}

interface WorkChunk {
  id: number;
  activity_id: number;
  minutes_worked: number | null;
  start_time: string;
  end_time: string | null;
  mood: string | null;
  notes: string | null;
  created_at: string;
  activity_title?: string;
  course_name?: string;
}

interface ScheduledClass {
  id: number;
  plan_date: string;
  start_time: string;
  end_time: string;
  title: string;
  course_name?: string;
}

type TimeRange = 'today' | '7days' | 'month' | 'all';

export default function AnalyticsDashboard({ kidId }: AnalyticsDashboardProps) {
  const { theme } = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const [workChunks, setWorkChunks] = useState<WorkChunk[]>([]);
  const [scheduledClasses, setScheduledClasses] = useState<ScheduledClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [chunkFilterCourse, setChunkFilterCourse] = useState<string | null>(null);
  const [chunkFilterMood, setChunkFilterMood] = useState<string | null>(null);

  const c = theme?.colors || {
    bg: 'bg-[#f4efe6]',
    cardBg: 'bg-[#fcfaf7]',
    text: 'text-[#3d3122]',
    moduleText: 'text-[#3d3122]',
    moduleHeader: 'bg-[#e6ddcd]',
    moduleIcon: 'text-[#8c5a2b]',
    moduleBorder: 'border-[#d4c5b0]',
    mutedText: 'text-[#7d6c59]',
    divider: 'border-[#e0d5c3]',
    checkboxChecked: 'bg-[#8c5a2b]',
  };

  useEffect(() => {
    loadAnalytics();
  }, [kidId, timeRange]);

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (timeRange) {
      case 'today':
        return { start: today, end: now };
      case '7days':
        const week = new Date(today);
        week.setDate(week.getDate() - 6);
        return { start: week, end: now };
      case 'month':
        const month = new Date(today);
        month.setDate(month.getDate() - 29);
        return { start: month, end: now };
      case 'all':
        return { start: new Date(2020, 0, 1), end: now };
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const startStr = formatDateLocal(start);
      const endStr = formatDateLocal(end);
      const response = await fetch(
        `/api/analytics?kidId=${kidId}&startDate=${startStr}&endDate=${endStr}`
      );
      const data = await response.json();
      setWorkChunks(data.chunks || []);
      setScheduledClasses(data.scheduledClasses || []);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChunkMinutes = (chunk: WorkChunk): number => {
    if (chunk.minutes_worked) return chunk.minutes_worked;
    if (chunk.start_time && chunk.end_time) {
      const start = new Date(chunk.start_time);
      const end = new Date(chunk.end_time);
      return Math.round((end.getTime() - start.getTime()) / 60000);
    }
    return 0;
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Filter chunks by selected course if applicable
  const filteredChunks = selectedCourse
    ? workChunks.filter(c => c.course_name === selectedCourse)
    : workChunks;

  const studyByCourse = (() => {
    const courses = new Map<string, number>();
    workChunks.forEach((chunk) => {
      const course = chunk.course_name || 'General';
      courses.set(course, (courses.get(course) || 0) + getChunkMinutes(chunk));
    });
    return Array.from(courses.entries())
      .map(([name, minutes]) => ({ name, hours: minutes / 60 }))
      .sort((a, b) => b.hours - a.hours);
  })();

  const classByCourse = (() => {
    const courses = new Map<string, number>();
    scheduledClasses.forEach((cls) => {
      const course = cls.course_name || 'General';
      const start = new Date(cls.start_time);
      const end = new Date(cls.end_time);
      const minutes = (end.getTime() - start.getTime()) / 60000;
      courses.set(course, (courses.get(course) || 0) + minutes);
    });
    return Array.from(courses.entries())
      .map(([name, minutes]) => ({ name, hours: minutes / 60 }))
      .sort((a, b) => b.hours - a.hours);
  })();

  // Rolling chart data (daily or weekly based on time range)
  const rollingData = (() => {
    const useWeekly = timeRange === 'month' || timeRange === 'all';

    if (useWeekly) {
      // Weekly rolling data
      const weeks: Array<{ label: string; hours: number; weekStart: Date }> = [];
      const now = new Date();
      const numWeeks = timeRange === 'all' ? 12 : 4;

      for (let i = numWeeks - 1; i >= 0; i--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - (i * 7));
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);

        const weekChunks = filteredChunks.filter((chunk) => {
          const chunkDate = new Date(chunk.created_at);
          return chunkDate >= weekStart && chunkDate <= weekEnd;
        });

        const totalMinutes = weekChunks.reduce((sum, chunk) => sum + getChunkMinutes(chunk), 0);

        weeks.push({
          label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
          hours: totalMinutes / 60,
          weekStart,
        });
      }

      return weeks;
    } else {
      // Daily rolling data
      const { start } = getDateRange();
      const days: Array<{ label: string; hours: number; date: Date }> = [];
      const current = new Date(start);
      const end = new Date();

      while (current <= end) {
        const dateStr = formatDateLocal(current);
        const dayChunks = filteredChunks.filter((chunk) => {
          return formatDateLocal(new Date(chunk.created_at)) === dateStr;
        });

        const totalMinutes = dayChunks.reduce((sum, chunk) => sum + getChunkMinutes(chunk), 0);

        days.push({
          label: timeRange === 'today' ? 'Today' : current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          hours: totalMinutes / 60,
          date: new Date(current),
        });

        current.setDate(current.getDate() + 1);
      }

      return days;
    }
  })();

  const dailyBreakdown = (() => {
    const { start } = getDateRange();
    const days = new Map<string, { date: string; studyHours: number; classHours: number }>();
    const current = new Date(start);
    const end = new Date();
    while (current <= end) {
      const dateStr = formatDateLocal(current);
      days.set(dateStr, { date: dateStr, studyHours: 0, classHours: 0 });
      current.setDate(current.getDate() + 1);
    }
    workChunks.forEach((chunk) => {
      const dateStr = formatDateLocal(new Date(chunk.created_at));
      const day = days.get(dateStr);
      if (day) day.studyHours += getChunkMinutes(chunk) / 60;
    });
    scheduledClasses.forEach((cls) => {
      const day = days.get(cls.plan_date);
      if (day) {
        const start = new Date(cls.start_time);
        const end = new Date(cls.end_time);
        day.classHours += (end.getTime() - start.getTime()) / 60000 / 60;
      }
    });
    return Array.from(days.values());
  })();

  const totalStudyMinutes = workChunks.reduce((sum, chunk) => sum + getChunkMinutes(chunk), 0);
  const totalClassMinutes = scheduledClasses.reduce((sum, cls) => {
    const start = new Date(cls.start_time);
    const end = new Date(cls.end_time);
    return sum + (end.getTime() - start.getTime()) / 60000;
  }, 0);

  const maxStudyHours = Math.max(...studyByCourse.map(c => c.hours), 1);
  const maxClassHours = Math.max(...classByCourse.map(c => c.hours), 1);
  const maxDailyHours = Math.max(...dailyBreakdown.map(d => Math.max(d.studyHours, d.classHours)), 1);
  const maxRollingHours = Math.max(...rollingData.map(d => d.hours), 1);

  if (loading) {
    return (
      <div className={`flex h-full w-full items-center justify-center min-h-[400px] ${c.bg}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8c5a2b]" />
      </div>
    );
  }

  return (
    <div className={`w-full min-h-screen ${c.bg} ${c.text}`}>
      <div className={`${c.cardBg} border-b ${c.divider} px-6 py-4`}>
        <div className="flex items-center justify-between max-w-[1400px] mx-auto">
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${c.moduleText}`}>Analytics</h1>
            <p className={`text-xs mt-0.5 ${c.mutedText}`}>Study time & class attendance</p>
          </div>
          <div className="flex gap-2">
            {(['today', '7days', 'month', 'all'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  timeRange === range
                    ? `${c.checkboxChecked} text-white`
                    : `${c.cardBg} border ${c.moduleBorder} ${c.moduleText}`
                }`}
              >
                {range === 'today' && 'Today'}
                {range === '7days' && '7 Days'}
                {range === 'month' && 'Month'}
                {range === 'all' && 'All Time'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl p-5 shadow-sm`}>
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className={`h-5 w-5 ${c.moduleIcon}`} />
              <span className={`text-sm font-semibold ${c.moduleText}`}>Study Hours</span>
            </div>
            <div className={`text-3xl font-bold ${c.moduleText}`}>
              {(totalStudyMinutes / 60).toFixed(1)}h
            </div>
            <div className={`text-xs ${c.mutedText} mt-1`}>{workChunks.length} sessions</div>
          </div>

          <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl p-5 shadow-sm`}>
            <div className="flex items-center gap-3 mb-2">
              <GraduationCap className={`h-5 w-5 ${c.moduleIcon}`} />
              <span className={`text-sm font-semibold ${c.moduleText}`}>Class Hours</span>
            </div>
            <div className={`text-3xl font-bold ${c.moduleText}`}>
              {(totalClassMinutes / 60).toFixed(1)}h
            </div>
            <div className={`text-xs ${c.mutedText} mt-1`}>{scheduledClasses.length} classes</div>
          </div>

          <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl p-5 shadow-sm`}>
            <div className="flex items-center gap-3 mb-2">
              <Clock className={`h-5 w-5 ${c.moduleIcon}`} />
              <span className={`text-sm font-semibold ${c.moduleText}`}>Average Session</span>
            </div>
            <div className={`text-3xl font-bold ${c.moduleText}`}>
              {workChunks.length > 0 ? Math.round(totalStudyMinutes / workChunks.length) : 0}m
            </div>
            <div className={`text-xs ${c.mutedText} mt-1`}>per study session</div>
          </div>
        </div>

        {/* Rolling Study Hours Chart */}
        <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl p-5 shadow-sm`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-bold ${c.moduleText} flex items-center gap-2`}>
              <TrendingUp className={`h-4 w-4 ${c.moduleIcon}`} />
              {timeRange === 'month' || timeRange === 'all' ? 'Weekly' : 'Daily'} Study Hours
              {selectedCourse && ` - ${selectedCourse}`}
            </h3>
            {selectedCourse && (
              <button
                onClick={() => setSelectedCourse(null)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${c.mutedText} hover:${c.moduleText} transition-colors`}
              >
                <X className="h-3 w-3" />
                Clear filter
              </button>
            )}
          </div>
          <div className="flex items-end justify-around gap-2 h-56">
            {rollingData.map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div className="flex-1 w-full flex flex-col justify-end items-center">
                  {item.hours > 0 && (
                    <div className={`text-xs font-semibold mb-1 ${c.moduleText}`}>
                      {item.hours.toFixed(1)}h
                    </div>
                  )}
                  <div
                    className={`w-full ${c.checkboxChecked} rounded-t transition-all min-h-[4px]`}
                    style={{ height: `${(item.hours / maxRollingHours) * 180}px` }}
                    title={`${item.label}: ${item.hours.toFixed(1)}h`}
                  />
                </div>
                <div className={`text-[10px] ${c.mutedText} text-center font-medium whitespace-nowrap`}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl p-5 shadow-sm`}>
          <h3 className={`text-sm font-bold mb-4 ${c.moduleText} flex items-center gap-2`}>
            <BookOpen className={`h-4 w-4 ${c.moduleIcon}`} />
            Study Hours by Course
          </h3>
          {studyByCourse.length > 0 ? (
            <div className="space-y-3">
              {studyByCourse.map((course) => (
                <div
                  key={course.name}
                  className={`cursor-pointer p-2 rounded-lg transition-colors ${
                    selectedCourse === course.name ? c.moduleHeader : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedCourse(selectedCourse === course.name ? null : course.name)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${c.moduleText}`}>{course.name}</span>
                    <span className={`text-sm font-bold ${c.moduleIcon}`}>{course.hours.toFixed(1)}h</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2.5">
                    <div
                      className={`h-full ${c.checkboxChecked} rounded-full transition-all`}
                      style={{ width: `${(course.hours / maxStudyHours) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-sm ${c.mutedText}`}>No study time recorded</p>
          )}
        </div>

        <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl p-5 shadow-sm`}>
          <h3 className={`text-sm font-bold mb-4 ${c.moduleText} flex items-center gap-2`}>
            <GraduationCap className={`h-4 w-4 ${c.moduleIcon}`} />
            Class Hours by Course
          </h3>
          {classByCourse.length > 0 ? (
            <div className="space-y-3">
              {classByCourse.map((course) => (
                <div key={course.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${c.moduleText}`}>{course.name}</span>
                    <span className={`text-sm font-bold ${c.moduleIcon}`}>{course.hours.toFixed(1)}h</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2.5">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${(course.hours / maxClassHours) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-sm ${c.mutedText}`}>No classes scheduled</p>
          )}
        </div>

        {timeRange !== 'all' && (
          <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl p-5 shadow-sm`}>
            <h3 className={`text-sm font-bold mb-4 ${c.moduleText} flex items-center gap-2`}>
              <Calendar className={`h-4 w-4 ${c.moduleIcon}`} />
              Daily Breakdown
            </h3>
            <div className="flex items-end justify-around gap-2 h-56 mb-4">
              {dailyBreakdown.map((day, idx) => {
                const date = new Date(day.date);
                const dayLabel = timeRange === 'today' ? 'Today' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 max-w-[60px]">
                    <div className="flex-1 w-full flex flex-col justify-end items-center gap-1">
                      {day.studyHours > 0 && (
                        <div className={`w-full ${c.checkboxChecked} rounded-t transition-all min-h-[4px]`}
                          style={{ height: `${(day.studyHours / maxDailyHours) * 180}px` }}
                          title={`Study: ${day.studyHours.toFixed(1)}h`} />
                      )}
                      {day.classHours > 0 && (
                        <div className="w-full bg-blue-500 rounded-t transition-all min-h-[4px]"
                          style={{ height: `${(day.classHours / maxDailyHours) * 180}px` }}
                          title={`Class: ${day.classHours.toFixed(1)}h`} />
                      )}
                    </div>
                    <div className={`text-[10px] ${c.mutedText} text-center font-medium`}>{dayLabel}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-6 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 ${c.checkboxChecked} rounded`}></div>
                <span className={`text-xs ${c.mutedText}`}>Study</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className={`text-xs ${c.mutedText}`}>Class</span>
              </div>
            </div>
          </div>
        )}

        <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl p-5 shadow-sm`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-bold ${c.moduleText} flex items-center gap-2`}>
              <Clock className={`h-4 w-4 ${c.moduleIcon}`} />
              Study Sessions
            </h3>
            <div className="flex gap-2">
              <select
                value={chunkFilterCourse || ''}
                onChange={(e) => setChunkFilterCourse(e.target.value || null)}
                className={`px-2 py-1 rounded text-xs border ${c.moduleBorder} ${c.moduleText} bg-white`}
              >
                <option value="">All Courses</option>
                {studyByCourse.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
              <select
                value={chunkFilterMood || ''}
                onChange={(e) => setChunkFilterMood(e.target.value || null)}
                className={`px-2 py-1 rounded text-xs border ${c.moduleBorder} ${c.moduleText} bg-white`}
              >
                <option value="">All Moods</option>
                <option value="struggled">😫 Struggled</option>
                <option value="okay">😐 Okay</option>
                <option value="good">🙂 Good</option>
                <option value="great">😊 Great</option>
                <option value="focused">🎯 Focused</option>
              </select>
            </div>
          </div>
          {workChunks.length > 0 ? (
            <div className="space-y-2">
              {workChunks
                .filter(chunk => !chunkFilterCourse || chunk.course_name === chunkFilterCourse)
                .filter(chunk => !chunkFilterMood || chunk.mood === chunkFilterMood)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((chunk) => {
                  const date = new Date(chunk.created_at);
                  const minutes = getChunkMinutes(chunk);
                  return (
                    <div key={chunk.id} className={`border ${c.moduleBorder} rounded-lg p-3 hover:${c.moduleHeader} transition-colors`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-semibold ${c.moduleText}`}>{chunk.course_name || 'General'}</span>
                            {chunk.mood && (
                              <span className="text-sm">
                                {chunk.mood === 'struggled' && '😫'}
                                {chunk.mood === 'okay' && '😐'}
                                {chunk.mood === 'good' && '🙂'}
                                {chunk.mood === 'great' && '😊'}
                                {chunk.mood === 'focused' && '🎯'}
                              </span>
                            )}
                          </div>
                          {chunk.activity_title && <div className={`text-xs ${c.mutedText} mb-1`}>{chunk.activity_title}</div>}
                          {chunk.notes && <div className={`text-xs ${c.moduleText} mt-2 italic`}>{chunk.notes}</div>}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`text-sm font-bold ${c.moduleIcon}`}>{formatTime(minutes)}</span>
                          <span className={`text-xs ${c.mutedText}`}>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          <span className={`text-xs ${c.mutedText}`}>{date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className={`text-sm ${c.mutedText}`}>No study sessions recorded</p>
          )}
        </div>
      </div>
    </div>
  );
}
