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
  Check,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { formatDateLocal, formatTimestampLocal, getDateStr, parseLocalTimestamp } from '@/lib/datetime';
import { parseChecklistInput } from '@/lib/parseChecklist';
import { ThemeColors, getTheme } from '@/lib/themes'; // Adjust import path to match your themes file

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
  themeName?: string;
  themeColors?: ThemeColors;
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
  themeName = 'ancientParchment',
  themeColors,
  onClose,
  onUpdate,
  onLaunchFocus,
}: ActivityDetailModalProps) {
  // Resolve theme colors
  const activeTheme = getTheme(themeName);
  const c = themeColors || activeTheme.colors;

  const [editedActivity, setEditedActivity] = useState<Activity>(activity);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'tasks'>('details');
  
  // Bulk Add Modal & Inputs
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTaskInput, setBulkTaskInput] = useState('');

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
  const [editingChunk, setEditingChunk] = useState<any | null>(null);
  const [editChunkMinutes, setEditChunkMinutes] = useState<number>(0);
  const [editChunkMood, setEditChunkMood] = useState<string>('');
  const [editChunkNotes, setEditChunkNotes] = useState<string>('');
  const [showAddWorkSession, setShowAddWorkSession] = useState(false);
  const [newSessionMinutes, setNewSessionMinutes] = useState<number>(30);
  const [newSessionMood, setNewSessionMood] = useState<string>('');
  const [newSessionNotes, setNewSessionNotes] = useState<string>('');

  const actualMinutesRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bulkTextareaRef = useRef<HTMLTextAreaElement>(null);

  const taskChildren = children.filter((c) => c.activity_type === 'task');

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editingTaskTitle, editingTaskId]);

  useEffect(() => {
    if (bulkTextareaRef.current) {
      bulkTextareaRef.current.style.height = 'auto';
      bulkTextareaRef.current.style.height = `${Math.max(bulkTextareaRef.current.scrollHeight, 150)}px`;
    }
  }, [bulkTaskInput]);

  useEffect(() => {
    const loadCourses = async () => {
      // 1. Guard against invalid or missing kid_id
      if (!activity?.kid_id) {
        console.warn('loadCourses skipped: missing activity.kid_id');
        return;
      }

      const url = `/api/courses?kidId=${activity.kid_id}`;

      try {
        // 2. Wrap network request in try/catch
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setCourses(data || []);
      } catch (error) {
        // 3. Gracefully handle fetch failure
        console.error('Failed to fetch courses:', error);
        setCourses([]);
      }
    };

    loadCourses();
  }, [activity?.kid_id]);

  
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
        // Sort by position, then by created_at
        const sorted = (data || []).sort((a: any, b: any) => {
          if (a.position !== null && b.position !== null) {
            return a.position - b.position;
          }
          if (a.position !== null) return -1;
          if (b.position !== null) return 1;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        setChildren(sorted);
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
      // Get highest existing position for this parent
      const existingChildren = await fetch(`/api/activities?parent_id=${activity.id}`).then(r => r.json());
      let maxPosition = existingChildren.reduce((max: number, child: any) =>
        Math.max(max, child.position || 0), 0
      );

      for (let i = 0; i < parsedItems.length; i++) {
        const item = parsedItems[i];
        await fetch('/api/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kidId: activity.kid_id,
            courseId: editedActivity.course_id,
            title: item.text,
            description: '',
            activityType: 'task',
            planDate: item.planDate || null, // Only use explicit @date, don't default
            estimatedMinutes: 15,
            isActionable: true,
            parentActivityId: activity.id,
            position: maxPosition + i + 1, // Set position in order
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
    const nowTimestamp = formatTimestampLocal(now);

    try {
      if (nextCompleted) {
        // 1. Stop any active work chunks first
        const activeChunk = workChunks.find(chunk => chunk.is_active);
        if (activeChunk) {
          const startTime = new Date(activeChunk.start_time);
          const endTime = new Date();
          const minutesWorked = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000));

          await fetch('/api/work-chunks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chunkId: activeChunk.id,
              updates: {
                end_time: endTime.toISOString(),
                is_active: false,
                minutes_worked: minutesWorked,
              },
            }),
          });
        }

        // 2. Reload work chunks to get updated totals
        const chunksRes = await fetch(`/api/work-chunks?activity_id=${activity.id}`);
        const chunksData = await chunksRes.json();
        const allChunks = chunksData.chunks || [];

        // 3. Calculate total minutes from all work chunks
        const totalMinutes = allChunks.reduce((sum: number, chunk: any) => {
          return sum + getChunkMinutes(chunk);
        }, 0);

        // 4. Mark activity as completed with calculated actual_minutes
        const completedDate = editedActivity.plan_date || formatDateLocal(now);
        await fetch('/api/activities', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityId: activity.id,
            updates: {
              is_completed: true,
              completed_at: completedDate,
              end_time: nowTimestamp,
              start_time: null,
              actual_minutes: totalMinutes > 0 ? totalMinutes : null,
            },
          }),
        });

        // 5. Update local state
        setWorkChunks(allChunks);
        setActualMinutes(totalMinutes > 0 ? totalMinutes : null);
        setCompletedAt(completedDate);
        setIsCompleted(true);

        if (onUpdate) onUpdate();
      } else {
        // Uncomplete the activity
        await fetch('/api/activities', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityId: activity.id,
            updates: {
              is_completed: false,
              completed_at: null,
              end_time: null,
              actual_minutes: null,
            },
          }),
        });

        setCompletedAt('');
        setActualMinutes(null);
        setIsCompleted(false);

        if (onUpdate) onUpdate();
      }
    } catch (error) {
      console.error('Error toggling completion:', error);
    }
  };

  const handleEditChunk = (chunk: any) => {
    setEditingChunk(chunk);
    setEditChunkMinutes(getChunkMinutes(chunk));
    setEditChunkMood(chunk.mood || '');
    setEditChunkNotes(chunk.notes || '');
  };

  const handleSaveChunk = async () => {
    if (!editingChunk) return;

    try {
      await fetch('/api/work-chunks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunkId: editingChunk.id,
          updates: {
            minutes_worked: editChunkMinutes,
            mood: editChunkMood || null,
            notes: editChunkNotes || null,
          },
        }),
      });

      // Reload work chunks
      const response = await fetch(`/api/work-chunks?activity_id=${activity.id}`);
      const data = await response.json();
      setWorkChunks(data.chunks || []);
      setEditingChunk(null);
    } catch (error) {
      console.error('Error updating work chunk:', error);
    }
  };

  const handleCancelEditChunk = () => {
    setEditingChunk(null);
    setEditChunkMinutes(0);
    setEditChunkMood('');
    setEditChunkNotes('');
  };

  const handleDeleteChunk = async (chunkId: number) => {
    if (!confirm('Delete this work session?')) return;

    try {
      await fetch('/api/work-chunks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkId }),
      });

      // Reload work chunks
      const response = await fetch(`/api/work-chunks?activity_id=${activity.id}`);
      const data = await response.json();
      setWorkChunks(data.chunks || []);
    } catch (error) {
      console.error('Error deleting work chunk:', error);
    }
  };

  const handleAddWorkSession = async () => {
    if (!newSessionMinutes || newSessionMinutes <= 0) {
      alert('Please enter valid minutes');
      return;
    }

    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - newSessionMinutes * 60000);

      await fetch('/api/work-chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: activity.id,
          kid_id: activity.kid_id,
          start_time: startTime.toISOString(),
          end_time: now.toISOString(),
          is_active: false,
          is_manual: true,
          minutes_worked: newSessionMinutes,
          mood: newSessionMood || null,
          notes: newSessionNotes || null,
        }),
      });

      // Reload work chunks
      const response = await fetch(`/api/work-chunks?activity_id=${activity.id}`);
      const data = await response.json();
      setWorkChunks(data.chunks || []);

      // Reset form and close
      setNewSessionMinutes(30);
      setNewSessionMood('');
      setNewSessionNotes('');
      setShowAddWorkSession(false);
    } catch (error) {
      console.error('Error adding work session:', error);
    }
  };

  const moveTask = async (taskId: number, direction: 'up' | 'down') => {
    const currentIndex = taskChildren.findIndex(t => t.id === taskId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= taskChildren.length) return;

    const currentTask = taskChildren[currentIndex];
    const targetTask = taskChildren[targetIndex];

    // Swap positions
    try {
      await Promise.all([
        fetch('/api/activities', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityId: currentTask.id,
            updates: { position: targetTask.position },
          }),
        }),
        fetch('/api/activities', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityId: targetTask.id,
            updates: { position: currentTask.position },
          }),
        }),
      ]);

      await fetchChildren();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error reordering tasks:', error);
    }
  };

  const lmsUrl = activity.lms_url || activity.resource_url;

  return (
    <div className="animate-in backdrop-blur-xs bg-black/50 duration-200 fade-in fixed inset-0 overflow-hidden transition-opacity z-50">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="fixed flex inset-y-0 max-w-full pl-10 right-0">
        <div className={`${c.cardBg} ${c.text} border-l ${c.sidebarBorder} duration-300 ease-in-out flex flex-col max-w-xl shadow-2xl slide-in-from-right transform transition-transform w-screen`}>

          {/* Header */}
          <div className={`${c.workgroupBg} border-b ${c.sidebarBorder} flex flex-col gap-3 px-6 py-5`}>
            <div className="flex items-center justify-between">
              <div className="flex gap-2 items-center">
                <span className={`${c.moduleHeader} ${c.moduleText} capitalize font-semibold px-2.5 py-0.5 rounded-full text-xs`}>
                  {activity.activity_type}
                </span>
                {isActionable && (
                  <span className={`${c.checkboxChecked} text-white font-semibold px-2.5 py-0.5 rounded-full text-xs`}>
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
                    className={`${c.checkboxChecked} flex font-semibold gap-1.5 hover:opacity-90 items-center px-3 py-1.5 rounded-lg shadow-sm text-white text-xs transition-colors`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open LMS Page
                  </a>
                )}
                <button
                  onClick={onClose}
                  className={`p-1.5 rounded-full ${c.mutedText} ${c.activityHover} transition-colors`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <h2 className={`font-bold leading-snug ${c.text} text-xl`}>{activity.title}</h2>
          </div>

          {/* Tabs Nav */}
          <div className={`${c.cardBg} border-b ${c.sidebarBorder} flex items-center justify-between px-6 sticky top-0 z-10`}>
            <div className="flex gap-4 items-center">
              <button
                onClick={() => setActiveTab('details')}
                className={`py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'details'
                    ? `${c.sidebarSelectedBorder} ${c.text}`
                    : `border-transparent ${c.mutedText}`
                }`}
              >
                Overview & Schedule
              </button>
              <button
                onClick={() => setActiveTab('tasks')}
                className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'tasks'
                    ? `${c.sidebarSelectedBorder} ${c.text}`
                    : `border-transparent ${c.mutedText}`
                }`}
              >
                Checklist
                {taskChildren.length > 0 && (
                  <span className={`${c.moduleHeader} ${c.text} font-bold px-2 py-0.5 rounded-full text-xs`}>
                    {taskChildren.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {activeTab === 'details' && (
              <>
                {onLaunchFocus && !isCompleted && (
                  <div className={`${c.moduleHeader} border ${c.moduleBorder} flex items-center justify-between p-4 rounded-2xl shadow-md`}>
                    <div className="space-y-0.5">
                      <div className={`flex font-bold gap-1.5 items-center ${c.moduleIcon} text-xs tracking-wider uppercase`}>
                        <Zap className="fill-current h-3.5 w-3.5" />
                        Deep Work Session
                      </div>
                      <p className={`font-medium ${c.text} text-sm`}>Ready to lock in and crush this assignment?</p>
                    </div>
                    <button
                      onClick={() => onLaunchFocus(activity)}
                      className={`active:scale-95 ${c.checkboxChecked} text-white flex font-bold gap-1.5 hover:opacity-90 items-center px-4 py-2 rounded-xl shadow-sm text-xs transition-transform`}
                    >
                      <Play className="fill-current h-3.5 w-3.5" />
                      Start Focus Timer
                    </button>
                  </div>
                )}

                <div className="gap-3 grid grid-cols-1">
                  {courses.length > 0 && (
                    <div className={`${c.workgroupBg} border ${c.sidebarBorder} p-4 rounded-xl space-y-2`}>
                      <label className={`flex font-bold gap-1.5 items-center ${c.text} text-sm`}>
                        <BookOpen className={`h-4 ${c.moduleIcon} w-4`} />
                        Course
                      </label>
                      <select
                        value={editedActivity.course_id || ''}
                        onChange={(e) => handleFieldChange('course_id', Number(e.target.value) || undefined)}
                        className={`${c.cardBg} ${c.text} border ${c.sidebarBorder} focus:ring-2 focus:ring-amber-500 font-semibold outline-none px-3 py-2 rounded-lg text-sm w-full`}
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

                  <div className={`${c.workgroupBg} border ${c.sidebarBorder} p-4 rounded-xl`}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className={`flex font-bold gap-1.5 items-center ${c.text} text-sm`}>
                          <Zap className={`h-4 ${c.activityIcon} w-4`} />
                          Actionable Status
                        </label>
                        <p className={`${c.mutedText} text-xs`}>Mark as actionable to show in your task list</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionable(!isActionable);
                          setHasChanges(true);
                        }}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
                          isActionable ? c.checkboxChecked : 'bg-gray-300 dark:bg-gray-700'
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

                <div className={`${c.workgroupBg} border ${c.sidebarBorder} p-4 rounded-xl space-y-4`}>
                  <div className="space-y-2">
                    <div className={`flex font-bold gap-1.5 items-center text-[11px] ${c.mutedText} tracking-wider uppercase`}>
                      <Calendar className={`h-3.5 ${c.activityIcon} w-3.5`} />
                      Planning
                    </div>

                    <div className="gap-3 grid grid-cols-2">
                      <div>
                        <label className={`block font-medium mb-1 ${c.statText} text-xs`}>Plan Date</label>
                        <div className="flex gap-1">
                          <input
                            type="date"
                            value={editedActivity.plan_date || ''}
                            onChange={(e) => handleFieldChange('plan_date', e.target.value || undefined)}
                            className={`${c.cardBg} ${c.text} border ${c.sidebarBorder} flex-1 outline-none px-2.5 py-1.5 rounded-lg text-xs`}
                          />
                          {editedActivity.plan_date && (
                            <button
                              type="button"
                              onClick={() => handleFieldChange('plan_date', undefined)}
                              className={`${c.moduleHeader} ${c.text} font-bold px-2 py-1 rounded-lg text-xs transition-colors`}
                              title="Clear Plan Date"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className={`block font-medium mb-1 ${c.statText} text-xs`}>Est. Mins</label>
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
                            className={`${c.cardBg} ${c.text} border ${c.sidebarBorder} flex-1 outline-none px-2.5 py-1.5 rounded-lg text-xs`}
                          />
                          {editedActivity.estimated_minutes !== null &&
                            editedActivity.estimated_minutes !== undefined && (
                              <button
                                type="button"
                                onClick={() => handleFieldChange('estimated_minutes', undefined)}
                                className={`${c.moduleHeader} ${c.text} font-bold px-2 py-1 rounded-lg text-xs transition-colors`}
                                title="Clear Estimated Minutes"
                              >
                                ✕
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={toggleCompletionNow}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        isCompleted
                          ? `${c.checkboxChecked} text-white shadow-sm`
                          : `${c.moduleHeader} ${c.text} hover:opacity-90`
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isCompleted ? '✓ Completed' : 'Mark Complete'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAddWorkSession(true)}
                      className={`${c.moduleHeader} ${c.text} flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity`}
                      title="Add manual work session"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">Add Time</span>
                    </button>
                  </div>

                  {workChunks.length > 0 && (
                    <div className={`${c.moduleHeader} border ${c.moduleBorder} p-3 rounded-lg space-y-2`}>
                      <div className="flex items-center justify-between">
                        <label className={`block font-bold text-[10px] ${c.text} tracking-wider uppercase`}>
                          ⏱️ Work Sessions ({workChunks.length})
                        </label>
                        <div className={`font-semibold ${c.text} text-xs`}>
                          Total: {workChunks.reduce((sum, chunk) => sum + getChunkMinutes(chunk), 0)} min
                        </div>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1.5">
                        {workChunks.map((chunk, idx) => (
                          <div key={chunk.id} className={`${c.cardBg} border ${c.sidebarBorder} flex items-center justify-between px-2 py-1.5 rounded text-xs gap-2`}>
                            <div className="flex gap-2 items-center flex-1 min-w-0">
                              <span className={`font-mono text-[10px] ${c.mutedText}`}>#{idx + 1}</span>
                              {chunk.mood && (
                                <span className="text-sm">
                                  {chunk.mood === 'struggled' && '😫'}
                                  {chunk.mood === 'okay' && '😐'}
                                  {chunk.mood === 'good' && '🙂'}
                                  {chunk.mood === 'great' && '😊'}
                                  {chunk.mood === 'focused' && '🎯'}
                                </span>
                              )}
                              <span className={`font-medium ${c.text}`}>
                                {getChunkMinutes(chunk)} min
                              </span>
                              {chunk.is_active && (
                                <span className={`${c.checkboxChecked} font-bold px-1.5 py-0.5 rounded text-[10px] text-white uppercase`}>
                                  Active
                                </span>
                              )}
                              {chunk.notes && (
                                <span className={`max-w-[100px] text-[10px] ${c.mutedText} truncate`} title={chunk.notes}>
                                  "{chunk.notes}"
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleEditChunk(chunk)}
                                className={`${c.moduleHeader} ${c.text} px-1.5 py-0.5 rounded text-[10px] font-medium hover:opacity-80 transition-opacity`}
                                title="Edit work session"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteChunk(chunk.id)}
                                className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-medium hover:bg-red-200 transition-colors"
                                title="Delete work session"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isCompleted && (
                    <div className={`border-t ${c.sidebarBorder} pt-3 space-y-3`}>
                      <div className={`flex font-bold gap-1.5 items-center text-[11px] ${c.mutedText} tracking-wider uppercase`}>
                        <Clock className={`h-3.5 ${c.activityIcon} w-3.5`} />
                        Log & Completion Details
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className={`block font-medium mb-1 ${c.statText} text-xs`}>Completion Date</label>
                          <div className="flex gap-1">
                            <input
                              type="date"
                              value={completedAt || ''}
                              onChange={(e) => {
                                setCompletedAt(e.target.value);
                                setHasChanges(true);
                              }}
                              className={`${c.cardBg} ${c.text} border ${c.sidebarBorder} flex-1 outline-none px-2.5 py-1.5 rounded-lg text-xs`}
                            />
                            {completedAt && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCompletedAt('');
                                  setHasChanges(true);
                                }}
                                className={`${c.moduleHeader} ${c.text} font-bold px-2 py-1 rounded-lg text-xs transition-colors`}
                                title="Clear Completion Date"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className={`block font-bold mb-1 ${c.statText} text-xs`}>Time Spent</label>
                          <div className={`${c.workgroupBg} border ${c.moduleBorder} px-3 py-2 rounded-lg`}>
                            <div className={`text-lg font-bold ${c.text}`}>
                              {actualMinutes ? `${actualMinutes} min` : '—'}
                            </div>
                            <div className={`text-[10px] ${c.mutedText}`}>
                              Calculated from {workChunks.length} work session{workChunks.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className={`flex items-center justify-between py-1 sticky top-0 z-10 ${c.cardBg}`}>
                    <label className={`font-bold text-[11px] ${c.mutedText} tracking-wider uppercase`}>
                      Description & Instructions
                    </label>
                  </div>

                  {activity.description ? (
                    <div className={`${c.workgroupBg} border ${c.sidebarBorder} min-h-[150px] p-4 rounded-xl`}>
                      <div
                        className={`leading-relaxed max-w-none prose prose-sm ${c.text}`}
                        dangerouslySetInnerHTML={{ __html: activity.description }}
                        style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                      />
                    </div>
                  ) : (
                    <div className={`border border-dashed ${c.sidebarBorder} italic p-6 rounded-xl text-center ${c.mutedText} text-xs`}>
                      No detailed description provided for this activity.
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className={`font-bold text-xs ${c.mutedText} tracking-wider uppercase`}>
                    Checklist ({taskChildren.length})
                  </div>
                  <div className="flex gap-2 items-center">
                    {taskChildren.length > 0 && (
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete all ${taskChildren.length} checklist items? This cannot be undone.`)) return;

                          try {
                            await Promise.all(
                              taskChildren.map(child =>
                                fetch('/api/activities', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    activityId: child.id,
                                    updates: { is_deleted: true },
                                  }),
                                })
                              )
                            );
                            await fetchChildren();
                            if (onUpdate) onUpdate();
                          } catch (error) {
                            console.error('Error deleting all tasks:', error);
                          }
                        }}
                        className={`${c.dangerBg} ${c.dangerBorder} ${c.dangerText} border flex font-medium gap-1 hover:opacity-80 items-center px-2 py-1 rounded-lg text-[10px] transition-opacity`}
                        title="Delete all checklist items"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete All
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const rawDescription = activity.description
                          ? activity.description
                              .replace(/<br\s*[\/]?>/gi, '\n')
                              .replace(/<\/p>/gi, '\n')
                              .replace(/<[^>]+>/g, '')
                              .trim()
                          : '';

                        if (rawDescription) {
                          const formattedInput = rawDescription
                            .split('\n')
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((line) => (line.startsWith('#') ? line : `# ${line}`))
                            .join('\n');

                          setBulkTaskInput(formattedInput);
                        } else {
                          setBulkTaskInput('');
                        }

                        setShowBulkModal(true);
                      }}
                      className={`active:scale-95 ${c.checkboxChecked} text-white flex font-semibold hover:opacity-90 items-center p-2 rounded-full shadow-md transition-all`}
                      title="Add tasks"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {taskChildren.length === 0 ? (
                  <div className={`border-2 border-dashed ${c.sidebarBorder} py-12 rounded-2xl space-y-2 text-center ${c.mutedText}`}>
                    <FileText className="h-8 mx-auto opacity-30 w-8" />
                    <p className="font-medium text-xs">No checklist tasks yet</p>
                    <p className={`max-w-xs mx-auto text-[11px] ${c.mutedText}`}>
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
                            ? `${c.workgroupBg} ${c.sidebarBorder} opacity-75`
                            : `${c.cardBg} ${c.sidebarBorder} shadow-xs ${c.activityHover}`
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
                                ? `${c.checkboxChecked} text-white`
                                : `border-2 ${c.checkboxBorder}`
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
                                className={`${c.cardBg} ${c.text} border ${c.sidebarSelectedBorder} leading-relaxed outline-none overflow-hidden px-2 py-1 resize-none rounded text-xs w-full`}
                              />
                            ) : (
                              <p
                                onClick={() => {
                                  setEditingTaskId(child.id);
                                  setEditingTaskTitle(child.title);
                                }}
                                className={`text-xs font-normal leading-relaxed break-words cursor-pointer p-1 rounded transition-colors ${
                                  child.is_completed ? `line-through ${c.mutedText}` : c.text
                                }`}
                                title="Click to edit text"
                              >
                                {child.title}
                              </p>
                            )}
                            {child.description && (
                              <p className={`break-words leading-normal mt-1 text-[11px] ${c.mutedText}`}>{child.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-1.5 items-center pt-0.5 shrink-0">
                          {/* Reorder buttons */}
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveTask(child.id, 'up')}
                              disabled={taskChildren.indexOf(child) === 0}
                              className={`p-0.5 rounded transition-opacity ${c.mutedText} ${c.activityHover} disabled:opacity-30 disabled:cursor-not-allowed`}
                              title="Move up"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => moveTask(child.id, 'down')}
                              disabled={taskChildren.indexOf(child) === taskChildren.length - 1}
                              className={`p-0.5 rounded transition-opacity ${c.mutedText} ${c.activityHover} disabled:opacity-30 disabled:cursor-not-allowed`}
                              title="Move down"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>

                          <div className="flex items-center relative">
                            <button
                              type="button"
                              className={`flex gap-1 items-center p-1.5 rounded-lg ${c.mutedText} ${c.activityHover} transition-colors`}
                              title="Set or change plan date"
                            >
                              <Calendar className="h-4 w-4" />
                              {child.plan_date && (
                                <span className={`font-semibold text-[11px] ${c.statText}`}>
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
                            className="group-hover:opacity-100 hover:text-red-500 opacity-0 p-1 rounded text-gray-400 transition-opacity"
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

          {/* Modal Footer */}
          <div className={`${c.workgroupBg} border-t ${c.sidebarBorder} flex items-center justify-between px-6 py-4`}>
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
                className={`font-semibold px-4 py-2 rounded-lg ${c.mutedText} ${c.activityHover} text-xs transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={saveChanges}
                disabled={saving || !hasChanges}
                className={`${c.checkboxChecked} text-white disabled:opacity-50 flex font-semibold gap-1.5 hover:opacity-90 items-center px-4 py-2 rounded-lg shadow-sm text-xs transition-colors`}
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
          <div className={`${c.cardBg} ${c.text} border ${c.sidebarBorder} max-w-lg p-6 rounded-2xl shadow-2xl space-y-4 w-full`}>
            <div className={`border-b ${c.sidebarBorder} flex items-center justify-between pb-3`}>
              <h3 className={`font-bold text-base ${c.text}`}>Add Checklist Tasks</h3>
              <button
                onClick={() => setShowBulkModal(false)}
                className={`p-1 rounded-full ${c.mutedText} ${c.activityHover} transition-colors`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={`block font-semibold mb-1 ${c.text} text-xs`}>
                  Task List
                </label>
                <textarea
                  ref={bulkTextareaRef}
                  value={bulkTaskInput}
                  onChange={(e) => setBulkTaskInput(e.target.value)}
                  placeholder={"# Read Chapter 1 @2026-09-20\n# Write Summary\n# Solve Questions 1-5 @2026-09-22"}
                  className={`${c.cardBg} ${c.text} border ${c.sidebarBorder} font-mono outline-none p-3 resize-none rounded-xl text-xs w-full min-h-[150px]`}
                />
                <p className={`mt-1 text-[11px] ${c.mutedText} leading-relaxed`}>
                  Prefix lines with <code className={`${c.moduleHeader} px-1 py-0.5 rounded ${c.text}`}>#</code> for new items. Add <code className={`${c.moduleHeader} px-1 py-0.5 rounded ${c.text}`}>@YYYY-MM-DD</code> anywhere in a line to set a specific plan date.
                </p>
              </div>
            </div>

            <div className={`border-t ${c.sidebarBorder} flex gap-2 items-center justify-end pt-2`}>
              <button
                onClick={() => setShowBulkModal(false)}
                className={`font-semibold px-4 py-2 rounded-xl ${c.mutedText} ${c.activityHover} text-xs transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAddTasks}
                disabled={!bulkTaskInput.trim() || saving}
                className={`${c.checkboxChecked} text-white disabled:opacity-50 font-semibold hover:opacity-90 px-4 py-2 rounded-xl text-xs transition-colors`}
              >
                {saving ? 'Adding...' : 'Add Tasks'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Work Chunk Modal */}
      {editingChunk && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-lg ${c.text}`}>Edit Work Session</h3>
              <button
                onClick={handleCancelEditChunk}
                className={`p-1.5 rounded-full ${c.mutedText} ${c.activityHover} transition-colors`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={`block font-medium mb-1 ${c.statText} text-xs`}>Minutes Worked</label>
                <input
                  type="number"
                  value={editChunkMinutes}
                  onChange={(e) => setEditChunkMinutes(parseInt(e.target.value) || 0)}
                  className={`${c.cardBg} ${c.text} border ${c.sidebarBorder} w-full outline-none px-2.5 py-1.5 rounded-lg text-sm`}
                  min="0"
                />
              </div>

              <div>
                <label className={`block font-medium mb-1 ${c.statText} text-xs`}>Mood</label>
                <select
                  value={editChunkMood}
                  onChange={(e) => setEditChunkMood(e.target.value)}
                  className={`${c.cardBg} ${c.text} border ${c.sidebarBorder} w-full outline-none px-2.5 py-1.5 rounded-lg text-sm`}
                >
                  <option value="">None</option>
                  <option value="struggled">😫 Struggled</option>
                  <option value="okay">😐 Okay</option>
                  <option value="good">🙂 Good</option>
                  <option value="great">😊 Great</option>
                  <option value="focused">🎯 Focused</option>
                </select>
              </div>

              <div>
                <label className={`block font-medium mb-1 ${c.statText} text-xs`}>Notes</label>
                <textarea
                  value={editChunkNotes}
                  onChange={(e) => setEditChunkNotes(e.target.value)}
                  className={`${c.cardBg} ${c.text} border ${c.sidebarBorder} w-full outline-none px-2.5 py-1.5 rounded-lg text-sm`}
                  rows={3}
                  placeholder="Add notes about this work session..."
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelEditChunk}
                className={`${c.moduleHeader} ${c.text} px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveChunk}
                className={`${c.checkboxChecked} text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Work Session Modal */}
      {showAddWorkSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className={`${c.cardBg} border ${c.moduleBorder} rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-lg ${c.text}`}>Add Work Session</h3>
              <button
                onClick={() => setShowAddWorkSession(false)}
                className={`p-1.5 rounded-full ${c.mutedText} ${c.activityHover} transition-colors`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={`block font-medium mb-1 ${c.statText} text-xs`}>Minutes Worked</label>
                <input
                  type="number"
                  value={newSessionMinutes}
                  onChange={(e) => setNewSessionMinutes(parseInt(e.target.value) || 0)}
                  className={`${c.cardBg} ${c.text} border ${c.sidebarBorder} w-full outline-none px-2.5 py-1.5 rounded-lg text-sm`}
                  min="1"
                  placeholder="30"
                  autoFocus
                />
              </div>

              <div>
                <label className={`block font-medium mb-1 ${c.statText} text-xs`}>Mood (Optional)</label>
                <select
                  value={newSessionMood}
                  onChange={(e) => setNewSessionMood(e.target.value)}
                  className={`${c.cardBg} ${c.text} border ${c.sidebarBorder} w-full outline-none px-2.5 py-1.5 rounded-lg text-sm`}
                >
                  <option value="">None</option>
                  <option value="struggled">😫 Struggled</option>
                  <option value="okay">😐 Okay</option>
                  <option value="good">🙂 Good</option>
                  <option value="great">😊 Great</option>
                  <option value="focused">🎯 Focused</option>
                </select>
              </div>

              <div>
                <label className={`block font-medium mb-1 ${c.statText} text-xs`}>Notes (Optional)</label>
                <textarea
                  value={newSessionNotes}
                  onChange={(e) => setNewSessionNotes(e.target.value)}
                  className={`${c.cardBg} ${c.text} border ${c.sidebarBorder} w-full outline-none px-2.5 py-1.5 rounded-lg text-sm`}
                  rows={2}
                  placeholder="What did you work on?"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAddWorkSession(false)}
                className={`${c.moduleHeader} ${c.text} px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity`}
              >
                Cancel
              </button>
              <button
                onClick={handleAddWorkSession}
                className={`${c.checkboxChecked} text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity`}
              >
                Add Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}