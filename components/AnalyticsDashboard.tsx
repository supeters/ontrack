'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Clock,
  TrendingUp,
  Calendar,
  BookOpen,
  BarChart3,
  Activity,
} from 'lucide-react';
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

interface DailyStat {
  date: string;
  totalMinutes: number;
  completedTasks: number;
  chunks: number;
}

interface CourseStat {
  courseName: string;
  totalMinutes: number;
  chunks: number;
  avgMood: string | null;
}

export default function AnalyticsDashboard({ kidId }: AnalyticsDashboardProps) {
  const { theme } = useTheme();
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');
  const [workChunks, setWorkChunks] = useState<WorkChunk[]>([]);
  const [loading, setLoading] = useState(true);

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

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const daysBack = timeRange === 'week' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const response = await fetch(
        `/api/analytics?kidId=${kidId}&startDate=${formatDateLocal(startDate)}&endDate=${formatDateLocal(new Date())}`
      );
      const data = await response.json();
      setWorkChunks(data.chunks || []);
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

  // Calculate daily stats
  const dailyStats: DailyStat[] = (() => {
    const stats = new Map<string, DailyStat>();
    const daysBack = timeRange === 'week' ? 7 : 30;

    // Initialize all dates
    for (let i = 0; i < daysBack; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (daysBack - 1 - i));
      const dateKey = formatDateLocal(date);
      stats.set(dateKey, { date: dateKey, totalMinutes: 0, completedTasks: 0, chunks: 0 });
    }

    // Fill in data from chunks
    workChunks.forEach((chunk) => {
      const dateKey = formatDateLocal(new Date(chunk.created_at));
      const stat = stats.get(dateKey);
      if (stat) {
        stat.totalMinutes += getChunkMinutes(chunk);
        stat.chunks += 1;
      }
    });

    return Array.from(stats.values());
  })();

  // Calculate course stats
  const courseStats: CourseStat[] = (() => {
    const stats = new Map<string, CourseStat>();

    workChunks.forEach((chunk) => {
      const courseName = chunk.course_name || 'General';
      if (!stats.has(courseName)) {
        stats.set(courseName, { courseName, totalMinutes: 0, chunks: 0, avgMood: null });
      }
      const stat = stats.get(courseName)!;
      stat.totalMinutes += getChunkMinutes(chunk);
      stat.chunks += 1;
    });

    return Array.from(stats.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  })();

  // Calculate mood distribution
  const moodStats = (() => {
    const moods = { struggled: 0, okay: 0, good: 0, great: 0, focused: 0 };
    workChunks.forEach((chunk) => {
      if (chunk.mood && chunk.mood in moods) {
        moods[chunk.mood as keyof typeof moods]++;
      }
    });
    return moods;
  })();

  const totalMinutes = workChunks.reduce((sum, chunk) => sum + getChunkMinutes(chunk), 0);
  const totalChunks = workChunks.length;
  const avgSessionLength = totalChunks > 0 ? Math.round(totalMinutes / totalChunks) : 0;
  const maxDailyMinutes = Math.max(...dailyStats.map((s) => s.totalMinutes), 1);

  const mostCommonMood = Object.entries(moodStats).sort((a, b) => b[1] - a[1])[0];

  if (loading) {
    return (
      <div className={`flex h-full w-full items-center justify-center min-h-[400px] ${c.bg}`}>
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-[#8c5a2b]`} />
      </div>
    );
  }

  return (
    <div className={`w-full min-h-screen ${c.bg} ${c.text}`}>
      {/* Header */}
      <div className={`${c.cardBg} border-b ${c.divider} px-6 py-4`}>
        <div className="flex items-center justify-between max-w-[1400px] mx-auto">
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${c.moduleText}`}>
              📊 Analytics Dashboard
            </h1>
            <p className={`text-xs mt-0.5 ${c.mutedText}`}>Time tracking & productivity insights</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeRange('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                timeRange === 'week'
                  ? `${c.checkboxChecked} text-white`
                  : `${c.cardBg} border ${c.moduleBorder} ${c.moduleText}`
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                timeRange === 'month'
                  ? `${c.checkboxChecked} text-white`
                  : `${c.cardBg} border ${c.moduleBorder} ${c.moduleText}`
              }`}
            >
              Last 30 Days
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <Clock className={`h-5 w-5 ${c.moduleIcon}`} />
              <span className={`text-xs ${c.mutedText}`}>Total Time</span>
            </div>
            <div className={`text-3xl font-bold ${c.moduleText}`}>{formatTime(totalMinutes)}</div>
          </div>

          <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <Activity className={`h-5 w-5 ${c.moduleIcon}`} />
              <span className={`text-xs ${c.mutedText}`}>Work Sessions</span>
            </div>
            <div className={`text-3xl font-bold ${c.moduleText}`}>{totalChunks}</div>
          </div>

          <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className={`h-5 w-5 ${c.moduleIcon}`} />
              <span className={`text-xs ${c.mutedText}`}>Avg Session</span>
            </div>
            <div className={`text-3xl font-bold ${c.moduleText}`}>{avgSessionLength}m</div>
          </div>

          <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">
                {mostCommonMood[0] === 'struggled' && '😫'}
                {mostCommonMood[0] === 'okay' && '😐'}
                {mostCommonMood[0] === 'good' && '🙂'}
                {mostCommonMood[0] === 'great' && '😊'}
                {mostCommonMood[0] === 'focused' && '🎯'}
              </span>
              <span className={`text-xs ${c.mutedText}`}>Most Common</span>
            </div>
            <div className={`text-lg font-bold ${c.moduleText} capitalize`}>{mostCommonMood[0]}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Time Chart */}
          <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl p-5 shadow-sm`}>
            <h3 className={`text-sm font-bold mb-4 ${c.moduleText} flex items-center gap-2`}>
              <Calendar className={`h-4 w-4 ${c.moduleIcon}`} />
              Daily Study Time
            </h3>
            <div className="space-y-2">
              {dailyStats.map((stat) => (
                <div key={stat.date} className="flex items-center gap-2">
                  <div className={`text-xs ${c.mutedText} w-20`}>
                    {new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className={`h-full ${c.checkboxChecked} flex items-center justify-end pr-2 transition-all`}
                      style={{ width: `${(stat.totalMinutes / maxDailyMinutes) * 100}%` }}
                    >
                      {stat.totalMinutes > 0 && (
                        <span className="text-white text-xs font-semibold">{formatTime(stat.totalMinutes)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Course Breakdown */}
          <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl p-5 shadow-sm`}>
            <h3 className={`text-sm font-bold mb-4 ${c.moduleText} flex items-center gap-2`}>
              <BookOpen className={`h-4 w-4 ${c.moduleIcon}`} />
              Time by Course
            </h3>
            <div className="space-y-3">
              {courseStats.slice(0, 8).map((stat) => (
                <div key={stat.courseName}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${c.moduleText} truncate`}>{stat.courseName}</span>
                    <span className={`text-xs font-bold ${c.moduleText}`}>{formatTime(stat.totalMinutes)}</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-full ${c.checkboxChecked} rounded-full transition-all`}
                      style={{ width: `${(stat.totalMinutes / courseStats[0].totalMinutes) * 100}%` }}
                    />
                  </div>
                  <div className={`text-[10px] ${c.mutedText} mt-0.5`}>{stat.chunks} sessions</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mood Distribution */}
        <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl p-5 shadow-sm`}>
          <h3 className={`text-sm font-bold mb-4 ${c.moduleText} flex items-center gap-2`}>
            <BarChart3 className={`h-4 w-4 ${c.moduleIcon}`} />
            Mood Distribution
          </h3>
          <div className="grid grid-cols-5 gap-3">
            {[
              { key: 'struggled', emoji: '😫', label: 'Struggled', color: 'bg-red-100 border-red-300' },
              { key: 'okay', emoji: '😐', label: 'Okay', color: 'bg-yellow-100 border-yellow-300' },
              { key: 'good', emoji: '🙂', label: 'Good', color: 'bg-blue-100 border-blue-300' },
              { key: 'great', emoji: '😊', label: 'Great', color: 'bg-green-100 border-green-300' },
              { key: 'focused', emoji: '🎯', label: 'Focused', color: 'bg-purple-100 border-purple-300' },
            ].map((mood) => (
              <div key={mood.key} className={`${mood.color} border-2 rounded-lg p-3 text-center`}>
                <div className="text-3xl mb-1">{mood.emoji}</div>
                <div className={`text-2xl font-bold ${c.moduleText}`}>
                  {moodStats[mood.key as keyof typeof moodStats]}
                </div>
                <div className={`text-xs ${c.mutedText}`}>{mood.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
