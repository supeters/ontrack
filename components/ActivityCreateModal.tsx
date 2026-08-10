'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface ActivityCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  kidId: number;
  selectedDate: string; // YYYY-MM-DD format
  onSave: () => void;
}

export default function ActivityCreateModal({
  isOpen,
  onClose,
  kidId,
  selectedDate,
  onSave
}: ActivityCreateModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [courses, setCourses] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState<number | null>(null);
  const [activityType, setActivityType] = useState('task');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [planDate, setPlanDate] = useState(selectedDate);
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [isActionable, setIsActionable] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);

  // Recurring options
  const [recurDays, setRecurDays] = useState<number[]>([]); // Days of week
  const [respectHolidays, setRespectHolidays] = useState(true);

  const activityTypes = [
    'task',
    'todo',
    'assignment',
    'event',
    'class',
    'resource',
    'module',
    'workgroup'
  ];

  const daysOfWeek = [
    { num: 0, name: 'Sun' },
    { num: 1, name: 'Mon' },
    { num: 2, name: 'Tue' },
    { num: 3, name: 'Wed' },
    { num: 4, name: 'Thu' },
    { num: 5, name: 'Fri' },
    { num: 6, name: 'Sat' }
  ];

  const loadCourses = async () => {
    try {
      const response = await fetch(`/api/courses?kidId=${kidId}`);
      const data = await response.json();
      setCourses(data || []);
    } catch (error) {
      console.error('Error loading courses:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCourses();
    }
  }, [isOpen, kidId]);

  const toggleRecurDay = (dayNum: number) => {
    setRecurDays(prev =>
      prev.includes(dayNum)
        ? prev.filter(d => d !== dayNum)
        : [...prev, dayNum].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!title) {
      alert('Title is required');
      return;
    }

    try {
      if (isRecurring) {
        // Validate recurring fields
        if (recurDays.length === 0) {
          alert('Please select at least one day for recurring activities');
          return;
        }
        if (!endDate) {
          alert('End date is required for recurring activities');
          return;
        }

        // Use recurring endpoint
        const payload = {
          kidId,
          courseId,
          title,
          activityType,
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
          startDate: planDate,
          endDate: endDate,
          startTime: startTime || null,
          recurDays: recurDays.join(''),
          recurUntil: endDate,
          respectHolidays,
          isActionable,
        };

        const response = await fetch('/api/activities/recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();
          alert(`Successfully created ${result.count} recurring activities`);
          handleClose();
          onSave();
        } else {
          const error = await response.json();
          alert(`Failed to create recurring activity: ${error.error || 'Unknown error'}`);
        }
      } else {
        // Use regular endpoint for single activity
        const startTimeISO = startTime && planDate
          ? new Date(`${planDate}T${startTime}`).toISOString()
          : null;
        const endTimeISO = startTimeISO && estimatedMinutes
          ? new Date(new Date(startTimeISO).getTime() + parseInt(estimatedMinutes) * 60000).toISOString()
          : null;

        const payload = {
          kidId,
          courseId,
          title,
          activityType,
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
          planDate: planDate,
          startTime: startTimeISO,
          endTime: endTimeISO,
          isActionable,
        };

        const response = await fetch('/api/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          handleClose();
          onSave();
        } else {
          const error = await response.json();
          alert(`Failed to create activity: ${error.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error creating activity:', error);
      alert(`Failed to create activity: ${error}`);
    }
  };

  const handleClose = () => {
    setTitle('');
    setCourseId(null);
    setActivityType('task');
    setEstimatedMinutes('');
    setPlanDate(selectedDate);
    setEndDate('');
    setStartTime('');
    setIsActionable(true);
    setIsRecurring(false);
    setRecurDays([]);
    setRespectHolidays(true);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${c.cardBg} rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${c.divider}`}>
          <h2 className={`text-xl font-semibold ${c.moduleText}`}>Add Activity/Event</h2>
          <button
            onClick={handleClose}
            className={`p-1 ${c.activityHover.replace('border-transparent', '')} rounded transition-colors`}
          >
            <X className={`w-5 h-5 ${c.mutedText}`} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>
              Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
              placeholder="e.g., Math Homework, Team Meeting, Study Session"
            />
          </div>

          {/* Course */}
          <div>
            <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>
              Course (optional)
            </label>
            <select
              value={courseId || ''}
              onChange={(e) => setCourseId(e.target.value ? parseInt(e.target.value) : null)}
              className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
            >
              <option value="">None (General event)</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.course_name || course.name}
                </option>
              ))}
            </select>
            <p className={`text-xs ${c.mutedText} mt-1`}>
              Select a course to use its calendar for holiday checking
            </p>
          </div>

          {/* Activity Type */}
          <div>
            <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>
              Type
            </label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
            >
              {activityTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Actionable Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="actionable"
              checked={isActionable}
              onChange={(e) => setIsActionable(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="actionable" className={`text-sm font-medium ${c.moduleText}`}>
              Actionable (can be checked off)
            </label>
          </div>

          {/* Estimated Time */}
          <div>
            <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>
              Estimated Time (minutes)
            </label>
            <input
              type="number"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
              placeholder="e.g., 60"
            />
          </div>

          {/* Plan Date */}
          <div>
            <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>
              Plan Date {!isRecurring && '*'}
            </label>
            <input
              type="date"
              required={!isRecurring}
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
            />
            {!isRecurring && (
              <p className={`text-xs ${c.mutedText} mt-1`}>
                Date when this activity is planned
              </p>
            )}
          </div>

          {/* Start Time (optional) - only show for non-recurring */}
          {!isRecurring && (
            <div>
              <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>
                Start Time (optional)
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
              />
              <p className={`text-xs ${c.mutedText} mt-1`}>
                Schedule this activity at a specific time
              </p>
            </div>
          )}

          {/* Recurring Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="recurring"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="recurring" className={`text-sm font-medium ${c.moduleText}`}>
              Make this recurring
            </label>
          </div>

          {/* Recurring Options */}
          {isRecurring && (
            <div className={`p-4 border ${c.moduleBorder} rounded-lg space-y-3`}>
              <h3 className={`text-sm font-semibold ${c.moduleText}`}>Recurring Options</h3>

              {/* Days of Week */}
              <div>
                <label className={`block text-sm font-medium ${c.moduleText} mb-2`}>
                  Repeat on
                </label>
                <div className="flex gap-2">
                  {daysOfWeek.map((day) => (
                    <button
                      key={day.num}
                      type="button"
                      onClick={() => toggleRecurDay(day.num)}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        recurDays.includes(day.num)
                          ? `${c.checkboxChecked} text-white`
                          : `border ${c.moduleBorder} ${c.moduleText}`
                      }`}
                    >
                      {day.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* End Date */}
              <div>
                <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>
                  End Date *
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                />
                <p className={`text-xs ${c.mutedText} mt-1`}>
                  Last date to create recurring activities
                </p>
              </div>

              {/* Start Time (optional for recurring) */}
              <div>
                <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>
                  Start Time (optional)
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                />
                <p className={`text-xs ${c.mutedText} mt-1`}>
                  Schedule all recurring activities at this time
                </p>
              </div>

              {/* Respect Holidays */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="respectHolidays"
                  checked={respectHolidays}
                  onChange={(e) => setRespectHolidays(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="respectHolidays" className={`text-sm ${c.moduleText}`}>
                  Skip holidays from course calendar
                </label>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className={`px-6 py-2 ${c.checkboxChecked} text-white rounded-lg hover:opacity-90 transition-opacity`}
            >
              Create
            </button>
            <button
              type="button"
              onClick={handleClose}
              className={`px-6 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText} hover:opacity-80 transition-opacity`}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
