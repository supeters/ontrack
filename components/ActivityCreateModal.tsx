'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { createLocalTimestamp, formatTimestampLocal } from '@/lib/datetime';

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

  // Form State
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
  const [recurDays, setRecurDays] = useState<number[]>([]);
  const [respectHolidays, setRespectHolidays] = useState(true);

  // Natural Language Magic Quick-Add State
  const [nlInput, setNlInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);

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
      setPlanDate(selectedDate);
    }
  }, [isOpen, kidId, selectedDate]);

  const toggleRecurDay = (dayNum: number) => {
    setRecurDays(prev =>
      prev.includes(dayNum)
        ? prev.filter(d => d !== dayNum)
        : [...prev, dayNum].sort()
    );
  };

  // Magic Quick-Add Handler
  const handleParseNL = async () => {
    if (!nlInput.trim()) return;
    setIsParsing(true);

    try {
      const response = await fetch('/api/activities/parse-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: nlInput,
          availableCourses: courses,
          referenceDate: selectedDate
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse input intent');
      }

      const parsed = await response.json();

      // Auto-populate form fields from parsed output
      if (parsed.title) setTitle(parsed.title);
      if (parsed.courseId !== undefined) setCourseId(parsed.courseId);
      if (parsed.activityType) setActivityType(parsed.activityType);
      if (parsed.estimatedMinutes !== undefined && parsed.estimatedMinutes !== null) {
        setEstimatedMinutes(parsed.estimatedMinutes.toString());
      }
      if (parsed.planDate) setPlanDate(parsed.planDate);
      if (parsed.startTime) setStartTime(parsed.startTime);
      if (parsed.isActionable !== undefined) setIsActionable(parsed.isActionable);

      // Map recurring properties if extracted
      if (parsed.isRecurring) {
        setIsRecurring(true);
        if (Array.isArray(parsed.recurDays)) setRecurDays(parsed.recurDays);
        if (parsed.endDate) setEndDate(parsed.endDate);
      }
    } catch (error) {
      console.error('Error parsing natural language input:', error);
      alert('Could not auto-fill form from input. Please fill details manually.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!title) {
      alert('Title is required');
      return;
    }

    try {
      if (isRecurring) {
        if (recurDays.length === 0) {
          alert('Please select at least one day for recurring activities');
          return;
        }
        if (!endDate) {
          alert('End date is required for recurring activities');
          return;
        }

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
        const startTimeLocal = startTime && planDate
          ? createLocalTimestamp(planDate, startTime)
          : null;
        const endTimeLocal = startTimeLocal && estimatedMinutes
          ? formatTimestampLocal(new Date(new Date(`${planDate}T${startTime}`).getTime() + parseInt(estimatedMinutes) * 60000))
          : null;

        const payload = {
          kidId,
          courseId,
          title,
          activityType,
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
          planDate: planDate,
          startTime: startTimeLocal,
          endTime: endTimeLocal,
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
    setNlInput('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="bg-black bg-opacity-50 fixed flex inset-0 items-center justify-center p-4 z-50">
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

        {/* Form Container */}
        <div className="p-6 space-y-6">
          {/* Magic Quick-Add Assistant Input */}
          <div className={`p-4 rounded-xl border ${c.moduleBorder} bg-indigo-500/10 space-y-2`}>
            <div className="flex gap-1.5 items-center">
              <Sparkles className="h-4 text-indigo-400 w-4" />
              <label className={`text-xs font-bold ${c.moduleText} uppercase tracking-wider`}>
                Magic Quick Add
              </label>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={nlInput}
                onChange={(e) => setNlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleParseNL();
                  }
                }}
                placeholder="e.g. Read Latin Ch 4 for 20 mins every Tue/Thu until May"
                className={`flex-1 px-3 py-2 text-sm border ${c.moduleBorder} rounded-lg ${c.moduleText} bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              />
              <button
                type="button"
                onClick={handleParseNL}
                disabled={isParsing || !nlInput.trim()}
                className="bg-indigo-600 disabled:opacity-50 flex font-medium gap-2 hover:bg-indigo-700 items-center px-4 py-2 rounded-lg text-sm text-white transition-colors"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" />
                    Parsing...
                  </>
                ) : (
                  'Auto-Fill'
                )}
              </button>
            </div>
            <p className={`text-xs ${c.mutedText}`}>
              Type in natural English and hit Auto-Fill to populate the form below automatically.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="flex gap-2 items-center">
              <input
                type="checkbox"
                id="actionable"
                checked={isActionable}
                onChange={(e) => setIsActionable(e.target.checked)}
                className="h-4 w-4"
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
            <div className="flex gap-2 items-center">
              <input
                type="checkbox"
                id="recurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-4 w-4"
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
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    id="respectHolidays"
                    checked={respectHolidays}
                    onChange={(e) => setRespectHolidays(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <label htmlFor="respectHolidays" className={`text-sm ${c.moduleText}`}>
                    Skip holidays from course calendar
                  </label>
                </div>
              </div>
            )}

            {/* Form Buttons */}
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
    </div>
  );
}