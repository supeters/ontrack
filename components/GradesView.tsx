'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatDateLocal } from '@/lib/datetime';
import { 
  Award, 
  MessageSquare, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Sparkles,
  BookOpen,
  Filter
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface Grade {
  id: number;
  activity_title: string;
  course_name: string;
  score: number | null;
  grade: string | null;
  points_possible: number | null;
  submitted_at: string | null;
  graded_at: string | null;
  late: boolean;
  missing: boolean;
  needs_grading: boolean;
  workflow_state: string | null;
  submission_comments: Array<{
    author: string | { display_name?: string };
    comment: string;
    created_at: string;
  }> | null;
  due_date: string | null;
}

interface GradesViewProps {
  kidId: number;
  selectedCourse?: { id: number; name: string } | null;
  schoolYear?: string;
}

export default function GradesView({ kidId, selectedCourse, schoolYear }: GradesViewProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'graded' | 'missing' | 'feedback'>('all');

  useEffect(() => {
    loadGrades();
  }, [kidId, selectedCourse, schoolYear]);

  const loadGrades = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ kid_id: kidId.toString() });
      if (selectedCourse?.id) {
        params.append('course_id', selectedCourse.id.toString());
      }
      if (schoolYear) {
        params.append('school_year', schoolYear);
      }

      const response = await fetch(`/api/grades?${params}`);
      const data = await response.json();

      if (Array.isArray(data)) {
        setGrades(data);
      } else {
        setGrades([]);
      }
    } catch (error) {
      console.error('Error loading grades:', error);
      setGrades([]);
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade: Grade) => {
    if (grade.missing) return 'text-red-600';
    if (grade.late) return 'text-orange-600';
    if (grade.needs_grading) return 'text-blue-600';
    if (grade.score !== null && grade.points_possible !== null) {
      const percentage = (grade.score / grade.points_possible) * 100;
      if (percentage >= 90) return 'text-green-600';
      if (percentage >= 80) return 'text-blue-600';
      if (percentage >= 70) return 'text-yellow-600';
      return 'text-orange-600';
    }
    return c.activityText || 'text-gray-600';
  };
  // 1. Get recently graded items (last 5 graded assignments)
  const recentlyGraded = useMemo(() => {
    return [...grades]
      .filter((g) => g.graded_at || g.score !== null)
      .sort((a, b) => new Date(b.graded_at || 0).getTime() - new Date(a.graded_at || 0).getTime())
      .slice(0, 4);
  }, [grades]);

  // 2. Extract unique course list
  const coursesList = useMemo(() => {
    const courses = new Set(grades.map((g) => g.course_name));
    return Array.from(courses);
  }, [grades]);

  // 3. Filtered grades list based on dropdown selections
  const filteredGrades = useMemo(() => {
    return grades.filter((g) => {
      const matchCourse = selectedCourseFilter === 'all' || g.course_name === selectedCourseFilter;
      
      if (!matchCourse) return false;

      if (statusFilter === 'graded') return g.graded_at !== null || g.score !== null;
      if (statusFilter === 'missing') return g.missing;
      if (statusFilter === 'feedback') return g.submission_comments && g.submission_comments.length > 0;

      return true;
    });
  }, [grades, selectedCourseFilter, statusFilter]);

  // 4. Group filtered grades by course
  const gradesByCourse = useMemo(() => {
    return filteredGrades.reduce<Record<string, Grade[]>>((acc, grade) => {
      if (!acc[grade.course_name]) {
        acc[grade.course_name] = [];
      }
      acc[grade.course_name].push(grade);
      return acc;
    }, {});
  }, [filteredGrades]);

  const getScorePercentage = (score: number | null, possible: number | null) => {
    if (score === null || possible === null || possible === 0) return null;
    return Math.round((score / possible) * 100);
  };

  const getScoreBadgeClass = (pct: number | null) => {
    if (pct === null) return 'bg-gray-100 text-gray-700';
    if (pct >= 90) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (pct >= 80) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (pct >= 70) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-rose-100 text-rose-800 border-rose-200';
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin border-4 border-blue-500 border-t-transparent h-10 mb-3 mx-auto rounded-full w-10"></div>
          <p className={c.activityText}>Loading your grades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl md:p-6 mx-auto p-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className={`flex font-bold gap-2 items-center text-2xl md:text-3xl ${c.moduleText}`}>
          <Award className="h-7 text-amber-500 w-7" />
          Grades & Teacher Feedback
        </h1>
        <p className={`mt-1 text-sm md:text-base ${c.activityText}`}>
          Track your progress, review scores, and read comments from your teachers.
        </p>
      </div>

      {/* --- SECTION 1: RECENTLY GRADED HIGHLIGHTS --- */}
      {recentlyGraded.length > 0 && (
        <section className="space-y-3">
          <div className="flex gap-2 items-center">
            <Sparkles className="h-5 text-amber-500 w-5" />
            <h2 className={`font-bold text-lg ${c.moduleText}`}>Recently Graded</h2>
          </div>

          <div className="gap-4 grid grid-cols-1 lg:grid-cols-4 sm:grid-cols-2">
            {recentlyGraded.map((item) => {
              const pct = getScorePercentage(item.score, item.points_possible);
              const hasComments = item.submission_comments && item.submission_comments.length > 0;

              return (
                <div
                  key={`recent-${item.id}`}
                  className={`${c.cardBg} border ${c.divider} p-4 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden`}
                >
                  <div>
                    <div className="flex gap-2 items-start justify-between mb-2">
                      <span className="bg-blue-50 font-semibold max-w-[120px] px-2 py-0.5 rounded text-blue-700 text-xs truncate">
                        {item.course_name}
                      </span>
                      {pct !== null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getScoreBadgeClass(pct)}`}>
                          {pct}%
                        </span>
                      )}
                    </div>

                    <h3 className={`font-semibold text-sm line-clamp-2 ${c.moduleText}`}>
                      {item.activity_title}
                    </h3>
                  </div>

                  <div className="border-gray-100 border-t flex items-center justify-between mt-4 pt-3 text-xs">
                    <span className={c.activityText}>
                      {item.graded_at ? formatDateLocal(item.graded_at, 'MMM d') : 'Graded'}
                    </span>
                    {hasComments && (
                      <span className="bg-blue-50 flex font-medium gap-1 items-center px-2 py-0.5 rounded text-blue-600">
                        <MessageSquare className="h-3 w-3" /> Note
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* --- SECTION 2: FILTERS & CONTROLS --- */}
      <div className={`${c.cardBg} border ${c.divider} p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-center justify-between`}>
        <div className="flex font-semibold gap-2 items-center text-sm">
          <Filter className="h-4 text-gray-500 w-4" />
          <span>Filter View:</span>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Course Selector */}
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-1.5 rounded-lg text-sm"
          >
            <option value="all">All Courses ({coursesList.length})</option>
            {coursesList.map((course) => (
              <option key={course} value={course}>
                {course}
              </option>
            ))}
          </select>

          {/* Status Filter Buttons */}
          <div className="bg-gray-50 border border-gray-200 font-medium inline-flex p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'all' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('graded')}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'graded' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Graded
            </button>
            <button
              onClick={() => setStatusFilter('missing')}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'missing' ? 'bg-white shadow-xs text-red-600 font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Missing
            </button>
            <button
              onClick={() => setStatusFilter('feedback')}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'feedback' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              With Notes
            </button>
          </div>
        </div>
      </div>

      {/* --- SECTION 3: COURSE-BY-COURSE BREAKDOWN --- */}
      {Object.keys(gradesByCourse).length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 py-12 rounded-xl text-center">
          <Award className="h-12 mb-3 mx-auto text-gray-300 w-12" />
          <p className={`font-medium ${c.activityText}`}>No assignments match your current filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(gradesByCourse).map(([courseName, courseGrades]) => (
            <div
              key={courseName}
              className={`${c.cardBg} border ${c.divider} rounded-xl shadow-sm overflow-hidden`}
            >
              {/* Course Header Banner */}
              <div className="bg-gray-50/80 border-b border-gray-100 flex items-center justify-between px-5 py-3">
                <div className="flex gap-2 items-center">
                  <BookOpen className="h-5 text-blue-600 w-5" />
                  <h3 className={`font-bold text-base ${c.moduleText}`}>{courseName}</h3>
                </div>
                <span className="bg-white border border-gray-200 font-semibold px-2.5 py-1 rounded-full text-gray-500 text-xs">
                  {courseGrades.length} {courseGrades.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Assignment Item List */}
              <div className="divide-gray-100 divide-y">
                {courseGrades.map((grade) => {
                  const pct = getScorePercentage(grade.score, grade.points_possible);

                  return (
                    <div key={grade.id} className="hover:bg-gray-50/50 p-4 space-y-3 transition-colors">
                      <div className="flex flex-col gap-2 justify-between sm:flex-row sm:items-center">
                        {/* Title & Status */}
                        <div className="flex-1">
                          <div className="flex flex-wrap gap-2 items-center">
                            <h4 className={`font-semibold text-sm ${c.moduleText}`}>
                              {grade.activity_title}
                            </h4>
                            {grade.missing && (
                              <span className="bg-rose-100 font-medium gap-1 inline-flex items-center px-2 py-0.5 rounded text-rose-700 text-xs">
                                <AlertCircle className="h-3 w-3" /> Missing
                              </span>
                            )}
                            {grade.late && (
                              <span className="bg-amber-100 font-medium gap-1 inline-flex items-center px-2 py-0.5 rounded text-amber-700 text-xs">
                                <Clock className="h-3 w-3" /> Late
                              </span>
                            )}
                            {grade.needs_grading && (
                              <span className="bg-blue-100 font-medium gap-1 inline-flex items-center px-2 py-0.5 rounded text-blue-700 text-xs">
                                <Clock className="h-3 w-3" /> Pending Grade
                              </span>
                            )}
                          </div>

                          <div className="flex gap-3 items-center mt-1 text-gray-500 text-xs">
                            {grade.due_date && (
                              <span>Due: {formatDateLocal(grade.due_date, 'M/d/yy')}</span>
                            )}
                            {grade.submitted_at && (
                              <span>Submitted: {formatDateLocal(grade.submitted_at, 'M/d/yy')}</span>
                            )}
                          </div>
                        </div>

                        {/* Score Display */}
                        <div className="flex gap-3 items-center sm:block text-right">
                          {grade.score !== null ? (
                            <div>
                              <span className={`text-base font-bold ${getGradeColor(grade)}`}>
                                {grade.score}
                                {grade.points_possible !== null && ` / ${grade.points_possible}`}
                              </span>
                              {pct !== null && (
                                <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-md border ${getScoreBadgeClass(pct)}`}>
                                  {pct}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="italic text-gray-400 text-xs">Unscored</span>
                          )}
                        </div>
                      </div>

                      {/* Teacher Feedback Callout */}
                      {grade.submission_comments && grade.submission_comments.length > 0 && (
                        <div className="bg-blue-50/60 border border-blue-100 mt-2 p-3 rounded-lg space-y-2 text-xs">
                          <div className="flex font-semibold gap-1.5 items-center text-blue-900">
                            <MessageSquare className="h-3.5 text-blue-600 w-3.5" />
                            <span>Teacher Feedback</span>
                          </div>
                          {grade.submission_comments.map((comment, idx) => (
                            <div key={idx} className="border-blue-300 border-l-2 pl-5">
                              <p className="text-gray-800">{comment.comment}</p>
                              <span className="block mt-0.5 text-[10px] text-gray-500">
                                — {typeof comment.author === 'string' ? comment.author : comment.author?.display_name || 'Teacher'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}