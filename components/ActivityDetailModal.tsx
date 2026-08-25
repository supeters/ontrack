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
  BookOpen,
  Play,
  Zap,
  Plus,
  Check
} from 'lucide-react';
import { formatDateLocal, formatTimestampLocal, getDateStr, parseLocalTimestamp } from '@/lib/datetime';
import { parseChecklistInput } from '@/lib/parseChecklist';

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

function getChunkMinutes(chunk: any): number {
  if (chunk.minutes_worked) {
    return chunk.minutes_worked;
  }

  if (chunk.start_time && chunk.end_time) {
    const start = new Date(chunk.start_time);
    const end = new Date(chunk.end_time);
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  }

  return 0;
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
  const [activeTab, setActiveTab] = useState<'details' | 'tasks'>('details');
  
  // Bulk Add Modal & Inputs
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTaskInput, setBulkTaskInput] = useState('');
  const [bulkPlanDate, setBulkPlanDate] = useState<string>(activity.plan_date || '');

  const [children, setChildren] = useState<Activity[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [isActionable, setIsActionable] = useState(activity.is_action ?? false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isCompleted, setIsCompleted] = useState(activity.is_completed || false);
  const [actualMinutes, setActualMinutes] = useState<number | null>(getDisplayMinutes(activity));
  const [completedAt, setCompletedAt] = useState(() => {
    if (activity.completed_at) {
      return getDateStr(activity.completed_at);
    }
    return activity.plan_date || formatDateLocal(new Date());
  });
  const [courses, setCourses] = useState<Course[]>(coursesProp);
  const [workChunks, setWorkChunks] = useState<any[]>([]);

  const actualMinutesRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter children so only activity_type === 'task' is handled
  const taskChildren = children.filter((c) => c.activity_type === 'task');

  // Auto-resize textarea when editing title
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editingTaskTitle, editingTaskId]);

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

    if (activity.completed_at) {
      setCompletedAt(getDateStr(activity.completed_at));
    } else {
      setCompletedAt(activity.plan_date || formatDateLocal(new Date()));
    }

    setHasChanges(false);
  }, [activity]);

  const fetchChildren = async () => {
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

  useEffect(() => {
    if (activity.id) {
      fetchChildren();
    }
  }, [activity.id]);

  useEffect(() => {
    const loadWorkChunks = async () => {
      try {
        const response = await fetch(`/api/work-chunks?activity_id=${activity.id}`);
        if (response.ok) {
          const data = await response.json();
          setWorkChunks(data.chunks || []);
        }
      } catch (error) {
        console.error('Error loading work chunks:', error);
      }
    };

    if (activity.id) {
      loadWorkChunks();
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
        estimated_minutes: editedActivity.estimated_minutes || null,
        actual_minutes: isCompleted ? actualMinutes : null,
        is_completed: isCompleted,
        completed_at: isCompleted ? (completedAt || formatDateLocal(new Date())) : null,
        is_action_override: isActionable,
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

  const handleBulkAddTasks = async () => {
    if (!bulkTaskInput.trim()) return;

    const parsedItems = parseChecklistInput(bulkTaskInput);
    if (parsedItems.length === 0) return;

    setSaving(true);
    try {
      for (const item of parsedItems) {
        await fetch('/api/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kidId: activity.kid_id,
            courseId: editedActivity.course_id,
            title: item.text,
            description: '',
            activityType: 'task',
            planDate: bulkPlanDate || editedActivity.plan_date || null,
            estimatedMinutes: 15,
            isActionable: true,
            parentActivityId: activity.id,
          }),
        });
      }

      await fetchChildren();
      setBulkTaskInput('');
      setShowBulkModal(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error creating bulk tasks:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateTaskDate = async (taskId: number, newDate: string) => {
    try {
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: taskId,
          updates: { plan_date: newDate || null },
        }),
      });
      fetchChildren();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating task plan date:', error);
    }
  };

  const updateTaskTitle = async (taskId: number, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: taskId,
          updates: { title: newTitle.trim() },
        }),
      });
      setEditingTaskId(null);
      fetchChildren();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating task title:', error);
    }
  };

  const deleteActivity = async (idToDelete: number) => {
    if (!confirm('Are you sure you want to delete this activity?')) return;

    try {
      await fetch(`/api/activities?id=${idToDelete}`, { method: 'DELETE' });
      if (idToDelete === activity.id) {
        if (onUpdate) onUpdate();
        onClose();
      } else {
        await fetchChildren();
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
              <button
                onClick={() => setActiveTab('tasks')}
                className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'tasks'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >
                Checklist
                {taskChildren.length > 0 && (
                  <span className="bg-gray-100 font-bold px-2 py-0.5 rounded-full text-gray-700 text-xs">
                    {taskChildren.length}
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

                  {workChunks.length > 0 && (
                    <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block font-bold text-[10px] text-purple-800 tracking-wider uppercase">
                          ⏱️ Work Sessions ({workChunks.length})
                        </label>
                        <div className="font-semibold text-purple-900 text-xs">
                          Total: {workChunks.reduce((sum, chunk) => sum + getChunkMinutes(chunk), 0)} min
                        </div>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1.5">
                        {workChunks.map((chunk, idx) => (
                          <div key={chunk.id} className="bg-white border border-purple-100 flex items-center justify-between px-2 py-1.5 rounded text-xs">
                            <div className="flex gap-2 items-center">
                              <span className="font-mono text-[10px] text-gray-500">#{idx + 1}</span>
                              {chunk.mood && (
                                <span className="text-sm">
                                  {chunk.mood === 'struggled' && '😫'}
                                  {chunk.mood === 'okay' && '😐'}
                                  {chunk.mood === 'good' && '🙂'}
                                  {chunk.mood === 'great' && '😊'}
                                  {chunk.mood === 'focused' && '🎯'}
                                </span>
                              )}
                              <span className="font-medium text-gray-700">
                                {getChunkMinutes(chunk)} min
                              </span>
                              {chunk.is_active && (
                                <span className="bg-green-100 font-bold px-1.5 py-0.5 rounded text-[10px] text-green-800 uppercase">
                                  Active
                                </span>
                              )}
                            </div>
                            {chunk.notes && (
                              <span className="max-w-[120px] text-[10px] text-gray-500 truncate" title={chunk.notes}>
                                "{chunk.notes}"
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-gray-200/80 border-t pt-3 space-y-3">
                    <div className="flex font-bold gap-1.5 items-center text-[11px] text-gray-400 tracking-wider uppercase">
                      <Clock className="h-3.5 text-emerald-600 w-3.5" />
                      Log & Completion Details
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

                <div className="space-y-2">
                  <div className="bg-white flex items-center justify-between py-1 sticky top-0 z-10">
                    <label className="font-bold text-[11px] text-gray-400 tracking-wider uppercase">
                      Description & Instructions
                    </label>
                  </div>

                  {activity.description ? (
                    <div className="bg-gray-50/30 border border-gray-100 min-h-[150px] p-4 rounded-xl">
                      <div
                        className="leading-relaxed max-w-none prose prose-sm text-gray-800"
                        dangerouslySetInnerHTML={{ __html: activity.description }}
                        style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
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

            {activeTab === 'tasks' && (
              <div className="space-y-4">
                {/* Header row with Add Button */}
                <div className="flex items-center justify-between">
                  <div className="font-bold text-gray-400 text-xs tracking-wider uppercase">
                    Checklist ({taskChildren.length})
                  </div>
                  <button
                    onClick={() => setShowBulkModal(true)}
                    className="active:scale-95 bg-blue-600 flex font-semibold hover:bg-blue-700 items-center p-2 rounded-full shadow-md text-white transition-all"
                    title="Add tasks"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Styled Checklist */}
                {taskChildren.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 py-12 rounded-2xl space-y-2 text-center text-gray-400">
                    <FileText className="h-8 mx-auto opacity-30 w-8" />
                    <p className="font-medium text-xs">No checklist tasks yet</p>
                    <p className="max-w-xs mx-auto text-[11px] text-gray-400">
                      Click the + button above to add new tasks to this activity.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {taskChildren.map((child) => (
                      <div
                        key={child.id}
                        className={`group border flex items-start justify-between p-3 rounded-xl transition-all gap-3 ${
                          child.is_completed
                            ? 'bg-gray-50/70 border-gray-200/80 opacity-75'
                            : 'bg-white border-gray-200/80 shadow-xs hover:border-blue-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex flex-1 gap-3 items-start min-w-0">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await fetch('/api/activities', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    activityId: child.id,
                                    updates: { isCompleted: !child.is_completed },
                                  }),
                                });
                                await fetchChildren();
                                if (onUpdate) onUpdate();
                              } catch (error) {
                                console.error('Error toggling task:', error);
                              }
                            }}
                            className={`flex h-5 w-5 items-center justify-center rounded-md transition-all shrink-0 mt-0.5 ${
                              child.is_completed
                                ? 'bg-emerald-600 text-white'
                                : 'border-2 border-gray-300 hover:border-emerald-500'
                            }`}
                          >
                            {child.is_completed && <Check className="h-3.5 stroke-[3] w-3.5" />}
                          </button>

                          <div className="flex-1 min-w-0">
                            {editingTaskId === child.id ? (
                              <textarea
                                ref={textareaRef}
                                value={editingTaskTitle}
                                onChange={(e) => setEditingTaskTitle(e.target.value)}
                                onBlur={() => updateTaskTitle(child.id, editingTaskTitle)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    updateTaskTitle(child.id, editingTaskTitle);
                                  } else if (e.key === 'Escape') {
                                    setEditingTaskId(null);
                                  }
                                }}
                                autoFocus
                                rows={1}
                                className="bg-blue-50/50 border border-blue-300 focus:ring-2 focus:ring-blue-500 leading-relaxed outline-none overflow-hidden px-2 py-1 resize-none rounded text-gray-800 text-xs w-full"
                              />
                            ) : (
                              <p
                                onClick={() => {
                                  setEditingTaskId(child.id);
                                  setEditingTaskTitle(child.title);
                                }}
                                className={`text-xs font-normal leading-relaxed break-words cursor-pointer hover:bg-gray-100/80 p-1 rounded transition-colors ${
                                  child.is_completed ? 'line-through text-gray-400' : 'text-gray-700'
                                }`}
                                title="Click to edit text"
                              >
                                {child.title}
                              </p>
                            )}
                            {child.description && (
                              <p className="break-words leading-normal mt-1 text-[11px] text-gray-500">{child.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Minimal Plan Date Icon & Formatting */}
                        <div className="flex gap-1.5 items-center pt-0.5 shrink-0">
                          <div className="flex items-center relative">
                            <button
                              type="button"
                              className="flex gap-1 hover:bg-blue-50 hover:text-blue-600 items-center p-1.5 rounded-lg text-gray-400 transition-colors"
                              title="Set or change plan date"
                            >
                              <Calendar className="h-4 w-4" />
                              {child.plan_date && (
                                <span className="font-semibold text-[11px] text-gray-600">
                                  {child.plan_date.includes('T') ? child.plan_date.split('T')[0] : child.plan_date}
                                </span>
                              )}
                            </button>
                            <input
                              type="date"
                              value={child.plan_date || ''}
                              onChange={(e) => updateTaskDate(child.id, e.target.value)}
                              className="absolute cursor-pointer h-full inset-0 opacity-0 w-full"
                            />
                          </div>

                          <button
                            onClick={() => deleteActivity(child.id)}
                            className="group-hover:opacity-100 hover:text-red-600 opacity-0 p-1 rounded text-gray-300 transition-opacity"
                            title="Delete task"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
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

      {/* Add Task Modal */}
      {showBulkModal && (
        <div className="animate-in backdrop-blur-xs bg-black/50 duration-150 fade-in fixed flex inset-0 items-center justify-center p-4 z-60">
          <div className="bg-white border border-gray-100 max-w-lg p-6 rounded-2xl shadow-2xl space-y-4 w-full">
            <div className="border-b border-gray-100 flex items-center justify-between pb-3">
              <h3 className="font-bold text-base text-gray-900">Add Checklist Tasks</h3>
              <button
                onClick={() => setShowBulkModal(false)}
                className="hover:text-gray-600 p-1 rounded-full text-gray-400 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold mb-1 text-gray-700 text-xs">
                  Task List
                </label>
                <textarea
                  value={bulkTaskInput}
                  onChange={(e) => setBulkTaskInput(e.target.value)}
                  placeholder={"# Read Chapter 1\n# Write Summary\n# Solve Questions 1-5"}
                  rows={6}
                  className="border border-gray-200 focus:ring-2 focus:ring-blue-500 font-mono outline-none p-3 resize-none rounded-xl text-xs w-full"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Prefix lines with <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">#</code> to define distinct tasks.
                </p>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 text-xs">
                  Plan Date for Created Tasks (Optional)
                </label>
                <input
                  type="date"
                  value={bulkPlanDate}
                  onChange={(e) => setBulkPlanDate(e.target.value)}
                  className="border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none px-3 py-2 rounded-xl text-xs w-full"
                />
              </div>
            </div>

            <div className="border-gray-100 border-t flex gap-2 items-center justify-end pt-2">
              <button
                onClick={() => setShowBulkModal(false)}
                className="font-semibold hover:bg-gray-100 px-4 py-2 rounded-xl text-gray-600 text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAddTasks}
                disabled={!bulkTaskInput.trim() || saving}
                className="bg-blue-600 disabled:bg-gray-300 font-semibold hover:bg-blue-700 px-4 py-2 rounded-xl text-white text-xs transition-colors"
              >
                {saving ? 'Adding...' : 'Add Tasks'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}