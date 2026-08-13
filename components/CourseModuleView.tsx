'use client';

import { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Package,
  FileText,
  Video,
  Users,
  CheckCircle2,
  Clock,
  ExternalLink,
  Folder,
  Eye,
  Calendar,
  Target,
  Edit2,
  List,
  CalendarDays,
} from 'lucide-react';
import ActivityDetailModal from './ActivityDetailModal';
import CourseSetupModal from './CourseSetupModal';
import { useTheme } from '@/contexts/ThemeContext';
import { formatDateLocal } from '@/lib/datetime';

interface CourseModuleViewProps {
  course: any;
  kidId: number;
  selectedDate: Date;
}

export default function CourseModuleView({ course, kidId, selectedDate }: CourseModuleViewProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [modules, setModules] = useState<any[]>([]); // All modules including "General"
  const [weekModules, setWeekModules] = useState<any[]>([]); // Modules with position > 0
  const [allActivities, setAllActivities] = useState<any[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [expandedWorkgroups, setExpandedWorkgroups] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [isCourseEditModalOpen, setIsCourseEditModalOpen] = useState(false);

  // Week navigation
  const [viewMode, setViewMode] = useState<'week' | 'all'>('week');
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [showMoreAssignments, setShowMoreAssignments] = useState(false);

  const getCurrentWeekIndex = (weekModulesList: any[], date: Date) => {
    const targetDate = formatDateLocal(date);
    let selectedIndex = -1;

    weekModulesList.forEach((module: any, index: number) => {
      if (module.activity_type !== 'module' || !module.plan_date) return;
      if (module.plan_date <= targetDate) {
        selectedIndex = index;
      }
    });

    return selectedIndex >= 0 ? selectedIndex : 0;
  };

  const selectWeekModule = (weekModulesList: any[], index: number) => {
    const normalizedIndex = Math.min(Math.max(index, 0), Math.max(0, weekModulesList.length - 1));
    setCurrentWeekIndex(normalizedIndex);
    if (weekModulesList[normalizedIndex]?.id) {
      setExpandedModules(new Set([weekModulesList[normalizedIndex].id]));
    }
  };

  const loadModules = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/courses/${course.id}/modules?kidId=${kidId}`
      );
      const data = await response.json();
      const modulesList = Array.isArray(data) ? data : [];
      setModules(modulesList);

      // Extract all activities from modules for sidebar
      const activities: any[] = [];
      modulesList.forEach((module: any) => {
        module.direct_activities?.forEach((act: any) => activities.push(act));
        module.workgroups?.forEach((wg: any) => {
          wg.activities?.forEach((act: any) => activities.push(act));
        });
      });
      setAllActivities(activities);

      // Filter out "General" section (position 0) for week navigation
      const weekModulesList = modulesList.filter((m: any) => m.position > 0);
      setWeekModules(weekModulesList);

      if (weekModulesList.length > 0) {
        const currentIndex = getCurrentWeekIndex(weekModulesList, selectedDate);
        selectWeekModule(weekModulesList, currentIndex);
      }
    } catch (error) {
      console.error('Error loading modules:', error);
      setModules([]);
      setAllActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!course || !kidId) return;
    loadModules();
  }, [course, kidId]);

  useEffect(() => {
    if (weekModules.length === 0) return;
    const currentIndex = getCurrentWeekIndex(weekModules, selectedDate);
    selectWeekModule(weekModules, currentIndex);
  }, [selectedDate, weekModules]);

  const toggleModule = (moduleId: number) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const toggleWorkgroup = (workgroupId: number) => {
    const newExpanded = new Set(expandedWorkgroups);
    if (newExpanded.has(workgroupId)) {
      newExpanded.delete(workgroupId);
    } else {
      newExpanded.add(workgroupId);
    }
    setExpandedWorkgroups(newExpanded);
  };

  const getActivityIcon = (activityType: string) => {
    const iconClass = c.activityIcon;
    switch (activityType) {
      case 'assignment':
      case 'quiz':
        return <CheckCircle2 className={`w-4 h-4 ${iconClass}`} />;
      case 'discussion':
        return <Users className={`w-4 h-4 ${iconClass}`} />;
      case 'video':
        return <Video className={`w-4 h-4 ${iconClass}`} />;
      default:
        return <FileText className={`w-4 h-4 ${iconClass}`} />;
    }
  };

  const formatTime = (minutes: number) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const toggleCompletion = async (activity: any) => {
    try {
      const nextCompleted = !activity.is_completed;
      const nextCompletedAt = nextCompleted
        ? activity.completed_at?.split('T')[0]?.split(' ')[0] || activity.plan_date || formatDateLocal(new Date())
        : null;

      const response = await fetch(`/api/activities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          updates: {
            is_completed: nextCompleted,
            completed_at: nextCompletedAt,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to update activity');
      await loadModules();
    } catch (error) {
      console.error('Error toggling completion:', error);
    }
  };

  const ActivityRow = ({ activity }: { activity: any }) => {
    const isActionable = activity.is_action;

    return (
      <div className={`py-3 px-4 pl-10 ${c.activityHover} transition-colors border-l-2 ${c.activityBorderHover}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {/* Checkbox - Only for actionable items */}
            {isActionable ? (
              <button
                onClick={() => toggleCompletion(activity)}
                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                  activity.is_completed
                    ? c.checkboxChecked
                    : c.checkboxBorder + ' hover:border-stone-400'
                }`}
                title={activity.is_completed ? 'Mark incomplete' : 'Mark complete'}
              >
                {activity.is_completed && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ) : (
              <div className="w-6 h-6 flex-shrink-0" />
            )}

            {getActivityIcon(activity.activity_type)}

            {/* Clickable title - opens detail modal */}
            <button
              onClick={() => setSelectedActivity(activity)}
              className={`text-sm flex-1 text-left ${
                activity.is_completed
                  ? 'line-through text-stone-400'
                  : c.activityText
              } hover:underline cursor-pointer font-medium`}
              title="Click to view details and change settings"
            >
              {activity.title}
            </button>
          </div>

          <div className={`flex items-center gap-3 text-sm ${c.mutedText} ml-4`}>
            {activity.plan_date && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                {new Date(activity.plan_date + 'T00:00:00').toLocaleDateString()}
              </span>
            )}

            {activity.due_date && (
              <span className="text-xs">
                {new Date(activity.due_date + 'T00:00:00').toLocaleDateString()}
              </span>
            )}

            {activity.estimated_minutes && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs">{formatTime(activity.estimated_minutes)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${c.checkboxChecked.split(' ')[0].replace('bg-', 'border-')}`}></div>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className={`text-center py-20`}>
          <Package className={`w-20 h-20 mx-auto mb-6 opacity-40 ${c.mutedText}`} />
          <p className={`text-lg font-light ${c.activityText}`}>No modules yet</p>
          <p className={`text-sm ${c.mutedText} mt-2`}>Activities will appear here once they're added</p>
        </div>
      </div>
    );
  }

  // Get upcoming incomplete assignments sorted by plan_date
  const upcomingAssignments = allActivities
    .filter((act: any) => act.is_action && !act.is_completed && act.plan_date)
    .sort((a: any, b: any) => a.plan_date.localeCompare(b.plan_date))
    .slice(0, showMoreAssignments ? undefined : 5);

  // Current module to display
  const currentModule = viewMode === 'week' ? weekModules[currentWeekIndex] : null;
  const displayModules = viewMode === 'all' ? modules : (currentModule ? [currentModule] : []);

  return (
    <div className={`flex h-full ${c.bg}`}>
      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Course Header */}
        <div className={`mb-6 pb-4 border-b ${c.divider} flex items-start justify-between`}>
          <div>
            <h1 className={`text-2xl font-semibold ${c.moduleText} mb-1`}>{course.name}</h1>
            <p className={`text-sm ${c.mutedText}`}>{course.school}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className={`flex items-center gap-1 p-1 border ${c.moduleBorder} rounded-lg`}>
              <button
                onClick={() => setViewMode('week')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
                  viewMode === 'week'
                    ? `${c.checkboxChecked} text-white`
                    : `${c.mutedText} hover:bg-stone-100`
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Week
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
                  viewMode === 'all'
                    ? `${c.checkboxChecked} text-white`
                    : `${c.mutedText} hover:bg-stone-100`
                }`}
              >
                <List className="w-4 h-4" />
                All
              </button>
            </div>

            <button
              onClick={() => setIsCourseEditModalOpen(true)}
              className={`flex items-center gap-2 px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText} ${c.activityHover.replace('border-transparent', '')} transition-colors`}
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          </div>
        </div>

        {/* Week Navigation (only in week view) */}
        {viewMode === 'week' && weekModules.length > 0 && (
          <div className={`mb-6 flex items-center justify-between p-4 border ${c.moduleBorder} rounded-lg ${c.cardBg}`}>
            <button
              onClick={() => {
                const newIndex = Math.max(0, currentWeekIndex - 1);
                setCurrentWeekIndex(newIndex);
                if (weekModules[newIndex]?.id) {
                  setExpandedModules(new Set([weekModules[newIndex].id]));
                }
              }}
              disabled={currentWeekIndex === 0}
              className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                currentWeekIndex === 0
                  ? `${c.mutedText} opacity-30 cursor-not-allowed`
                  : `${c.moduleText} hover:bg-stone-100`
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
              Previous Week
            </button>

            <div className="text-center">
              <div className={`text-lg font-semibold ${c.moduleText}`}>
                Week {currentWeekIndex + 1}
              </div>
              {currentModule?.plan_date && (
                <div className={`text-sm ${c.mutedText}`}>
                  {new Date(currentModule.plan_date + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                const newIndex = Math.min(weekModules.length - 1, currentWeekIndex + 1);
                setCurrentWeekIndex(newIndex);
                if (weekModules[newIndex]?.id) {
                  setExpandedModules(new Set([weekModules[newIndex].id]));
                }
              }}
              disabled={currentWeekIndex >= weekModules.length - 1}
              className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                currentWeekIndex >= weekModules.length - 1
                  ? `${c.mutedText} opacity-30 cursor-not-allowed`
                  : `${c.moduleText} hover:bg-stone-100`
              }`}
            >
              Next Week
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Modules List */}
        <div className="space-y-3">
        {displayModules.map((module) => {
          const isModuleExpanded = expandedModules.has(module.id);

          return (
            <div key={module.id} className={`border ${c.moduleBorder} rounded-lg overflow-hidden ${c.cardBg}`}>
              {/* Module Header */}
              <div className={`w-full flex items-center justify-between p-4 ${c.moduleHeader} transition-colors`}>
                <button
                  onClick={() => toggleModule(module.id)}
                  className="flex items-center gap-3 flex-1"
                >
                  <Package className={`w-5 h-5 ${c.moduleIcon}`} />
                  <span className={`font-semibold ${c.moduleText}`}>{module.title}</span>
                </button>

                <div className="flex items-center gap-4">
                  {/* View Details button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedActivity(module);
                    }}
                    className={`text-xs ${c.activityText} hover:underline`}
                    title="View details"
                  >
                    details
                  </button>

                  <div className={`flex items-center gap-3 text-sm ${c.statText}`}>
                    <span className="font-medium">
                      {module.stats?.completed || 0}/{module.stats?.total || 0}
                    </span>
                    {module.stats?.totalTime > 0 && (
                      <>
                        <span className="text-stone-300">•</span>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>{formatTime(module.stats.totalTime)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => toggleModule(module.id)}
                  >
                    <ChevronRight
                      className={`w-5 h-5 text-stone-400 transition-transform ${
                        isModuleExpanded ? 'rotate-90' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Module Content */}
              {isModuleExpanded && (
                <div className={`border-t ${c.divider} ${c.cardBg}`}>
                  {/* Direct Activities */}
                  {module.direct_activities && module.direct_activities.length > 0 && (
                    <div className={`${c.divider.replace('border', 'divide-y')}`}>
                      {module.direct_activities.map((activity: any) => (
                        <ActivityRow key={activity.id} activity={activity} />
                      ))}
                    </div>
                  )}

                  {/* Workgroups */}
                  {module.workgroups && module.workgroups.length > 0 && module.workgroups.map((workgroup: any) => {
                    const isWorkgroupExpanded = expandedWorkgroups.has(workgroup.id);

                    return (
                      <div key={workgroup.id} className={`border-t ${c.divider}`}>
                        {/* Workgroup Header */}
                        <button
                          onClick={() => toggleWorkgroup(workgroup.id)}
                          className={`w-full flex items-center justify-between py-3 px-4 pl-10 ${c.workgroupHeader} transition-colors`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Folder className={`w-4 h-4 ${c.workgroupIcon}`} />
                            <span className={`font-medium text-sm ${c.workgroupText}`}>{workgroup.title}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`flex items-center gap-2.5 text-xs ${c.mutedText}`}>
                              <span className="font-medium">
                                {workgroup.stats?.completed || 0}/{workgroup.stats?.total || 0}
                              </span>
                              {workgroup.stats?.totalTime > 0 && (
                                <>
                                  <span className="text-stone-300">•</span>
                                  <span>{formatTime(workgroup.stats.totalTime)}</span>
                                </>
                              )}
                            </div>
                            <ChevronRight
                              className={`w-4 h-4 text-stone-400 transition-transform ${
                                isWorkgroupExpanded ? 'rotate-90' : ''
                              }`}
                            />
                          </div>
                        </button>

                        {/* Workgroup Activities */}
                        {isWorkgroupExpanded && (
                          <div className={`${c.divider.replace('border', 'divide-y')} ${c.workgroupBg}`}>
                            {workgroup.activities && workgroup.activities.length === 0 ? (
                              <div className={`py-4 text-center text-sm ${c.mutedText}`}>
                                No activities in this section
                              </div>
                            ) : (
                              workgroup.activities?.map((activity: any) => (
                                <ActivityRow key={activity.id} activity={activity} />
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Empty state */}
                  {!module.direct_activities?.length && !module.workgroups?.length && (
                    <div className={`py-8 text-center ${c.mutedText}`}>
                      <p className="text-sm">No activities in this module</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {/* Sidebar - Upcoming Assignments */}
      <div className={`w-80 border-l ${c.divider} p-6 overflow-y-auto ${c.cardBg}`}>
        <h2 className={`text-lg font-semibold ${c.moduleText} mb-4`}>Upcoming Work</h2>

        {upcomingAssignments.length === 0 ? (
          <div className={`text-center py-8 ${c.mutedText}`}>
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingAssignments.map((activity: any) => (
              <div
                key={activity.id}
                className={`p-3 border ${c.moduleBorder} rounded-lg ${c.activityHover} transition-colors cursor-pointer`}
                onClick={() => setSelectedActivity(activity)}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCompletion(activity);
                    }}
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      activity.is_completed
                        ? c.checkboxChecked
                        : c.checkboxBorder + ' hover:border-stone-400'
                    }`}
                  >
                    {activity.is_completed && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${c.activityText} mb-1 line-clamp-2`}>
                      {activity.title}
                    </div>
                    <div className={`text-xs ${c.mutedText}`}>
                      {activity.plan_date && (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                          {new Date(activity.plan_date + 'T00:00:00').toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {!showMoreAssignments && allActivities.filter((act: any) => act.is_action && !act.is_completed && act.plan_date).length > 5 && (
              <button
                onClick={() => setShowMoreAssignments(true)}
                className={`w-full py-2 text-sm ${c.mutedText} hover:${c.moduleText} transition-colors`}
              >
                Show more...
              </button>
            )}
          </div>
        )}
      </div>

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          onUpdate={() => {
            // Reload data but don't close modal
            loadModules();
          }}
        />
      )}

      {/* Course Edit Modal */}
      <CourseSetupModal
        isOpen={isCourseEditModalOpen}
        onClose={() => setIsCourseEditModalOpen(false)}
        kidId={kidId}
        existingCourse={course}
        onSave={() => {
          setIsCourseEditModalOpen(false);
          // Reload parent view
          window.dispatchEvent(new CustomEvent('courseCreated'));
        }}
      />
    </div>
  );
}
