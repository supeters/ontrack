'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Save, Trash2, ExternalLink } from 'lucide-react';
import { formatTime12Hour } from '@/lib/datetime';

interface Activity {
  id: number;
  title: string;
  description?: string;
  plan_date?: string;
  estimated_minutes?: number;
  actual_minutes?: number;
  start_time?: string;
  end_time?: string;
  is_completed: boolean;
  activity_type: string;
  resource_url?: string;
  lms_url?: string;
}

interface ActivityDetailModalProps {
  activity: Activity;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function ActivityDetailModal({
  activity,
  onClose,
  onUpdate,
}: ActivityDetailModalProps) {
  const [editMode, setEditMode] = useState(false);
  const [editedActivity, setEditedActivity] = useState(activity);
  const [saving, setSaving] = useState(false);

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
            plan_date: editedActivity.plan_date,
            estimated_minutes: editedActivity.estimated_minutes,
          },
        }),
      });

      setEditMode(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const deleteActivity = async () => {
    if (!confirm('Delete this activity?')) return;

    try {
      await fetch(`/api/activities?id=${activity.id}`, {
        method: 'DELETE',
      });
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete activity');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">{activity.title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Activity Type Badge */}
          <div className="mb-4">
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
              {activity.activity_type}
            </span>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {editMode ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Plan Date
                </label>
                <input
                  type="date"
                  value={editedActivity.plan_date || ''}
                  onChange={(e) =>
                    setEditedActivity({ ...editedActivity, plan_date: e.target.value })
                  }
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            ) : (
              activity.plan_date && (
                <div>
                  <div className="text-sm text-gray-600">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Plan Date
                  </div>
                  <div className="font-medium">
                    {new Date(activity.plan_date + 'T00:00:00').toLocaleDateString()}
                  </div>
                </div>
              )
            )}

            {activity.start_time && (
              <div>
                <div className="text-sm text-gray-600">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Time
                </div>
                <div className="font-medium">
                  {formatTime12Hour(activity.start_time)}
                  {activity.end_time && ` - ${formatTime12Hour(activity.end_time)}`}
                </div>
              </div>
            )}
          </div>

          {/* Estimated vs Actual Minutes */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {editMode ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Minutes
                </label>
                <input
                  type="number"
                  value={editedActivity.estimated_minutes || ''}
                  onChange={(e) =>
                    setEditedActivity({
                      ...editedActivity,
                      estimated_minutes: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            ) : (
              activity.estimated_minutes && (
                <div>
                  <div className="text-sm text-gray-600">Estimated</div>
                  <div className="font-medium">{activity.estimated_minutes} min</div>
                </div>
              )
            )}

            {activity.actual_minutes && (
              <div>
                <div className="text-sm text-gray-600">Actual</div>
                <div className="font-medium text-green-600">
                  {activity.actual_minutes} min
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            {editMode ? (
              <textarea
                value={editedActivity.description || ''}
                onChange={(e) =>
                  setEditedActivity({ ...editedActivity, description: e.target.value })
                }
                rows={4}
                className="w-full border rounded px-3 py-2"
                placeholder="Add description..."
              />
            ) : (
              <div className="text-gray-700 whitespace-pre-wrap">
                {activity.description || <em className="text-gray-400">No description</em>}
              </div>
            )}
          </div>

          {/* Links */}
          {(activity.resource_url || activity.lms_url) && (
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Links</div>
              {activity.resource_url && (
                <a
                  href={activity.resource_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  Resource
                </a>
              )}
              {activity.lms_url && (
                <a
                  href={activity.lms_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="w-4 h-4" />
                  LMS Assignment
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <button
            onClick={deleteActivity}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>

          <div className="flex gap-2">
            {editMode ? (
              <>
                <button
                  onClick={() => {
                    setEditMode(false);
                    setEditedActivity(activity);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveChanges}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
