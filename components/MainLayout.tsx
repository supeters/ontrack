'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { BookOpen, Calendar, Settings, LogOut, Palette, ChevronDown, ChevronUp, Home } from 'lucide-react';
import CoursesView from './CoursesView';
import AgendaView from './AgendaView';
import PlannerView from './PlannerView';
import SettingsView from './SettingsView';
import { themes } from '@/lib/themes';

interface Course {
  id: number;
  name: string;
  school: string;
  calendar_id: number;
}

export default function MainLayout() {
  const { signOut, user, kids, selectedKid, setSelectedKid } = useAuth();
  const { theme, currentTheme, changeTheme } = useTheme();
  const [selectedView, setSelectedView] = useState<'agenda' | 'planner' | 'courses' | 'settings'>('agenda');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('2025-26');
  const [showKidDropdown, setShowKidDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [coursesExpanded, setCoursesExpanded] = useState(true);

  const schoolYears = ['2024-25', '2025-26', '2026-27'];

  // Load courses when selectedKid or selectedSchoolYear changes
  useEffect(() => {
    if (!selectedKid) {
      setCourses([]);
      setSelectedCourse(null);
      return;
    }

    loadCourses();
  }, [selectedKid, selectedSchoolYear]);

  // Listen for course created events
  useEffect(() => {
    const handleCourseCreated = () => {
      loadCourses();
    };

    window.addEventListener('courseCreated', handleCourseCreated);
    return () => window.removeEventListener('courseCreated', handleCourseCreated);
  }, [selectedKid, selectedSchoolYear]);

  const loadCourses = async () => {
    if (!selectedKid) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/courses?kidId=${selectedKid.id}&schoolYear=${selectedSchoolYear}`);
      const data = await response.json();
      setCourses(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading courses:', error);
      setLoading(false);
    }
  };

  const c = theme.colors;

  return (
    <div className={`h-screen flex flex-col ${c.bg}`}>
      {/* Top Bar */}
      <div className={`${c.cardBg} border-b ${c.divider} px-6 py-3.5 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <h1 className={`text-xl font-semibold ${c.moduleText}`}>OnTrack</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Kid Selector */}
          {kids && kids.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowKidDropdown(!showKidDropdown)}
                className={`flex items-center gap-2 px-3 py-1.5 ${c.workgroupBg} rounded-lg ${c.activityHover.replace('border-transparent', '')} transition-colors text-sm`}
              >
                <span className={`font-medium ${c.moduleText}`}>
                  {selectedKid?.name || 'Select Student'}
                </span>
                <svg className={`w-4 h-4 ${c.mutedText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showKidDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowKidDropdown(false)} />
                  <div className={`absolute right-0 mt-2 w-48 ${c.cardBg} rounded-lg shadow-lg border ${c.divider} py-1 z-20`}>
                    {kids.map((kid) => (
                      <button
                        key={kid.id}
                        onClick={() => {
                          setSelectedKid(kid);
                          setShowKidDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm ${c.activityHover.replace('border-transparent', '')} ${
                          selectedKid?.id === kid.id ? `${c.workgroupBg} ${c.moduleText} font-medium` : c.activityText
                        }`}
                      >
                        {kid.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* School Year Selector */}
          <div className="relative">
            <button
              onClick={() => setShowYearDropdown(!showYearDropdown)}
              className={`flex items-center gap-2 px-3 py-1.5 ${c.workgroupBg} rounded-lg ${c.activityHover.replace('border-transparent', '')} transition-colors text-sm`}
            >
              <Calendar className={`w-4 h-4 ${c.mutedText}`} />
              <span className={`font-medium ${c.moduleText}`}>{selectedSchoolYear}</span>
              <svg className={`w-4 h-4 ${c.mutedText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showYearDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowYearDropdown(false)} />
                <div className={`absolute right-0 mt-2 w-32 ${c.cardBg} rounded-lg shadow-lg border ${c.divider} py-1 z-20`}>
                  {schoolYears.map((year) => (
                    <button
                      key={year}
                      onClick={() => {
                        setSelectedSchoolYear(year);
                        setShowYearDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm ${c.activityHover.replace('border-transparent', '')} ${
                        selectedSchoolYear === year ? `${c.workgroupBg} ${c.moduleText} font-medium` : c.activityText
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Theme Selector */}
          <div className="relative">
            <button
              onClick={() => setShowThemeDropdown(!showThemeDropdown)}
              className={`flex items-center gap-2 px-3 py-1.5 ${c.workgroupBg} rounded-lg ${c.activityHover.replace('border-transparent', '')} transition-colors text-sm`}
            >
              <Palette className={`w-4 h-4 ${c.mutedText}`} />
              <span className={`font-medium ${c.moduleText} capitalize`}>{currentTheme}</span>
            </button>

            {showThemeDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowThemeDropdown(false)} />
                <div className={`absolute right-0 mt-2 w-52 ${c.cardBg} rounded-lg shadow-lg border ${c.divider} py-2 z-20`}>
                  {Object.entries(themes).map(([key, themeData]) => (
                    <button
                      key={key}
                      onClick={() => {
                        changeTheme(key);
                        setShowThemeDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 ${c.activityHover.replace('border-transparent', '')} transition-colors ${
                        currentTheme === key ? c.workgroupBg : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`text-sm font-medium ${currentTheme === key ? c.moduleText : c.activityText}`}>
                            {themeData.name}
                          </div>
                          <div className={`text-xs ${c.mutedText}`}>{themeData.description}</div>
                        </div>
                        {currentTheme === key && (
                          <div className={`w-2 h-2 ${c.checkboxChecked.replace('bg-', 'bg-').split(' ')[0]} rounded-full`}></div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={() => setSelectedView('settings')}
            className={`p-2 ${c.activityHover.replace('border-transparent', '')} rounded-lg transition-colors`}
          >
            <Settings className={`w-5 h-5 ${c.mutedText}`} />
          </button>

          {/* Sign Out */}
          <button
            onClick={signOut}
            className={`p-2 ${c.activityHover.replace('border-transparent', '')} rounded-lg transition-colors`}
          >
            <LogOut className={`w-5 h-5 ${c.mutedText}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className={`w-64 ${c.bg} border-r ${c.divider} overflow-y-auto`}>
          <div className="p-4 space-y-4">
            {/* Agenda Link - Home Page */}
            <button
              onClick={() => setSelectedView('agenda')}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-2 ${
                selectedView === 'agenda'
                  ? `${c.checkboxChecked} text-white shadow-sm`
                  : `${c.cardBg} ${c.activityText} ${c.activityHover.replace('border-transparent', '')} border ${c.moduleBorder}`
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-sm font-semibold">Today</span>
            </button>

            {/* Planner Link */}
            <button
              onClick={() => setSelectedView('planner')}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-2 ${
                selectedView === 'planner'
                  ? `${c.checkboxChecked} text-white shadow-sm`
                  : `${c.cardBg} ${c.activityText} ${c.activityHover.replace('border-transparent', '')} border ${c.moduleBorder}`
              }`}
            >
              <Calendar className="w-5 h-5" />
              <span className="text-sm font-semibold">Planner</span>
            </button>

            {/* Collapsible Courses Section */}
            <div className={`${c.cardBg} rounded-lg border ${c.moduleBorder} shadow-sm`}>
              {/* Courses Header - Collapsible */}
              <button
                onClick={() => setCoursesExpanded(!coursesExpanded)}
                className={`w-full flex items-center justify-between px-4 py-3 ${c.activityHover.replace('border-transparent', '')} transition-colors rounded-t-lg`}
              >
                <div className="flex items-center gap-2">
                  <BookOpen className={`w-4 h-4 ${c.moduleIcon}`} />
                  <h3 className={`text-sm font-semibold ${c.moduleText}`}>Courses</h3>
                  <span className={`text-xs ${c.mutedText}`}>({courses.length})</span>
                </div>
                {coursesExpanded ? (
                  <ChevronUp className={`w-4 h-4 ${c.mutedText}`} />
                ) : (
                  <ChevronDown className={`w-4 h-4 ${c.mutedText}`} />
                )}
              </button>

              {/* Course List */}
              {coursesExpanded && (
                <div className={`border-t ${c.divider}`}>
                  {courses.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className={`text-sm ${c.mutedText}`}>No courses found</p>
                      <p className={`text-xs ${c.mutedText} mt-1`}>for {selectedSchoolYear}</p>
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {courses.map((course) => (
                        <button
                          key={course.id}
                          onClick={() => {
                            setSelectedCourse(course);
                            setSelectedView('courses');
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-md transition-colors ${
                            selectedCourse?.id === course.id && selectedView === 'courses'
                              ? `${c.checkboxChecked} text-white shadow-sm`
                              : `${c.activityText} ${c.activityHover.replace('border-transparent', '')}`
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{course.name}</div>
                            <div className={`text-xs truncate ${
                              selectedCourse?.id === course.id && selectedView === 'courses'
                                ? 'text-white opacity-80'
                                : c.mutedText
                            }`}>
                              {course.school}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto bg-white">
          {selectedView === 'agenda' && selectedKid ? (
            <AgendaView kidId={selectedKid.id} />
          ) : selectedView === 'courses' && selectedCourse ? (
            <CoursesView selectedCourse={selectedCourse} kidId={selectedKid?.id || 0} />
          ) : selectedView === 'planner' && selectedKid ? (
            <PlannerView kidId={selectedKid.id} />
          ) : selectedView === 'settings' ? (
            <SettingsView />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-stone-400">
                <BookOpen className="w-16 h-16 mx-auto mb-4" />
                <p className="text-lg font-medium text-stone-600">Select a view to get started</p>
                <p className="text-sm text-stone-500">Choose from the sidebar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
