'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Calendar,
  Clock,
  Save,
  Trash2,
  ExternalLink,
  FileText,
  CheckCircle2,
  Scissors,
  BookOpen,
  Play,
  Zap
} from 'lucide-react';
import { formatDateLocal, formatTimestampLocal, getDateStr, parseLocalTimestamp } from '@/lib/datetime';
import { parseChecklist, type DailyChecklist } from '@/lib/parseChecklist';

interface Course {
  id: number;
  course_name: string;
  academic_year?: string;
}

interface Activity {
  id: number;
  title: string;
  description?: string;
  plan_date?: string;
  completed_at?: string;
  estimated_minutes?: number;
  actual_minutes?: number;
  is_completed: boolean;
  activity_type: string;
  resource_url?: string;
  lms_url?: string;
  parent_activity_id?: number;
  course_id?: number;
  is_action?: boolean;
  start_time?: string;
  end_time?: string;
  daily_checklist?: any;
  kid_id?: number;
}

interface ActivityDetailModalProps {
  activity: Activity;
  courses?: Course[];
  currentAcademicYear?: string;
  onClose: () => void;
  onUpdate?: () => void;
  onLaunchFocus?: (activity: Activity) => void;
}

function getDisplayMinutes(activity: any): number | null {
  if (activity.actual_minutes !== null && activity.actual_minutes !== undefined) {
    return activity.actual_minutes;
  }

  if (activity.start_time && activity.end_time) {
    const { date: start } = parseLocalTimestamp(activity.start_time);
    const { date: end } = parseLocalTimestamp(activity.end_time);

    if (start && end) {
      return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    }
  }

  return null;
}

export default function ActivityDetailModal({
  activity,
  courses: coursesProp = [],
  currentAcademicYear,
  onClose,
  onUpdate,
  onLaunchFocus,
}: ActivityDetailModalProps) {
  const [editedActivity, setEditedActivity] = useState<Activity>(activity);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'tasks'>('details');
  const [hasSelectedText, setHasSelectedText] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showCreateTaskForm, setShowCreateTaskForm] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    title: '',
    description: '',
    planDate: activity.plan_date || '',
    estimatedMinutes: 15,
  });
  const [children, setChildren] = useState<Activity[]>([]);
  const [isActionable, setIsActionable] = useState(activity.is_action ?? false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isCompleted, setIsCompleted] = useState(activity.is_completed || false);
  const [checklist, setChecklist] = useState<DailyChecklist | null>(null);
  const [actualMinutes, setActualMinutes] = useState<number | null>(getDisplayMinutes(activity));
  const [completedAt, setCompletedAt] = useState(() => {
    if (activity.completed_at) {
      return getDateStr(activity.completed_at);
    }
    return activity.plan_date || formatDateLocal(new Date());
  });
  const [courses, setCourses] = useState<Course[]>(coursesProp);

  const actualMinutesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadCourses = async () => {
      if (coursesProp.length > 0 || !activity.kid_id) return;

      try {
        const url = currentAcademicYear
          ? `/api/courses?kidId=${activity.kid_id}&schoolYear=${currentAcademicYear}`
          : `/api/courses?kidId=${activity.kid_id}`;

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setCourses(data || []);
        }
      } catch (error) {
        console.error('Error loading courses:', error);
      }
    };

    loadCourses();
  }, [activity.kid_id, coursesProp, currentAcademicYear]);

  useEffect(() => {
    setIsActionable(activity.is_action ?? false);
    setEditedActivity(activity);
    setIsCompleted(activity.is_completed || false);
    setActualMinutes(getDisplayMinutes(activity));
    
    if (activity.daily_checklist) {
      setChecklist(activity.daily_checklist);
    } else if (activity.description) {
      const parsed = parseChecklist(activity.description);
      if (parsed) {
        setChecklist(parsed);
      }
    }

    if (activity.completed_at) {
      setCompletedAt(getDateStr(activity.completed_at));
    } else {
      setCompletedAt(activity.plan_date || formatDateLocal(new Date()));
    }

    setHasChanges(false);
  }, [activity]);

  useEffect(() => {
    const loadChildren = async () => {
      try {
        const response = await fetch(`/api/activities?parent_id=${activity.id}`);
        if (response.ok) {
          const data = await response.json();
          setChildren(data || []);
        }
      } catch (error) {
        console.error('Error loading children:', error);
      }
    };

    if (activity.id) {
      loadChildren();
    }
  }, [activity.id]);

  const filteredCourses = currentAcademicYear
    ? courses.filter((c) => !c.academic_year || c.academic_year === currentAcademicYear)
    : courses;

  const saveChanges = async () => {
    setSaving(true);
    try {
      const updates: any = {
        description: editedActivity.description,
        course_id: editedActivity.course_id,
        plan_date: editedActivity.plan_date || null,
        start_time: isCompleted ? (editedActivity.start_time || null) : null,
        end_time: isCompleted ? (editedActivity.end_time || null) : null,
        estimated_minutes: editedActivity.estimated_minutes || null,
        actual_minutes: isCompleted ? actualMinutes : null,
        is_completed: isCompleted,
        completed_at: isCompleted ? (completedAt || formatDateLocal(new Date())) : null,
        is_action_override: isActionable,
        daily_checklist: checklist,
      };

      const res = await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          updates,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save activity: ${res.statusText}`);
      }

      setHasChanges(false);
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChecklistToggle = (key: string) => {
    if (!checklist) return;

    const updatedChecklist = {
      ...checklist,
      [key]: {
        ...checklist[key],
        completed: !checklist[key].completed,
      },
    };

    setChecklist(updatedChecklist);
    setHasChanges(true);
  };

  const deleteActivity = async (idToDelete: number) => {
    if (!confirm('Are you sure you want to delete this activity?')) return;

    try {
      await fetch(`/api/activities?id=${idToDelete}`, { method: 'DELETE' });
      if (idToDelete === activity.id) {
        if (onUpdate) onUpdate();
        onClose();
      } else {
        const response = await fetch(`/api/activities?parent_id=${activity.id}`);
        if (response.ok) {
          setChildren((await response.json()) || []);
        }
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      console.error('Error deleting activity:', error);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditedActivity((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const toggleCompletionNow = async () => {
    const nextCompleted = !isCompleted;
    const now = new Date();

    const startTime = editedActivity.start_time || activity.start_time;
    let calculatedActualMinutes = actualMinutes;

    if (nextCompleted) {
      if (startTime) {
        const { date: startDate } = parseLocalTimestamp(startTime);
        if (startDate) {
          const elapsedMs = now.getTime() - startDate.getTime();
          calculatedActualMinutes = Math.max(0, Math.round(elapsedMs / 60000));
          setActualMinutes(calculatedActualMinutes);
        }
      }

      const activeCompletedDate = completedAt || editedActivity.plan_date || formatDateLocal(now);
      setCompletedAt(activeCompletedDate);

      setEditedActivity((prev) => ({
        ...prev,
        end_time: formatTimestampLocal(now),
        actual_minutes: calculatedActualMinutes ?? undefined,
      }));
    } else {
      setCompletedAt('');
      setActualMinutes(null);
      setEditedActivity((prev) => ({
        ...prev,
        start_time: undefined,
        end_time: undefined,
        actual_minutes: undefined,
      }));
    }

    setIsCompleted(nextCompleted);
    setHasChanges(true);

    if (nextCompleted) {
      setTimeout(() => {
        actualMinutesRef.current?.focus();
        actualMinutesRef.current?.select();
      }, 100);
    }
  };

  const createTask = async () => {
    if (!newTaskData.title.trim()) return;

    setSaving(true);
    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kidId: (activity as any).kid_id,
          courseId: editedActivity.course_id,
          title: newTaskData.title,
          description: newTaskData.description,
          activityType: 'task',
          planDate: newTaskData.planDate || null,
          estimatedMinutes: newTaskData.estimatedMinutes,
          isActionable: true,
          parentActivityId: activity.id,
        }),
      });

      if (response.ok) {
        setShowCreateTaskForm(false);
        setNewTaskData({
          title: '',
          description: '',
          planDate: editedActivity.plan_date || '',
          estimatedMinutes: 15,
        });
        if (onUpdate) onUpdate();

        const childrenResponse = await fetch(`/api/activities?parent_id=${activity.id}`);
        if (childrenResponse.ok) {
          const data = await childrenResponse.json();
          setChildren(data || []);
        }
      }
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setSaving(false);
    }
  };

  const lmsUrl = activity.lms_url || activity.resource_url;

  return (
    <div className="animate-in backdrop-blur-xs bg-black/40 duration-200 fade-in fixed inset-0 overflow-hidden transition-opacity z-50">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="fixed flex inset-y-0 max-w-full pl-10 right-0">
        <div className="bg-white border-gray-200 border-l duration-300 ease-in-out flex flex-col max-w-xl shadow-2xl slide-in-from-right transform transition-transform w-screen">
          
          <div className="bg-gray-50/80 border-b border-gray-100 flex flex-col gap-3 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex gap-2 items-center">
                <span className="bg-blue-100 capitalize font-semibold px-2.5 py-0.5 rounded-full text-blue-800 text-xs">
                  {activity.activity_type}
                </span>
                {isActionable && (
                  <span className="bg-emerald-100 font-semibold px-2.5 py-0.5 rounded-full text-emerald-800 text-xs">
                    Actionable
                  </span>
                )}
              </div>

              <div className="flex gap-2 items-center">
                {lmsUrl && (
                  <a
                    href={lmsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 flex font-semibold gap-1.5 hover:bg-blue-700 items-center px-3 py-1.5 rounded-lg shadow-sm text-white text-xs transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open LMS Page
                  </a>
                )}
                <button
                  onClick={onClose}
                  className="hover:bg-gray-200/70 p-1.5 rounded-full text-gray-500 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <h2 className="font-bold leading-snug text-gray-900 text-xl">{activity.title}</h2>
          </div>

          <div className="bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-10">
            <div className="flex gap-4 items-center">
              <button
                onClick={() => setActiveTab('details')}
                className={`py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'details'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >
                Overview & Schedule
              </button>
              {checklist && Object.keys(checklist).length > 0 && (
                <button
                  onClick={() => setActiveTab('checklist')}
                  className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeTab === 'checklist'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-400 hover:text-gray-700'
                  }`}
                >
                  Checklist
                  <span className="bg-gray-100 font-bold px-2 py-0.5 rounded-full text-gray-700 text-xs">
                    {Object.keys(checklist).length}
                  </span>
                </button>
              )}
              <button
                onClick={() => setActiveTab('tasks')}
                className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'tasks'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >
                Sub-tasks
                {children.length > 0 && (
                  <span className="bg-gray-100 font-bold px-2 py-0.5 rounded-full text-gray-700 text-xs">
                    {children.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {activeTab === 'details' && (
              <>
                {onLaunchFocus && !isCompleted && (
                  <div className="bg-gradient-to-r flex from-blue-600 items-center justify-between p-4 rounded-2xl shadow-md text-white to-indigo-600">
                    <div className="space-y-0.5">
                      <div className="flex font-bold gap-1.5 items-center text-blue-200 text-xs tracking-wider uppercase">
                        <Zap className="fill-yellow-300 h-3.5 text-yellow-300 w-3.5" />
                        Deep Work Session
                      </div>
                      <p className="font-medium text-sm">Ready to lock in and crush this assignment?</p>
                    </div>
                    <button
                      onClick={() => onLaunchFocus(activity)}
                      className="active:scale-95 bg-white flex font-bold gap-1.5 hover:bg-blue-50 items-center px-4 py-2 rounded-xl shadow-sm text-blue-700 text-xs transition-transform"
                    >
                      <Play className="fill-blue-700 h-3.5 w-3.5" />
                      Start Focus Timer
                    </button>
                  </div>
                )}

                <div className="gap-3 grid grid-cols-1">
                  {courses.length > 0 && (
                    <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-xl space-y-2">
                      <label className="flex font-bold gap-1.5 items-center text-blue-900 text-sm">
                        <BookOpen className="h-4 text-blue-600 w-4" />
                        Course
                      </label>
                      <select
                        value={editedActivity.course_id || ''}
                        onChange={(e) => handleFieldChange('course_id', Number(e.target.value) || undefined)}
                        className="bg-white border border-blue-200 focus:ring-2 focus:ring-blue-500 font-semibold outline-none px-3 py-2 rounded-lg text-gray-900 text-sm w-full"
                      >
                        <option value="">No Course Selected</option>
                        {filteredCourses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.course_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="bg-gray-50/70 border border-gray-100 p-4 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="flex font-bold gap-1.5 items-center text-gray-700 text-sm">
                          <Zap className="h-4 text-emerald-600 w-4" />
                          Actionable Status
                        </label>
                        <p className="text-gray-500 text-xs">Mark as actionable to show in your task list</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionable(!isActionable);
                          setHasChanges(true);
                        }}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                          isActionable ? 'bg-emerald-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            isActionable ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50/50 border border-gray-100 p-4 rounded-xl space-y-4">
                  <div className="space-y-2">
                    <div className="flex font-bold gap-1.5 items-center text-[11px] text-gray-400 tracking-wider uppercase">
                      <Calendar className="h-3.5 text-blue-500 w-3.5" />
                      Planning
                    </div>

                    <div className="gap-3 grid grid-cols-2">
                      <div>
                        <label className="block font-medium mb-1 text-gray-600 text-xs">Plan Date</label>
                        <div className="flex gap-1">
                          <input
                            type="date"
                            value={editedActivity.plan_date || ''}
                            onChange={(e) => handleFieldChange('plan_date', e.target.value || undefined)}
                            className="bg-white border border-gray-200 flex-1 focus:ring-2 focus:ring-blue-500 outline-none px-2.5 py-1.5 rounded-lg text-xs"
                          />
                          {editedActivity.plan_date && (
                            <button
                              type="button"
                              onClick={() => handleFieldChange('plan_date', undefined)}
                              className="bg-gray-200 font-bold hover:bg-gray-300 px-2 py-1 rounded-lg text-gray-600 text-xs transition-colors"
                              title="Clear Plan Date"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block font-medium mb-1 text-gray-600 text-xs">Est. Mins</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={editedActivity.estimated_minutes ?? ''}
                            onChange={(e) =>
                              handleFieldChange(
                                'estimated_minutes',
                                e.target.value !== '' ? parseInt(e.target.value, 10) : undefined
                              )
                            }
                            placeholder="30"
                            className="bg-white border border-gray-200 flex-1 focus:ring-2 focus:ring-blue-500 outline-none px-2.5 py-1.5 rounded-lg text-xs"
                          />
                          {editedActivity.estimated_minutes !== null &&
                            editedActivity.estimated_minutes !== undefined && (
                              <button
                                type="button"
                                onClick={() => handleFieldChange('estimated_minutes', undefined)}
                                className="bg-gray-200 font-bold hover:bg-gray-300 px-2 py-1 rounded-lg text-gray-600 text-xs transition-colors"
                                title="Clear Estimated Minutes"
                              >
                                ✕
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={toggleCompletionNow}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      isCompleted
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isCompleted ? '✓ Completed' : 'Mark Complete'}
                  </button>

                  {editedActivity.start_time && !isCompleted && (
                    <div className="bg-orange-50 border border-orange-200 flex items-center justify-between p-3 rounded-lg">
                      <div>
                        <label className="block font-bold text-[10px] text-orange-800 tracking-wider uppercase">
                          ⏱️ Working Since
                        </label>
                        <div className="font-semibold mt-0.5 text-orange-900 text-xs">
                          {new Date(editedActivity.start_time).toLocaleString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFieldChange('start_time', undefined)}
                        className="bg-orange-200 font-bold hover:bg-orange-300 px-2 py-1 rounded-lg text-orange-900 text-xs transition-colors"
                        title="Stop/Clear Timer"
                      >
                        Clear Timer
                      </button>
                    </div>
                  )}

                  <div className="border-gray-200/80 border-t pt-3 space-y-3">
                    <div className="flex font-bold gap-1.5 items-center text-[11px] text-gray-400 tracking-wider uppercase">
                      <Clock className="h-3.5 text-emerald-600 w-3.5" />
                      Log & Completion Details
                    </div>

                    <div className="gap-3 grid grid-cols-2">
                      <div className="space-y-3">
                        <div>
                          <label className="block font-medium mb-1 text-gray-600 text-xs">Start Time</label>
                          <div className="flex gap-1">
                            <input
                              type="time"
                              value={
                                editedActivity.start_time
                                  ? new Date(editedActivity.start_time).toTimeString().substring(0, 5)
                                  : ''
                              }
                              onChange={(e) => {
                                if (e.target.value && editedActivity.plan_date) {
                                  const dateTime = `${editedActivity.plan_date}T${e.target.value}:00`;
                                  handleFieldChange('start_time', dateTime);
                                } else if (e.target.value) {
                                  const today = formatDateLocal(new Date());
                                  handleFieldChange('start_time', `${today}T${e.target.value}:00`);
                                } else {
                                  handleFieldChange('start_time', undefined);
                                }
                              }}
                              className="bg-white border border-gray-200 flex-1 focus:ring-2 focus:ring-blue-500 outline-none px-2.5 py-1.5 rounded-lg text-xs"
                            />
                            {editedActivity.start_time && (
                              <button
                                type="button"
                                onClick={() => handleFieldChange('start_time', undefined)}
                                className="bg-gray-200 font-bold hover:bg-gray-300 px-2 py-1 rounded-lg text-gray-600 text-xs transition-colors"
                                title="Clear Start Time"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block font-medium mb-1 text-gray-600 text-xs">End Time</label>
                          <div className="flex gap-1">
                            <input
                              type="time"
                              value={
                                editedActivity.end_time
                                  ? new Date(editedActivity.end_time).toTimeString().substring(0, 5)
                                  : ''
                              }
                              onChange={(e) => {
                                if (e.target.value && (completedAt || editedActivity.plan_date)) {
                                  const datePart = completedAt || editedActivity.plan_date;
                                  handleFieldChange('end_time', `${datePart}T${e.target.value}:00`);
                                } else if (e.target.value) {
                                  const today = formatDateLocal(new Date());
                                  handleFieldChange('end_time', `${today}T${e.target.value}:00`);
                                } else {
                                  handleFieldChange('end_time', undefined);
                                }
                              }}
                              className="bg-white border border-gray-200 flex-1 focus:ring-2 focus:ring-blue-500 outline-none px-2.5 py-1.5 rounded-lg text-xs"
                            />
                            {editedActivity.end_time && (
                              <button
                                type="button"
                                onClick={() => handleFieldChange('end_time', undefined)}
                                className="bg-gray-200 font-bold hover:bg-gray-300 px-2 py-1 rounded-lg text-gray-600 text-xs transition-colors"
                                title="Clear End Time"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block font-medium mb-1 text-gray-600 text-xs">Completion Date</label>
                          <div className="flex gap-1">
                            <input
                              type="date"
                              value={completedAt || ''}
                              onChange={(e) => {
                                setCompletedAt(e.target.value);
                                setHasChanges(true);
                              }}
                              className="bg-white border border-gray-200 flex-1 focus:ring-2 focus:ring-emerald-500 outline-none px-2.5 py-1.5 rounded-lg text-xs"
                            />
                            {completedAt && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCompletedAt('');
                                  setHasChanges(true);
                                }}
                                className="bg-gray-200 font-bold hover:bg-gray-300 px-2 py-1 rounded-lg text-gray-600 text-xs transition-colors"
                                title="Clear Completion Date"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block font-bold mb-1 text-gray-600 text-xs">Actual Mins ⭐</label>
                          <div className="flex gap-1">
                            <input
                              ref={actualMinutesRef}
                              type="number"
                              value={actualMinutes ?? ''}
                              onChange={(e) => {
                                const val = e.target.value !== '' ? parseInt(e.target.value, 10) : null;
                                setActualMinutes(val);
                                setHasChanges(true);
                              }}
                              placeholder="0"
                              className="bg-yellow-50 border-2 border-yellow-400 flex-1 focus:ring-2 focus:ring-yellow-500 font-bold outline-none px-2.5 py-1.5 rounded-lg text-xs"
                            />
                            {actualMinutes !== null && actualMinutes !== undefined && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActualMinutes(null);
                                  setHasChanges(true);
                                }}
                                className="bg-gray-200 font-bold hover:bg-gray-300 px-2 py-1 rounded-lg text-gray-600 text-xs transition-colors"
                                title="Clear Actual Minutes"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="bg-white flex items-center justify-between py-1 sticky top-0 z-10">
                    <label className="font-bold text-[11px] text-gray-400 tracking-wider uppercase">
                      Description & Instructions
                    </label>
                    {activity.description && (
                      <button
                        onClick={() => {
                          if (selectedText) {
                            const lines = selectedText.split('\n').filter((l) => l.trim());
                            setNewTaskData({
                              title: lines[0]?.trim() || selectedText.substring(0, 50),
                              description: lines.length > 1 ? lines.slice(1).join('\n').trim() : '',
                              planDate: editedActivity.plan_date || '',
                              estimatedMinutes: 15,
                            });
                          }
                          setShowCreateTaskForm(true);
                        }}
                        className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1 ${
                          hasSelectedText
                            ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <Scissors className="h-3 w-3" />
                        {hasSelectedText ? 'Split Highlighted Text' : 'Split into Sub-task'}
                      </button>
                    )}
                  </div>

                  {showCreateTaskForm && (
                    <div className="bg-blue-50/70 border border-blue-200 my-2 p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-blue-900 text-xs uppercase">New Sub-task</h4>
                        <button onClick={() => setShowCreateTaskForm(false)} className="font-semibold hover:text-blue-700 text-blue-500 text-xs">
                          Cancel
                        </button>
                      </div>
                      <input
                        type="text"
                        value={newTaskData.title}
                        onChange={(e) => setNewTaskData({ ...newTaskData, title: e.target.value })}
                        className="bg-white border border-blue-200 focus:outline-none px-3 py-1.5 rounded-lg text-xs w-full"
                        placeholder="Task title..."
                      />
                      <textarea
                        value={newTaskData.description}
                        onChange={(e) => setNewTaskData({ ...newTaskData, description: e.target.value })}
                        rows={2}
                        className="bg-white border border-blue-200 focus:outline-none px-3 py-1.5 rounded-lg text-xs w-full"
                        placeholder="Task description..."
                      />
                      <div className="gap-2 grid grid-cols-2">
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11px] text-gray-600">Plan Date</label>
                          <input
                            type="date"
                            value={newTaskData.planDate}
                            onChange={(e) => setNewTaskData({ ...newTaskData, planDate: e.target.value })}
                            className="bg-white border border-blue-200 px-2.5 py-1 rounded-lg text-xs w-full"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11px] text-gray-600">Est. Time (Mins)</label>
                          <input
                            type="number"
                            value={newTaskData.estimatedMinutes}
                            onChange={(e) => setNewTaskData({ ...newTaskData, estimatedMinutes: parseInt(e.target.value) || 0 })}
                            className="bg-white border border-blue-200 px-2.5 py-1 rounded-lg text-xs w-full"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={createTask}
                          disabled={saving}
                          className="bg-blue-600 font-semibold hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-xs text-white text-xs"
                        >
                          Create Sub-task
                        </button>
                      </div>
                    </div>
                  )}

                  {activity.description ? (
                    <div className="bg-gray-50/30 border border-gray-100 min-h-[150px] p-4 rounded-xl">
                      <div
                        className="leading-relaxed max-w-none prose prose-sm select-text text-gray-800"
                        dangerouslySetInnerHTML={{ __html: activity.description }}
                        onMouseUp={() => {
                          setTimeout(() => {
                            const text = window.getSelection()?.toString().trim();
                            setSelectedText(text || '');
                            setHasSelectedText(Boolean(text));
                          }, 10);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-200 italic p-6 rounded-xl text-center text-gray-400 text-xs">
                      No detailed description provided for this activity.
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'checklist' && checklist && (
              <div className="space-y-4">
                <div className="bg-blue-50/50 border border-blue-200 p-4 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-blue-900 text-sm">Weekly Checklist</h3>
                    <span className="font-medium text-blue-700 text-xs">
                      {Object.values(checklist).filter((item: any) => item.completed).length} of{' '}
                      {Object.keys(checklist).length} Completed
                    </span>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(checklist).map(([key, item]: [string, any]) => {
                      const taskLines = (item.tasks || '')
                        .split('\n')
                        .map((line: string) => line.trim())
                        .filter((line: string) => line.length > 0);

                      return (
                        <div
                          key={key}
                          className={`p-3.5 rounded-xl border transition-all ${
                            item.completed
                              ? 'bg-gray-50 border-gray-200 opacity-75'
                              : 'bg-white border-blue-100 shadow-xs'
                          }`}
                        >
                          <div className="flex gap-3 items-start">
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() => handleChecklistToggle(key)}
                              className="border-gray-300 cursor-pointer focus:ring-blue-500 h-4 mt-1 rounded text-blue-600 w-4"
                            />

                            <div className="flex-1 min-w-0 space-y-1.5">
                              <span
                                className={`inline-block text-xs font-bold px-2 py-0.5 rounded-md ${
                                  item.completed
                                    ? 'bg-gray-200 text-gray-600 line-through'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {item.label || key}
                              </span>

                              <ul className="mt-1 pl-1 space-y-1">
                                {taskLines.map((taskLine: string, idx: number) => (
                                  <li
                                    key={idx}
                                    className={`text-xs leading-relaxed ${
                                      item.completed
                                        ? 'line-through text-gray-400'
                                        : 'text-gray-700'
                                    }`}
                                  >
                                    {taskLines.length > 1 ? `• ${taskLine}` : taskLine}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-3">
                <div className="font-bold text-gray-400 text-xs tracking-wider uppercase">
                  Created Sub-tasks
                </div>
                {children.length === 0 ? (
                  <div className="py-8 space-y-2 text-center text-gray-400">
                    <FileText className="h-6 mx-auto opacity-30 w-6" />
                    <p className="font-medium text-xs">No sub-tasks yet</p>
                    <p className="max-w-xs mx-auto text-[11px] text-gray-400">
                      Use "Make Task" above or highlight text in the overview tab.
                    </p>
                  </div>
                ) : (
                  children.map((child) => (
                    <div key={child.id} className="bg-white border border-gray-100 flex gap-3 group hover:border-gray-200 items-start justify-between p-3 rounded-xl transition-colors">
                      <div className="flex flex-1 gap-3 items-start min-w-0">
                        <input
                          type="checkbox"
                          checked={child.is_completed}
                          onChange={async () => {
                            await fetch('/api/activities', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                activityId: child.id,
                                updates: { isCompleted: !child.is_completed },
                              }),
                            });
                            const response = await fetch(`/api/activities?parent_id=${activity.id}`);
                            if (response.ok) {
                              setChildren((await response.json()) || []);
                            }
                          }}
                          className="focus:ring-0 mt-0.5 rounded text-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${child.is_completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {child.title}
                          </p>
                          {child.description && (
                            <p className="line-clamp-2 mt-0.5 text-gray-500 text-xs">{child.description}</p>
                          )}
                          <div className="flex font-medium gap-3 items-center mt-1 text-[11px] text-gray-400">
                            {child.plan_date && <span>📅 {child.plan_date}</span>}
                            {child.estimated_minutes && <span>⏱️ {child.estimated_minutes}m</span>}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => deleteActivity(child.id)}
                        className="group-hover:opacity-100 hover:text-red-600 opacity-0 p-1 text-gray-300 transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-50/80 border-gray-100 border-t flex items-center justify-between px-6 py-4">
            <button
              onClick={() => deleteActivity(activity.id)}
              className="flex font-semibold gap-1.5 hover:text-red-700 items-center text-red-600 text-xs transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Activity
            </button>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="font-semibold hover:bg-gray-200/60 px-4 py-2 rounded-lg text-gray-600 text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveChanges}
                disabled={saving || !hasChanges}
                className="bg-blue-600 disabled:opacity-50 flex font-semibold gap-1.5 hover:bg-blue-700 items-center px-4 py-2 rounded-lg shadow-sm text-white text-xs transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}