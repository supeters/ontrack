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
} from 'lucide-react';
import ActivityDetailModal from './ActivityDetailModal';
import CourseSetupModal from './CourseSetupModal';
import { useTheme } from '@/contexts/ThemeContext';

interface CourseModuleViewProps {
  course: any;
  kidId: number;
}

export default function CourseModuleView({ course, kidId }: CourseModuleViewProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [modules, setModules] = useState<any[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [expandedWorkgroups, setExpandedWorkgroups] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [isCourseEditModalOpen, setIsCourseEditModalOpen] = useState(false);

  useEffect(() => {
    if (!course || !kidId) return;
    loadModules();
  }, [course, kidId]);

  const loadModules = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/courses/${course.id}/modules?kidId=${kidId}`
      );
      const data = await response.json();
      setModules(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading modules:', error);
      setModules([]);
    } finally {
      setLoading(false);
    }
  };

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

  const handleActivityClick = async (activity: any) => {
    try {
      const response = await fetch(`/api/activities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          updates: { is_completed: !activity.is_completed },
        }),
      });

      if (!response.ok) throw new Error('Failed to update activity');
      await loadModules();
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  const toggleActionable = async (activity: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/activities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          updates: { is_action: !activity.is_action },
        }),
      });

      if (!response.ok) throw new Error('Failed to update activity');
      await loadModules();
    } catch (error) {
      console.error('Error toggling actionable:', error);
    }
  };

  const updatePlanDate = async (activity: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const newDate = prompt('Enter plan date (YYYY-MM-DD):', activity.plan_date || '');
    if (!newDate) return;

    try {
      const response = await fetch(`/api/activities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          updates: { plan_date: newDate },
        }),
      });

      if (!response.ok) throw new Error('Failed to update activity');
      await loadModules();
    } catch (error) {
      console.error('Error updating plan date:', error);
    }
  };

  const ActivityRow = ({ activity }: { activity: any }) => {
    const isActionable = activity.is_action;

    return (
      <div className={`py-3 px-4 pl-10 ${c.activityHover} transition-colors group border-l-2 ${c.activityBorderHover}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {/* Checkbox */}
            <button
              onClick={() => handleActivityClick(activity)}
              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                activity.is_completed
                  ? c.checkboxChecked
                  : isActionable
                  ? c.checkboxBorder + ' hover:border-stone-400'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
              title={activity.is_completed ? 'Mark incomplete' : 'Mark complete'}
            >
              {activity.is_completed && (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {getActivityIcon(activity.activity_type)}

            <span
              className={`text-sm flex-1 ${
                activity.is_completed
                  ? 'line-through text-stone-400'
                  : c.activityText
              }`}
            >
              {activity.title}
            </span>

            {/* Action Icons - Show on hover */}
            <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
              {/* Make Actionable / Remove */}
              <button
                onClick={(e) => toggleActionable(activity, e)}
                className={`p-1.5 rounded transition-colors ${
                  isActionable
                    ? `${c.checkboxChecked} text-white`
                    : `hover:bg-stone-100 ${c.mutedText}`
                }`}
                title={isActionable ? 'Remove from tasks' : 'Add to my tasks'}
              >
                <Target className="w-4 h-4" />
              </button>

              {/* Calendar - Only for actionable items */}
              {isActionable && (
                <button
                  onClick={(e) => updatePlanDate(activity, e)}
                  className={`p-1.5 rounded hover:bg-stone-100 transition-colors ${c.mutedText}`}
                  title="Set plan date"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              )}

              {/* Eye - Details */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedActivity(activity);
                }}
                className={`p-1.5 rounded hover:bg-stone-100 transition-colors ${c.mutedText}`}
                title="View details"
              >
                <Eye className="w-4 h-4" />
              </button>

              {/* External Link */}
              {(activity.lms_url || activity.resource_url) && (
                <a
                  href={activity.resource_url || activity.lms_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={`p-1.5 rounded hover:bg-stone-100 transition-colors ${c.mutedText}`}
                  title="Open resource"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
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

  return (
    <div className={`p-8 max-w-5xl mx-auto h-full overflow-y-auto ${c.bg}`}>
      {/* Course Header */}
      <div className={`mb-6 pb-4 border-b ${c.divider} flex items-start justify-between`}>
        <div>
          <h1 className={`text-2xl font-semibold ${c.moduleText} mb-1`}>{course.name}</h1>
          <p className={`text-sm ${c.mutedText}`}>{course.school}</p>
        </div>
        <button
          onClick={() => setIsCourseEditModalOpen(true)}
          className={`flex items-center gap-2 px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText} ${c.activityHover.replace('border-transparent', '')} transition-colors`}
        >
          <Edit2 className="w-4 h-4" />
          Edit Course
        </button>
      </div>

      {/* Modules List */}
      <div className="space-y-3">
        {modules.map((module) => {
          const isModuleExpanded = expandedModules.has(module.id);

          return (
            <div key={module.id} className={`border ${c.moduleBorder} rounded-lg overflow-hidden ${c.cardBg}`}>
              {/* Module Header */}
              <button
                onClick={() => toggleModule(module.id)}
                className={`w-full flex items-center justify-between p-4 ${c.moduleHeader} transition-colors`}
              >
                <div className="flex items-center gap-3">
                  <Package className={`w-5 h-5 ${c.moduleIcon}`} />
                  <span className={`font-semibold ${c.moduleText}`}>{module.title}</span>
                </div>
                <div className="flex items-center gap-4">
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

                  {/* Module Actions */}
                  <div className="flex items-center gap-1">
                    {/* Eye - View Details */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedActivity(module);
                      }}
                      className={`p-1.5 rounded hover:bg-stone-100 transition-colors ${c.mutedText}`}
                      title="View module details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* External Link */}
                    {module.lms_url && (
                      <a
                        href={module.lms_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`p-1.5 rounded hover:bg-stone-100 transition-colors ${c.mutedText}`}
                        title="Open in LMS"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  <ChevronRight
                    className={`w-5 h-5 text-stone-400 transition-transform ${
                      isModuleExpanded ? 'rotate-90' : ''
                    }`}
                  />
                </div>
              </button>

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

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          onUpdate={() => {
            setSelectedActivity(null);
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
