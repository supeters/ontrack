'use client';

import { useState, useEffect } from 'react';
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
  BookOpen
} from 'lucide-react';
import { formatDateLocal } from '@/lib/datetime';

interface Course {
  id: number;
  title: string;
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
}

interface ActivityDetailModalProps {
  activity: Activity;
  courses?: Course[];
  onClose: () => void;
  onUpdate?: () => void;
}

export default function ActivityDetailModal({
  activity,
  courses = [],
  onClose,
  onUpdate,
}: ActivityDetailModalProps) {
  const [editedActivity, setEditedActivity] = useState(activity);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'tasks'>('details');
  const [hasSelectedText, setHasSelectedText] = useState(false);
  const [showCreateTaskForm, setShowCreateTaskForm] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    title: '',
    description: '',
    planDate: activity.plan_date || '',
    estimatedMinutes: 15,
  });
  const [children, setChildren] = useState<Activity[]>([]);
  const [isActionable, setIsActionable] = useState((activity as any).is_action || false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isCompleted, setIsCompleted] = useState(activity.is_completed || false);
  const [actualMinutes, setActualMinutes] = useState(activity.actual_minutes || activity.estimated_minutes || 0);
  const [completedAt, setCompletedAt] = useState(activity.completed_at || activity.plan_date || '');

  useEffect(() => {
    setIsActionable((activity as any).is_action || false);
    setEditedActivity(activity);
    setIsCompleted(activity.is_completed || false);
    setActualMinutes(activity.actual_minutes || activity.estimated_minutes || 0);
    setCompletedAt(activity.completed_at || activity.plan_date || '');
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

  const saveChanges = async () => {
    setSaving(true);
    try {
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          updates: {
            description: editedActivity.description,
            course_id: editedActivity.course_id,
            plan_date: editedActivity.plan_date,
            estimated_minutes: editedActivity.estimated_minutes,
            actual_minutes: actualMinutes,
            is_completed: isCompleted,
            completed_at: isCompleted ? (completedAt || formatDateLocal(new Date())) : null,
            is_action_override: isActionable,
          },
        }),
      });

      setHasChanges(false);
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setSaving(false);
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
        // Refresh sub-tasks if child was deleted
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
    const nextCompletedAt = nextCompleted
      ? completedAt || editedActivity.plan_date || formatDateLocal(new Date())
      : '';

    setIsCompleted(nextCompleted);
    setCompletedAt(nextCompletedAt);
    setHasChanges(true);
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

      {/* Side Drawer Panel */}
      <div className="fixed flex inset-y-0 max-w-full pl-10 right-0">
        <div className="bg-white border-gray-200 border-l duration-300 ease-in-out flex flex-col max-w-xl shadow-2xl slide-in-from-right transform transition-transform w-screen">
          
          {/* Header */}
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
                    className="bg-blue-600 flex font-semibold gap-1.5 hover:bg-blue-700 items-center px-3 py-1.5 rounded-lg text-white text-xs transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    LMS Page
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

          {/* Navigation Tabs & Quick Status Toggle */}
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
                Sub-tasks
                {children.length > 0 && (
                  <span className="bg-gray-100 font-bold px-2 py-0.5 rounded-full text-gray-700 text-xs">
                    {children.length}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={toggleCompletionNow}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isCompleted
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isCompleted ? 'Completed' : 'Mark Complete'}
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {activeTab === 'details' && (
              <>
                {/* Course Selection Dropdown */}
                {courses.length > 0 && (
                  <div className="bg-gray-50/70 border border-gray-100 p-3 rounded-xl space-y-1">
                    <label className="flex font-semibold gap-1.5 items-center text-gray-600 text-xs">
                      <BookOpen className="h-3.5 text-blue-600 w-3.5" />
                      Associated Course
                    </label>
                    <select
                      value={editedActivity.course_id || ''}
                      onChange={(e) => handleFieldChange('course_id', Number(e.target.value) || null)}
                      className="bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500 font-medium outline-none px-3 py-1.5 rounded-lg text-gray-800 text-xs w-full"
                    >
                      <option value="">Unassigned Course</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Planning & Actuals Side-by-Side */}
                <div className="gap-3 grid grid-cols-2">
                  {/* Planning Card */}
                  <div className="bg-gray-50/50 border border-gray-100 p-3.5 rounded-xl space-y-2.5">
                    <div className="flex font-bold gap-1.5 items-center text-[11px] text-gray-400 tracking-wider uppercase">
                      <Calendar className="h-3.5 text-blue-500 w-3.5" />
                      Plan
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-gray-600 text-xs">Plan Date</label>
                      <input
                        type="date"
                        value={editedActivity.plan_date || ''}
                        onChange={(e) => handleFieldChange('plan_date', e.target.value)}
                        className="bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none px-2.5 py-1.5 rounded-lg text-xs w-full"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-gray-600 text-xs">Est. Mins</label>
                      <input
                        type="number"
                        value={editedActivity.estimated_minutes || ''}
                        onChange={(e) => handleFieldChange('estimated_minutes', parseInt(e.target.value) || 0)}
                        className="bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none px-2.5 py-1.5 rounded-lg text-xs w-full"
                      />
                    </div>
                  </div>

                  {/* Actuals Card */}
                  <div className={`p-3.5 rounded-xl border space-y-2.5 transition-colors ${
                    isCompleted ? 'bg-emerald-50/30 border-emerald-100' : 'bg-gray-50/50 border-gray-100'
                  }`}>
                    <div className="flex font-bold gap-1.5 items-center text-[11px] text-gray-400 tracking-wider uppercase">
                      <Clock className="h-3.5 text-emerald-500 w-3.5" />
                      Actuals
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-gray-600 text-xs">Completed On</label>
                      <input
                        type="date"
                        value={completedAt}
                        disabled={!isCompleted}
                        onChange={(e) => {
                          setCompletedAt(e.target.value);
                          setHasChanges(true);
                        }}
                        className="bg-white border border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none px-2.5 py-1.5 rounded-lg text-xs w-full"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-gray-600 text-xs">Actual Mins</label>
                      <input
                        type="number"
                        value={actualMinutes}
                        onChange={(e) => {
                          setActualMinutes(parseInt(e.target.value) || 0);
                          setHasChanges(true);
                        }}
                        className="bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none px-2.5 py-1.5 rounded-lg text-xs w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Description Header & Task Splitter Action */}
                <div className="space-y-2">
                  <div className="bg-white flex items-center justify-between py-1 sticky top-0 z-10">
                    <label className="font-bold text-[11px] text-gray-400 tracking-wider uppercase">
                      Description
                    </label>
                    {activity.description && (
                      <button
                        onClick={() => {
                          const selectedText = window.getSelection()?.toString().trim();
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
                        {hasSelectedText ? 'Split Highlighted Text' : 'Split into Task'}
                      </button>
                    )}
                  </div>

                  {/* Inline Task Splitter Form with Date & Time Planning */}
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
                            const selectedText = window.getSelection()?.toString().trim();
                            setHasSelectedText(Boolean(selectedText));
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

            {activeTab === 'tasks' && (
              <div className="space-y-3">
                {children.length === 0 ? (
                  <div className="py-16 space-y-2 text-center text-gray-400">
                    <FileText className="h-8 mx-auto opacity-30 w-8" />
                    <p className="font-medium text-sm">No sub-tasks yet</p>
                    <p className="max-w-xs mx-auto text-gray-400 text-xs">
                      Highlight text inside the overview tab and click "Split" to create actionable tasks.
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
                                updates: { is_completed: !child.is_completed },
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

          {/* Footer Controls */}
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