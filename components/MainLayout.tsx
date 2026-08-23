'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  BookOpen, Calendar, Settings, LogOut, Palette, ChevronDown, ChevronUp, Home,
  PanelLeftClose, PanelLeft, Award, Menu, X, LayoutGrid
} from 'lucide-react';
import CoursesView from './CoursesView';
import AgendaView from './AgendaView';
import CalendarView from './CalendarView';
import SettingsView from './SettingsView';
import GradesView from './GradesView';
import PlannerView from './PlannerView';
import { themes } from '@/lib/themes';
import { formatDateLocal } from '@/lib/datetime';

interface Course {
  id: number;
  name: string;
  school: string;
  schoolNickname?: string;
  teacher?: string;
  calendar_id: number;
  class_days?: string | number;
}

const formatClassDays = (days?: string | number): string => {
  if (!days) return '';
  const dayStr = String(days);
  const dayMap: Record<string, string> = {
    '1': 'M', '2': 'T', '3': 'W', '4': 'Th', '5': 'F', '6': 'Sa', '7': 'Su',
  };

  const formatted = dayStr
    .split('')
    .map((d) => dayMap[d] || '')
    .join('');

  return formatted ? `(${formatted})` : '';
};

export default function MainLayout() {
  const { signOut, user, kids, selectedKid, setSelectedKid } = useAuth();
  const { theme, currentTheme, changeTheme } = useTheme();
  
  // Updated type state to include 'planner'
  const [selectedView, setSelectedView] = useState<'agenda' | 'calendar' | 'planner' | 'courses' | 'settings' | 'grades'>('agenda');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('');
  
  // Mobile drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Dropdown controls
  const [showKidDropdown, setShowKidDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [coursesExpanded, setCoursesExpanded] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [schoolYears, setSchoolYears] = useState<Array<{ name: string; is_current: boolean }>>([]);

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
  }, [selectedKid, selectedSchoolYear]);

  useEffect(() => {
    const handleCourseCreated = () => {
      loadCourses();
    };

    window.addEventListener('courseCreated', handleCourseCreated);
    return () => window.removeEventListener('courseCreated', handleCourseCreated);
  }, [selectedKid, selectedSchoolYear]);

  const c = theme.colors;

  const NavigationItems = () => (
    <div className="space-y-3">
      {/* Date Selector */}
      <div className={`rounded-lg border ${c.sidebarBorder} ${c.sidebarBg} p-3 space-y-2`}>
        {(!isSidebarCollapsed || isMobileMenuOpen) && (
          <div className={`text-xs font-semibold ${c.moduleText}`}>Selected Date</div>
        )}
        <input
          type="date"
          value={formatDateLocal(selectedDate)}
          onChange={(e) => {
            if (e.target.value) {
              setSelectedDate(new Date(e.target.value + 'T12:00:00'));
            }
          }}
          className={`w-full px-2 py-2 text-xs border ${c.sidebarBorder} rounded-lg ${c.sidebarItemBg} ${c.moduleText}`}
        />
      </div>

      {/* Main Links - Planner added under Calendar */}
      {[
        { id: 'agenda', label: 'Agenda', Icon: Home },
        { id: 'calendar', label: 'Calendar', Icon: Calendar },
        { id: 'planner', label: 'Planner', Icon: LayoutGrid },
        { id: 'grades', label: 'Grades', Icon: Award },
      ].map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => {
            setSelectedView(id as any);
            setIsMobileMenuOpen(false);
          }}
          className={`w-full text-left px-3 py-3 rounded-lg transition-colors flex items-center gap-2.5 ${
            selectedView === id
              ? `${c.sidebarSelectedBg} ${c.sidebarSelectedText} border ${c.sidebarSelectedBorder} shadow-sm`
              : `${c.sidebarItemBg} ${c.sidebarItemText} border ${c.sidebarItemBorder}`
          }`}
        >
          <Icon className="h-5 shrink-0 w-5" />
          {(!isSidebarCollapsed || isMobileMenuOpen) && (
            <span className="font-semibold text-sm truncate">{label}</span>
          )}
        </button>
      ))}

      {/* Collapsible Courses Section */}
      <div className={`${c.sidebarBg} rounded-lg border ${c.sidebarBorder}`}>
        <button
          onClick={() => setCoursesExpanded(!coursesExpanded)}
          className="flex items-center justify-between px-3 py-3 w-full"
        >
          <div className="flex gap-2 items-center min-w-0">
            <BookOpen className={`w-5 h-5 shrink-0 ${c.moduleIcon}`} />
            {(!isSidebarCollapsed || isMobileMenuOpen) && (
              <>
                <h3 className={`text-sm font-semibold ${c.moduleText} truncate`}>Courses</h3>
                <span className={`text-xs ${c.mutedText}`}>({courses.length})</span>
              </>
            )}
          </div>
          {(!isSidebarCollapsed || isMobileMenuOpen) && (
            coursesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {coursesExpanded && (!isSidebarCollapsed || isMobileMenuOpen) && (
          <div className={`border-t ${c.divider} p-1.5 space-y-1`}>
            {courses.length === 0 ? (
              <div className="px-3 py-3 text-center text-stone-400 text-xs">No courses found</div>
            ) : (
              courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => {
                    setSelectedCourse(course);
                    setSelectedView('courses');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-md text-xs font-medium ${
                    selectedCourse?.id === course.id && selectedView === 'courses'
                      ? `${c.sidebarSelectedBg} ${c.sidebarSelectedText}`
                      : c.sidebarItemText
                  }`}
                >
                  <div className="truncate">
                    <div className="font-semibold">{course.name}</div>
                    <div className={`text-[10px] mt-0.5 ${c.mutedText}`}>
                      {course.schoolNickname && <span>{course.schoolNickname}</span>}
                      {course.teacher && <span>{course.schoolNickname ? ' • ' : ''}{course.teacher}</span>}
                      {course.class_days && <span>{(course.schoolNickname || course.teacher) ? ' • ' : ''}{formatClassDays(course.class_days)}</span>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${c.bg}`}>
      {/* Top Header */}
      <header className={`${c.sidebarBg} border-b ${c.divider} px-3 md:px-6 py-3 flex items-center justify-between z-30`}>
        <div className="flex gap-2 items-center">
          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg"
            aria-label="Toggle Navigation"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Desktop Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:block p-1.5 rounded-lg"
          >
            {isSidebarCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>

          <h1 className={`text-base md:text-xl font-semibold ${c.moduleText}`}>OnTrack</h1>
        </div>

        {/* Top Selectors & Actions */}
        <div className="flex gap-1.5 items-center md:gap-3">
          {/* Kid Selector */}
          {kids && kids.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowKidDropdown(!showKidDropdown)}
                className={`flex items-center gap-1 px-2 md:px-3 py-1.5 ${c.workgroupBg} rounded-lg text-xs md:text-sm`}
              >
                <span className={`font-medium ${c.moduleText} max-w-[70px] sm:max-w-none truncate`}>
                  {selectedKid?.name || 'Student'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 ${c.mutedText}`} />
              </button>
              {showKidDropdown && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowKidDropdown(false)} />
                  <div className={`absolute right-0 mt-2 w-48 ${c.cardBg} rounded-lg shadow-lg border ${c.divider} py-1 z-40`}>
                    {kids.map((kid) => (
                      <button
                        key={kid.id}
                        onClick={() => {
                          setSelectedKid(kid);
                          setShowKidDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm ${
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
              className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 ${c.workgroupBg} rounded-lg text-xs md:text-sm`}
            >
              <Calendar className={`w-3.5 h-3.5 ${c.mutedText} hidden sm:block`} />
              <span className={`font-medium ${c.moduleText}`}>{selectedSchoolYear || 'Year'}</span>
              <ChevronDown className={`w-3.5 h-3.5 ${c.mutedText}`} />
            </button>

            {showYearDropdown && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowYearDropdown(false)} />
                <div className={`absolute right-0 mt-2 w-36 ${c.cardBg} rounded-lg shadow-lg border ${c.divider} py-1 z-40`}>
                  {schoolYears.map((year) => (
                    <button
                      key={year.name}
                      onClick={() => {
                        setSelectedSchoolYear(year.name);
                        setShowYearDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm ${
                        selectedSchoolYear === year.name ? `${c.workgroupBg} ${c.moduleText} font-medium` : c.activityText
                      }`}
                    >
                      {year.name}
                      {year.is_current && <span className={`ml-1 text-xs ${c.mutedText}`}>•</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Theme Selector */}
          <div className="hidden relative sm:block">
            <button
              onClick={() => setShowThemeDropdown(!showThemeDropdown)}
              className={`flex items-center gap-2 px-3 py-1.5 ${c.workgroupBg} rounded-lg text-sm`}
            >
              <Palette className={`w-4 h-4 ${c.mutedText}`} />
              <span className={`font-medium ${c.moduleText} capitalize`}>{currentTheme}</span>
            </button>

            {showThemeDropdown && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowThemeDropdown(false)} />
                <div className={`absolute right-0 mt-2 w-52 ${c.cardBg} rounded-lg shadow-lg border ${c.divider} py-2 z-40`}>
                  {Object.entries(themes).map(([key, themeData]) => (
                    <button
                      key={key}
                      onClick={() => {
                        changeTheme(key);
                        setShowThemeDropdown(false);
                      }}
                      className="px-3 py-2 text-left text-sm w-full"
                    >
                      {themeData.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Settings Button */}
          <button onClick={() => setSelectedView('settings')} className="p-1.5 rounded-lg">
            <Settings className={`w-5 h-5 ${c.mutedText}`} />
          </button>

          {/* Sign Out Button */}
          <button onClick={signOut} className="hidden md:block p-1.5 rounded-lg">
            <LogOut className={`w-5 h-5 ${c.mutedText}`} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Drawer Overlay */}
        {isMobileMenuOpen && (
          <div
            className="bg-black/50 fixed inset-0 md:hidden z-20"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed md:static inset-y-0 left-0 z-20
            transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
            transition-transform duration-200 ease-in-out
            ${isSidebarCollapsed ? 'md:w-16' : 'md:w-64'} w-72
            ${c.sidebarBg} border-r ${c.sidebarBorder} overflow-y-auto p-3 flex flex-col justify-between
          `}
        >
          <NavigationItems />
          
          <div className="border-stone-200 border-t flex items-center justify-between md:hidden pt-4">
            <button onClick={signOut} className="flex font-semibold gap-2 items-center p-2 text-xs">
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </aside>

        {/* Views Container */}
        <main className="bg-white flex-1 md:pb-0 overflow-y-auto pb-16">
          {selectedView === 'agenda' && selectedKid ? (
            <AgendaView kidId={selectedKid.id} selectedDate={selectedDate} key={`${selectedKid.id}-${formatDateLocal(selectedDate)}`} />
          ) : selectedView === 'courses' && selectedCourse ? (
            <CoursesView selectedCourse={selectedCourse} kidId={selectedKid?.id || 0} selectedDate={selectedDate} />
          ) : selectedView === 'calendar' && selectedKid ? (
            <CalendarView kidId={selectedKid.id} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
          ) : selectedView === 'planner' && selectedKid ? (
            <PlannerView kidId={selectedKid.id} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
          ) : selectedView === 'grades' && selectedKid ? (
            <GradesView kidId={selectedKid.id} selectedCourse={selectedCourse} schoolYear={selectedSchoolYear} />
          ) : selectedView === 'settings' ? (
            <SettingsView selectedSchoolYear={selectedSchoolYear} selectedKid={selectedKid} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <BookOpen className="h-12 mb-2 text-stone-400 w-12" />
              <p className="font-medium text-stone-600">Select a view from the menu to get started</p>
            </div>
          )}
        </main>
      </div>

      {/* Bottom Mobile Navigation */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 ${c.sidebarBg} border-t ${c.divider} flex justify-around p-2 z-30`}>
        {[
          { id: 'agenda', label: 'Agenda', Icon: Home },
          { id: 'calendar', label: 'Calendar', Icon: Calendar },
          { id: 'planner', label: 'Planner', Icon: LayoutGrid },
          { id: 'grades', label: 'Grades', Icon: Award },
          { id: 'settings', label: 'Settings', Icon: Settings },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setSelectedView(id as any)}
            className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] ${
              selectedView === id ? `${c.moduleText} font-bold` : c.mutedText
            }`}
          >
            <Icon className="h-5 mb-0.5 w-5" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}