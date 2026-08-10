'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle, Calendar, Clock, Edit2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: any;
  onSave: (updates: any) => void;
  isLoading?: boolean;
  courses?: Array<{ id: number; name: string }>;
}

export default function ActivityModal({
  isOpen,
  onClose,
  activity,
  onSave,
  isLoading = false,
  courses = []
}: ActivityModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState<number | null>(null);
  const [activityType, setActivityType] = useState('task');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [actualMinutes, setActualMinutes] = useState('');
  const [completedAt, setCompletedAt] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [planDate, setPlanDate] = useState('');

  useEffect(() => {
    if (activity) {
      setTitle(activity.title || '');
      setCourseId(activity.course_id || null);
      setActivityType(activity.activity_type || 'task');
      setEstimatedMinutes(activity.estimated_minutes?.toString() || '');
      setActualMinutes(activity.actual_minutes?.toString() || activity.estimated_minutes?.toString() || '');
      setCompletedAt(activity.completed_at || activity.plan_date || new Date().toISOString().split('T')[0]);
      setIsCompleted(activity.is_completed || false);
      setPlanDate(activity.plan_date || new Date().toISOString().split('T')[0]);
      setEditMode(false);
    }
  }, [activity]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!activity) return;

    const minutes = parseInt(actualMinutes) || 0;
    const estMinutes = parseInt(estimatedMinutes) || 0;

    const updates: any = {
      is_completed: isCompleted,
      actual_minutes: minutes,
      completed_at: isCompleted ? completedAt : null,
      plan_date: planDate,
    };

    // If in edit mode, include editable fields
    if (editMode) {
      updates.title = title;
      updates.course_id = courseId;
      updates.activity_type = activityType;
      updates.estimated_minutes = estMinutes;
    }

    onSave({
      activityId: activity.id,
      updates,
    });
  };

  const handleClose = () => {
    setActualMinutes('');
    setCompletedAt('');
    setIsCompleted(false);
    setPlanDate('');
    onClose();
  };

  const formatTime = (minutes: number) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (!isOpen || !activity) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className={`${c.cardBg} max-w-md w-full mx-4 rounded-lg shadow-xl relative z-[10000]`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${c.divider}`}>
          <div className="flex items-center space-x-3">
            <div className={`${c.checkboxChecked} p-2 rounded-lg`}>
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${c.moduleText}`}>
                {editMode ? 'Edit Activity' : 'Task Details'}
              </h3>
              <p className={`text-sm ${c.mutedText}`}>
                {editMode ? 'Update activity details' : 'Mark complete and log time'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditMode(!editMode)}
              className={`${c.mutedText} hover:opacity-70 transition-colors`}
            >
              <Edit2 className="h-5 w-5" />
            </button>
            <button
              onClick={handleClose}
              className={`${c.mutedText} hover:opacity-70 transition-colors`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {editMode ? (
            /* Edit Mode Fields */
            <div className="space-y-4 mb-6">
              <div>
                <label className={`block text-sm font-medium ${c.moduleText} mb-2`}>
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.moduleText}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${c.moduleText} mb-2`}>
                  Course
                </label>
                <select
                  value={courseId || ''}
                  onChange={(e) => setCourseId(e.target.value ? parseInt(e.target.value) : null)}
                  className={`w-full px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.moduleText}`}
                >
                  <option value="">No course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${c.moduleText} mb-2`}>
                  Type
                </label>
                <div className="flex gap-2">
                  {['task', 'event', 'class'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setActivityType(type)}
                      className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                        activityType === type
                          ? `${c.checkboxChecked} text-white`
                          : `border ${c.moduleBorder} ${c.moduleText}`
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${c.moduleText} mb-2`}>
                  Estimated Time (minutes)
                </label>
                <input
                  type="number"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  className={`w-full px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.moduleText}`}
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
          ) : (
            /* Task Info */
            <div className="mb-6">
              <div className={`${c.moduleHeader} p-4 rounded-lg`}>
                <h4 className={`font-medium mb-2 ${c.moduleText}`}>{activity.title}</h4>
                <div className={`space-y-1 text-sm ${c.mutedText}`}>
                  {activity.course_name && (
                    <div>Course: {activity.course_name}</div>
                  )}
                  {activity.estimated_minutes && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Estimated: {formatTime(activity.estimated_minutes)}
                    </div>
                  )}
                  {activity.plan_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Planned: {new Date(activity.plan_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Plan Date */}
          <div className="mb-4">
            <label className={`block text-sm font-medium ${c.moduleText} mb-2`}>
              Plan Date
            </label>
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              className={`w-full px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.moduleText}`}
            />
          </div>

          {/* Completion Toggle */}
          <div className="mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={(e) => setIsCompleted(e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <span className={`font-medium ${c.moduleText}`}>Mark as completed</span>
            </label>
          </div>

          {/* Actual Minutes */}
          <div className="mb-4">
            <label className={`block text-sm font-medium ${c.moduleText} mb-2`}>
              Actual Time Spent (minutes)
            </label>
            <input
              type="number"
              value={actualMinutes}
              onChange={(e) => setActualMinutes(e.target.value)}
              className={`w-full px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.moduleText}`}
              placeholder="0"
              min="0"
            />
          </div>

          {/* Completed At Date */}
          {isCompleted && (
            <div className="mb-6">
              <label className={`block text-sm font-medium ${c.moduleText} mb-2`}>
                Completion Date
              </label>
              <input
                type="date"
                value={completedAt}
                onChange={(e) => setCompletedAt(e.target.value)}
                className={`w-full px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.moduleText}`}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className={`flex-1 px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText} hover:bg-opacity-10 transition-colors`}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2 ${c.checkboxChecked} text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50`}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
