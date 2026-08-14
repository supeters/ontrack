'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ActiveWorkProvider, useActiveWork } from '@/contexts/ActiveWorkContext';
import {
  BookOpen, Calendar, Settings, LogOut, Palette, ChevronDown, ChevronUp, Home,
  PanelLeftClose, PanelLeft, ChevronRight, Flame, Pause, CheckCircle
} from 'lucide-react';
import CoursesView from './CoursesView';
import AgendaView from './AgendaView';
import PlannerView from './PlannerView';
import CalendarView from './CalendarView';
import SettingsView from './SettingsView';
import { themes } from '@/lib/themes';
import { formatDateLocal } from '@/lib/datetime';

interface Course {
  id: number;
  name: string;
  school: string;
  schoolNickname?: string;
  teacher?: string;
  calendar_id: number;
}

function MainLayoutContent() {
  const { signOut, user, kids, selectedKid, setSelectedKid } = useAuth();
  const { theme, currentTheme, changeTheme } = useTheme();
  const { activeWork, pauseWork, completeWork, restoreActiveWork } = useActiveWork();
  const [selectedView, setSelectedView] = useState<'agenda' | 'planner' | 'calendar' | 'courses' | 'settings'>('agenda');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('');
  const [showKidDropdown, setShowKidDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [coursesExpanded, setCoursesExpanded] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [schoolYears, setSchoolYears] = useState<Array<{ name: string; is_current: boolean }>>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSchoolYears = async () => {
    try {
      const response = await fetch('/api/school-years');
      const data: Array<{ name: string; is_current: boolean }> = await response.json();
      setSchoolYears(data || []);

      const currentYear = data?.find((y) => y.is_current);
      if (currentYear) {
        setSelectedSchoolYear(currentYear.name);
      } else if (data && data.length > 0) {
        setSelectedSchoolYear(data[0].name);
      }
    } catch (error) {
      console.error('Error loading school years:', error);
    }
  };

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

  useEffect(() => {
    loadSchoolYears();
  }, []);

  useEffect(() => {
    if (!selectedKid) {
      setCourses([]);
      setSelectedCourse(null);
      return;
    }
    loadCourses();
    restoreActiveWork(selectedKid.id);
  }, [selectedKid, selectedSchoolYear]);

  useEffect(() => {
    const handleCourseCreated = () => {
      loadCourses();
    };

    window.addEventListener('courseCreated', handleCourseCreated);
    return () => window.removeEventListener('courseCreated', handleCourseCreated);
  }, [selectedKid, selectedSchoolYear]);

  const c = theme.colors;

  return (
    <div className={`h-screen flex flex-col ${c.bg}`}>
      {/* Top Bar */}
      <div className={`${c.sidebarBg} border-b ${c.divider} px-6 py-3.5 flex items-center justify-between`}>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`p-1.5 rounded-lg ${c.activityHover.replace('border-transparent', '')} transition-colors`}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? (
              <PanelLeft className={`w-5 h-5 ${c.mutedText}`} />
            ) : (
              <PanelLeftClose className={`w-5 h-5 ${c.mutedText}`} />
            )}
          </button>
          <h1 className={`text-xl font-semibold ${c.moduleText}`}>OnTrack</h1>
        </div>

        <div className="flex gap-3 items-center">
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
                <ChevronDown className={`w-4 h-4 ${c.mutedText}`} />
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
              <ChevronDown className={`w-4 h-4 ${c.mutedText}`} />
            </button>

            {showYearDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowYearDropdown(false)} />
                <div className={`absolute right-0 mt-2 w-32 ${c.cardBg} rounded-lg shadow-lg border ${c.divider} py-1 z-20`}>
                  {schoolYears.map((year) => (
                    <button
                      key={year.name}
                      onClick={() => {
                        setSelectedSchoolYear(year.name);
                        setShowYearDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm ${c.activityHover.replace('border-transparent', '')} ${
                        selectedSchoolYear === year.name ? `${c.workgroupBg} ${c.moduleText} font-medium` : c.activityText
                      }`}
                    >
                      {year.name}
                      {year.is_current && <span className={`ml-2 text-xs ${c.mutedText}`}>•</span>}
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
        <div 
          className={`${
            isSidebarCollapsed ? 'w-16' : 'w-64'
          } ${c.sidebarBg} border-r ${c.sidebarBorder} overflow-y-auto transition-all duration-200 flex flex-col`}
        >
          <div className="flex-1 p-3 space-y-3">
            {/* Date Selector */}
            <div className={`rounded-lg border ${c.sidebarBorder} ${c.sidebarBg} p-3 space-y-2`}>
              {!isSidebarCollapsed && <div className={`text-xs font-semibold ${c.moduleText}`}>Selected Date</div>}
              <input
                type="date"
                value={formatDateLocal(selectedDate)}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(new Date(e.target.value + 'T12:00:00'));
                  }
                }}
                className={`w-full px-2 py-1.5 text-xs border ${c.sidebarBorder} rounded-lg ${c.sidebarItemBg} ${c.moduleText}`}
              />
            </div>

            {/* Agenda Link */}
            <button
              onClick={() => setSelectedView('agenda')}
              title={isSidebarCollapsed ? "Agenda" : undefined}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2.5 ${
                selectedView === 'agenda'
                  ? `${c.sidebarSelectedBg} ${c.sidebarSelectedText} border ${c.sidebarSelectedBorder} shadow-sm`
                  : `${c.sidebarItemBg} ${c.sidebarItemText} ${c.sidebarItemHover.replace('border-transparent', '')} border ${c.sidebarItemBorder}`
              }`}
            >
              <Home className="h-4 shrink-0 w-4" />
              {!isSidebarCollapsed && <span className="font-semibold text-xs truncate">Agenda</span>}
            </button>

            {/* Planner Link */}
            <button
              onClick={() => setSelectedView('planner')}
              title={isSidebarCollapsed ? "Planner" : undefined}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2.5 ${
                selectedView === 'planner'
                  ? `${c.sidebarSelectedBg} ${c.sidebarSelectedText} border ${c.sidebarSelectedBorder} shadow-sm`
                  : `${c.sidebarItemBg} ${c.sidebarItemText} ${c.sidebarItemHover.replace('border-transparent', '')} border ${c.sidebarItemBorder}`
              }`}
            >
              <Calendar className="h-4 shrink-0 w-4" />
              {!isSidebarCollapsed && <span className="font-semibold text-xs truncate">Planner</span>}
            </button>

            {/* Calendar Link */}
            <button
              onClick={() => setSelectedView('calendar')}
              title={isSidebarCollapsed ? "Calendar" : undefined}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2.5 ${
                selectedView === 'calendar'
                  ? `${c.sidebarSelectedBg} ${c.sidebarSelectedText} border ${c.sidebarSelectedBorder} shadow-sm`
                  : `${c.sidebarItemBg} ${c.sidebarItemText} ${c.sidebarItemHover.replace('border-transparent', '')} border ${c.sidebarItemBorder}`
              }`}
            >
              <Calendar className="h-4 shrink-0 w-4" />
              {!isSidebarCollapsed && <span className="font-semibold text-xs truncate">Calendar</span>}
            </button>

            {/* Collapsible Courses Section */}
            <div className={`${c.sidebarBg} rounded-lg border ${c.sidebarBorder} shadow-xs`}>
              <button
                onClick={() => setCoursesExpanded(!coursesExpanded)}
                title={isSidebarCollapsed ? "Courses" : undefined}
                className={`w-full flex items-center justify-between px-3 py-2.5 ${c.sidebarItemHover.replace('border-transparent', '')} transition-colors rounded-t-lg`}
              >
                <div className="flex gap-2 items-center min-w-0">
                  <BookOpen className={`w-4 h-4 shrink-0 ${c.moduleIcon}`} />
                  {!isSidebarCollapsed && (
                    <>
                      <h3 className={`text-xs font-semibold ${c.moduleText} truncate`}>Courses</h3>
                      <span className={`text-[10px] ${c.mutedText}`}>({courses.length})</span>
                    </>
                  )}
                </div>
                {!isSidebarCollapsed && (
                  coursesExpanded ? (
                    <ChevronUp className={`w-3.5 h-3.5 ${c.mutedText}`} />
                  ) : (
                    <ChevronDown className={`w-3.5 h-3.5 ${c.mutedText}`} />
                  )
                )}
              </button>

              {/* Course List */}
              {coursesExpanded && !isSidebarCollapsed && (
                <div className={`border-t ${c.divider}`}>
                  {courses.length === 0 ? (
                    <div className="px-3 py-4 text-center">
                      <p className={`text-xs ${c.mutedText}`}>No courses found</p>
                    </div>
                  ) : (
                    <div className="p-1.5 space-y-1">
                      {courses.map((course) => (
                        <button
                          key={course.id}
                          onClick={() => {
                            setSelectedCourse(course);
                            setSelectedView('courses');
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-md transition-colors ${
                            selectedCourse?.id === course.id && selectedView === 'courses'
                              ? `${c.sidebarSelectedBg} ${c.sidebarSelectedText} border ${c.sidebarSelectedBorder} shadow-xs`
                              : `${c.sidebarItemBg} ${c.sidebarItemText} ${c.sidebarItemHover.replace('border-transparent', '')} border ${c.sidebarItemBorder}`
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs truncate">{course.name}</div>
                            <div className={`text-[10px] truncate ${
                              selectedCourse?.id === course.id && selectedView === 'courses'
                                ? 'text-white opacity-80'
                                : c.mutedText
                            }`}>
                              {course.schoolNickname || course.school}
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

          {/* Working On Indicator */}
          {activeWork && (
            <div className={`border-t ${c.sidebarBorder} p-3`}>
              {isSidebarCollapsed ? (
                <div className="flex flex-col items-center gap-1" title={`Working on: ${activeWork.activity.title}`}>
                  <Flame className="h-5 w-5 text-orange-500 animate-pulse" />
                  <span className={`text-[9px] font-bold ${c.moduleText}`}>
                    {Math.floor((new Date().getTime() - activeWork.startTime.getTime()) / 60000)}m
                  </span>
                </div>
              ) : (
                <div className={`${c.workgroupBg} rounded-lg p-3 space-y-2`}>
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500 animate-pulse" />
                    <span className={`text-xs font-bold uppercase ${c.moduleText}`}>Working On</span>
                  </div>
                  <div className={`text-xs font-semibold ${c.activityText} truncate`}>
                    {activeWork.activity.title}
                  </div>
                  <div className={`text-xs ${c.statText}`}>
                    ⏱️ {Math.floor((new Date().getTime() - activeWork.startTime.getTime()) / 60000)} min elapsed
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => pauseWork(() => setRefreshKey(k => k + 1))}
                      className="flex-1 px-2 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      <Pause className="h-3 w-3" />
                      Pause
                    </button>
                    <button
                      onClick={() => completeWork(() => setRefreshKey(k => k + 1))}
                      className="flex-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Content View Container */}
        <div className="bg-white flex-1 overflow-y-auto">
          {selectedView === 'agenda' && selectedKid ? (
            <AgendaView
              kidId={selectedKid.id}
              selectedDate={selectedDate}
              key={`${selectedKid.id}-${formatDateLocal(selectedDate)}-${refreshKey}`}
            />
          ) : selectedView === 'courses' && selectedCourse ? (
            <CoursesView selectedCourse={selectedCourse} kidId={selectedKid?.id || 0} selectedDate={selectedDate} />
          ) : selectedView === 'planner' && selectedKid ? (
            <PlannerView kidId={selectedKid.id} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
          ) : selectedView === 'calendar' && selectedKid ? (
            <CalendarView kidId={selectedKid.id} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
          ) : selectedView === 'settings' ? (
            <SettingsView />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-stone-400">
                <BookOpen className="h-16 mb-4 mx-auto w-16" />
                <p className="font-medium text-lg text-stone-600">Select a view to get started</p>
                <p className="text-sm text-stone-500">Choose from the sidebar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MainLayout() {
  return (
    <ActiveWorkProvider>
      <MainLayoutContent />
    </ActiveWorkProvider>
  );
}