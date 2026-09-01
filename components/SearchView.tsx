'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  X,
  Filter,
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import ActivityDetailModal from './ActivityDetailModal';

interface SearchViewProps {
  kidId: number;
  academicYear?: string;
}

export default function SearchView({ kidId, academicYear }: SearchViewProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedType, setSelectedType] = useState('assignment');
  const [selectedStatus, setSelectedStatus] = useState('incomplete');
  const [hasPlannedDate, setHasPlannedDate] = useState('true');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minTime, setMinTime] = useState('');
  const [maxTime, setMaxTime] = useState('');

  const [results, setResults] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [sortBy, setSortBy] = useState<'title' | 'course' | 'type' | 'plan_date' | 'status'>('plan_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Load available courses
  useEffect(() => {
    const loadCourses = async () => {
      const res = await fetch(`/api/courses?kidId=${kidId}${academicYear ? `&academicYear=${academicYear}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setCourses(Array.isArray(data) ? data : []);
      }
    };
    loadCourses();
  }, [kidId, academicYear]);

  // Perform search
  const performSearch = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      kidId: kidId.toString(),
    });

    if (searchQuery.trim()) params.append('query', searchQuery.trim());
    if (selectedCourse !== 'all') params.append('courseId', selectedCourse);
    if (selectedType !== 'all') params.append('activityType', selectedType);
    if (selectedStatus !== 'all') params.append('status', selectedStatus);
    if (hasPlannedDate !== 'all') params.append('hasPlannedDate', hasPlannedDate);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (minTime) params.append('minTime', minTime);
    if (maxTime) params.append('maxTime', maxTime);
    if (academicYear) params.append('academicYear', academicYear);

    const res = await fetch(`/api/search?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setResults(data.activities || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCourse, selectedType, selectedStatus, hasPlannedDate, startDate, endDate, minTime, maxTime]);

  // Sort results
  const sortedResults = useMemo(() => {
    const sorted = [...results];
    sorted.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case 'title':
          aVal = a.title?.toLowerCase() || '';
          bVal = b.title?.toLowerCase() || '';
          break;
        case 'course':
          aVal = a.course?.course_name?.toLowerCase() || '';
          bVal = b.course?.course_name?.toLowerCase() || '';
          break;
        case 'type':
          aVal = a.activity_type || '';
          bVal = b.activity_type || '';
          break;
        case 'plan_date':
          aVal = a.plan_date || '9999-99-99';
          bVal = b.plan_date || '9999-99-99';
          break;
        case 'status':
          aVal = a.is_completed ? 1 : 0;
          bVal = b.is_completed ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [results, sortBy, sortDirection]);

  const toggleCompletion = async (activity: any) => {
    const newStatus = !activity.is_completed;
    const res = await fetch('/api/activities', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: activity.id,
        is_completed: newStatus,
      }),
    });

    if (res.ok) {
      // Refresh search results
      performSearch();
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCourse('all');
    setSelectedType('all');
    setSelectedStatus('all');
    setHasPlannedDate('all');
    setStartDate('');
    setEndDate('');
    setMinTime('');
    setMaxTime('');
  };

  const activeFilterCount = [
    selectedCourse !== 'all',
    selectedType !== 'all',
    selectedStatus !== 'all',
    hasPlannedDate !== 'all',
    startDate,
    endDate,
    minTime,
    maxTime,
  ].filter(Boolean).length;

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  return (
    <div className={`flex flex-col h-full ${c.bg}`}>
      {/* Header */}
      <div className={`border-b ${c.divider} p-6 ${c.cardBg}`}>
        <h1 className={`text-2xl font-semibold ${c.moduleText} mb-4`}>Search Activities</h1>

        {/* Search Input */}
        <div className="relative mb-4">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${c.mutedText}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, description, or notes..."
            className={`w-full pl-10 pr-10 py-3 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.activityText} focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${c.mutedText} hover:${c.moduleText}`}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText} hover:bg-stone-100 transition-colors`}
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className={`text-sm ${c.mutedText} hover:${c.moduleText} transition-colors`}
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className={`mt-4 p-4 border ${c.moduleBorder} rounded-lg ${c.cardBg} grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`}>
            {/* Course Filter */}
            <div>
              <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Course</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.activityText} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="all">All Courses</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Activity Type Filter */}
            <div>
              <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.activityText} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="all">All Types</option>
                <option value="assignment">Assignment</option>
                <option value="quiz">Quiz</option>
                <option value="reading">Reading</option>
                <option value="video">Video</option>
                <option value="task">Task</option>
                <option value="module">Module</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.activityText} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="all">All</option>
                <option value="incomplete">Incomplete</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            {/* Planned Date Filter */}
            <div>
              <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Planned</label>
              <select
                value={hasPlannedDate}
                onChange={(e) => setHasPlannedDate(e.target.value)}
                className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.activityText} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="all">All</option>
                <option value="true">Has plan date</option>
                <option value="false">No plan date</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.activityText} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>

            {/* End Date */}
            <div>
              <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.activityText} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>

            {/* Min Time */}
            <div>
              <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Min Time (minutes)</label>
              <input
                type="number"
                value={minTime}
                onChange={(e) => setMinTime(e.target.value)}
                placeholder="0"
                className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.activityText} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>

            {/* Max Time */}
            <div>
              <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Max Time (minutes)</label>
              <input
                type="number"
                value={maxTime}
                onChange={(e) => setMaxTime(e.target.value)}
                placeholder="999"
                className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.activityText} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className={`text-center py-12 ${c.mutedText}`}>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-900 mx-auto mb-4"></div>
            <p>Searching...</p>
          </div>
        ) : results.length === 0 ? (
          <div className={`text-center py-12 ${c.mutedText}`}>
            <Search className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm mt-2">Try adjusting your search criteria</p>
          </div>
        ) : (
          <div>
            <div className={`text-sm ${c.mutedText} mb-4`}>
              Showing {results.length} result{results.length !== 1 ? 's' : ''} (limited to 20)
            </div>

            {/* Table View */}
            <div className={`border ${c.moduleBorder} rounded-lg overflow-hidden ${c.cardBg}`}>
              <table className="w-full">
                <thead className={`${c.moduleHeader} border-b ${c.divider}`}>
                  <tr>
                    <th className="w-12"></th>
                    <th
                      className={`px-4 py-3 text-left text-sm font-semibold ${c.moduleText} cursor-pointer hover:bg-stone-200`}
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center gap-2">
                        Title
                        {sortBy === 'title' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-sm font-semibold ${c.moduleText} cursor-pointer hover:bg-stone-200`}
                      onClick={() => handleSort('course')}
                    >
                      <div className="flex items-center gap-2">
                        Course
                        {sortBy === 'course' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-sm font-semibold ${c.moduleText} cursor-pointer hover:bg-stone-200`}
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center gap-2">
                        Type
                        {sortBy === 'type' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-sm font-semibold ${c.moduleText} cursor-pointer hover:bg-stone-200`}
                      onClick={() => handleSort('plan_date')}
                    >
                      <div className="flex items-center gap-2">
                        Plan Date
                        {sortBy === 'plan_date' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-sm font-semibold ${c.moduleText} cursor-pointer hover:bg-stone-200`}
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        Status
                        {sortBy === 'status' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${c.divider}`}>
                  {sortedResults.map((activity) => {
                    const isOverdue = !activity.is_completed && activity.plan_date && activity.plan_date < new Date().toISOString().split('T')[0];

                    return (
                      <tr
                        key={activity.id}
                        className={`${c.activityHover} transition-colors cursor-pointer`}
                        onClick={() => setSelectedActivity(activity)}
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCompletion(activity);
                            }}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              activity.is_completed
                                ? c.checkboxChecked
                                : c.checkboxBorder + ' hover:border-stone-400'
                            }`}
                          >
                            {activity.is_completed && (
                              <svg className="h-3 text-white w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        </td>
                        <td className={`px-4 py-3 ${c.activityText}`}>
                          <div className="flex items-center gap-2">
                            {activity.title}
                            {isOverdue && <AlertCircle className="h-4 w-4 text-red-500" />}
                          </div>
                          {activity.description && (
                            <div className={`text-xs ${c.mutedText} mt-1 line-clamp-1`}>
                              {activity.description}
                            </div>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-sm ${c.activityText}`}>
                          {activity.course?.course_name || 'No Course'}
                        </td>
                        <td className={`px-4 py-3 text-sm ${c.activityText}`}>
                          <span className={`px-2 py-1 rounded ${c.moduleBorder} border bg-stone-50 text-xs`}>
                            {activity.activity_type || 'task'}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm ${c.activityText}`}>
                          {activity.plan_date ? (
                            <span className={`px-2 py-1 rounded text-xs ${isOverdue ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                              {new Date(activity.plan_date + 'T00:00:00').toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          ) : (
                            <span className={`text-xs ${c.mutedText}`}>-</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-sm ${c.activityText}`}>
                          {activity.is_completed ? (
                            <span className="flex items-center gap-1 text-xs text-green-700">
                              <CheckCircle2 className="h-3 w-3" />
                              Complete
                            </span>
                          ) : (
                            <span className={`text-xs ${c.mutedText}`}>Incomplete</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          onUpdate={() => {
            performSearch();
          }}
        />
      )}
    </div>
  );
}
