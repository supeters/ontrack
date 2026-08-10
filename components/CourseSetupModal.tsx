'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface CourseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  kidId: number;
  onSave: () => void;
  existingCourse?: any;
}

export default function CourseSetupModal({
  isOpen,
  onClose,
  kidId,
  onSave,
  existingCourse
}: CourseSetupModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [courseName, setCourseName] = useState('');
  const [subject, setSubject] = useState('');
  const [teacher, setTeacher] = useState('');
  const [courseWebpage, setCourseWebpage] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [courseCode, setCourseCode] = useState('');

  // Work schedule - which days to work on this course
  const [workDays, setWorkDays] = useState<number[]>([]);

  // Class schedule - which days has class meetings
  const [classDays, setClassDays] = useState<number[]>([]);

  // Calendar selection
  const [calendars, setCalendars] = useState<any[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<number | null>(null);
  const [showNewCalendarForm, setShowNewCalendarForm] = useState(false);

  // New calendar fields
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newYearName, setNewYearName] = useState('');
  const [newTermName, setNewTermName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');

  const daysOfWeek = [
    { num: 0, name: 'Sun' },
    { num: 1, name: 'Mon' },
    { num: 2, name: 'Tue' },
    { num: 3, name: 'Wed' },
    { num: 4, name: 'Thu' },
    { num: 5, name: 'Fri' },
    { num: 6, name: 'Sat' }
  ];

  useEffect(() => {
    if (isOpen) {
      loadCalendars();
      if (existingCourse) {
        setCourseName(existingCourse.course_name || '');
        setSubject(existingCourse.subject || '');
        setTeacher(existingCourse.teacher || '');
        setCourseWebpage(existingCourse.course_webpage || '');
        setMeetingLink(existingCourse.meeting_link || '');
        setCourseCode(existingCourse.course_code || '');
        setSelectedCalendarId(existingCourse.calendar_id || null);

        // Parse work_days string "135" -> [1,3,5]
        if (existingCourse.work_days) {
          const days = existingCourse.work_days.split('').map((d: string) => parseInt(d));
          setWorkDays(days);
        }

        // Parse class_days
        if (existingCourse.class_days) {
          const days = existingCourse.class_days.split('').map((d: string) => parseInt(d));
          setClassDays(days);
        }
      }
    }
  }, [isOpen, existingCourse]);

  const loadCalendars = async () => {
    try {
      const response = await fetch('/api/calendars');
      const data = await response.json();
      setCalendars(data || []); // API returns array directly, not wrapped
    } catch (error) {
      console.error('Error loading calendars:', error);
    }
  };

  const toggleWorkDay = (dayNum: number) => {
    setWorkDays(prev =>
      prev.includes(dayNum)
        ? prev.filter(d => d !== dayNum)
        : [...prev, dayNum].sort()
    );
  };

  const toggleClassDay = (dayNum: number) => {
    setClassDays(prev =>
      prev.includes(dayNum)
        ? prev.filter(d => d !== dayNum)
        : [...prev, dayNum].sort()
    );
  };

  const handleCreateCalendar = async () => {
    if (!newSchoolName || !newYearName || !newStartDate || !newEndDate) {
      alert('Please fill in school name, year, start date, and end date');
      return;
    }

    try {
      const response = await fetch('/api/calendars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_name: newSchoolName,
          school_year_name: newYearName,
          term_name: newTermName || null,
          start_date: newStartDate,
          end_date: newEndDate,
        }),
      });

      const data = await response.json();
      if (data.calendar) {
        setSelectedCalendarId(data.calendar.id);
        await loadCalendars();
        setShowNewCalendarForm(false);
        // Reset form
        setNewSchoolName('');
        setNewYearName('');
        setNewTermName('');
        setNewStartDate('');
        setNewEndDate('');
      }
    } catch (error) {
      console.error('Error creating calendar:', error);
      alert('Failed to create calendar');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!courseName) {
      alert('Course name is required');
      return;
    }

    try {
      const courseData = {
        courseId: existingCourse?.id,
        kidId: kidId,
        courseName: courseName,
        subject: subject || null,
        teacher: teacher || null,
        courseWebpage: courseWebpage || null,
        meetingLink: meetingLink || null,
        courseCode: courseCode || null,
        calendarId: selectedCalendarId,
        workDays: workDays.length > 0 ? workDays.join('') : null,
        classDays: classDays.length > 0 ? classDays.join('') : null,
        isActive: true,
      };

      const url = existingCourse
        ? `/api/courses/${existingCourse.id}`
        : '/api/courses';

      const method = existingCourse ? 'PUT' : 'POST';

      console.log('Sending course data:', courseData);

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courseData),
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Course created successfully:', result);
        onSave();
        handleClose();
      } else {
        const error = await response.json();
        console.error('Server error:', error);
        alert(`Failed to save course: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving course:', error);
      alert(`Failed to save course: ${error}`);
    }
  };

  const handleClose = () => {
    setCourseName('');
    setSubject('');
    setTeacher('');
    setCourseWebpage('');
    setMeetingLink('');
    setCourseCode('');
    setWorkDays([]);
    setClassDays([]);
    setSelectedCalendarId(null);
    setShowNewCalendarForm(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className={`${c.cardBg} max-w-2xl w-full rounded-lg shadow-xl relative z-[10000] max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${c.divider} sticky top-0 ${c.cardBg} z-10`}>
          <h3 className={`font-semibold text-lg ${c.moduleText}`}>
            {existingCourse ? 'Edit Course' : 'Add New Course'}
          </h3>
          <button
            onClick={handleClose}
            className={`${c.mutedText} hover:opacity-70 transition-colors`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h4 className={`font-medium ${c.moduleText} mb-3`}>Course Information</h4>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${c.moduleText} mb-2`}>
                  Course Name *
                </label>
                <input
                  type="text"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className={`w-full px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.moduleText}`}
                  placeholder="e.g., Algebra 2, Physics 1"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${c.moduleText} mb-2`}>
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className={`w-full px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.moduleText}`}
                    placeholder="Math, Science, English..."
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${c.moduleText} mb-2`}>
                    Course Code
                  </label>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    className={`w-full px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.moduleText}`}
                    placeholder="MAT-201"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${c.moduleText} mb-2`}>
                  Teacher
                </label>
                <input
                  type="text"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  className={`w-full px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.moduleText}`}
                  placeholder="Teacher name"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${c.moduleText} mb-2`}>
                  Course Webpage
                </label>
                <input
                  type="url"
                  value={courseWebpage}
                  onChange={(e) => setCourseWebpage(e.target.value)}
                  className={`w-full px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.moduleText}`}
                  placeholder="https://canvas.school.edu/courses/123"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${c.moduleText} mb-2`}>
                  Meeting Link (Zoom, Teams, etc.)
                </label>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  className={`w-full px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.moduleText}`}
                  placeholder="https://zoom.us/j/..."
                />
              </div>
            </div>
          </div>

          {/* Calendar Selection */}
          <div>
            <h4 className={`font-medium ${c.moduleText} mb-3 flex items-center gap-2`}>
              <CalendarIcon className="w-4 h-4" />
              School Calendar
            </h4>

            {!showNewCalendarForm ? (
              <div className="space-y-3">
                <select
                  value={selectedCalendarId || ''}
                  onChange={(e) => setSelectedCalendarId(e.target.value ? parseInt(e.target.value) : null)}
                  className={`w-full px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.cardBg} ${c.moduleText}`}
                >
                  <option value="">No calendar (optional)</option>
                  {calendars.map(cal => (
                    <option key={cal.id} value={cal.id}>
                      {cal.school_name} - {cal.school_year_name} {cal.term_name ? `(${cal.term_name})` : ''}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setShowNewCalendarForm(true)}
                  className={`flex items-center gap-2 text-sm ${c.statText} hover:opacity-80`}
                >
                  <Plus className="w-4 h-4" />
                  Create New School Calendar
                </button>
              </div>
            ) : (
              <div className={`border ${c.moduleBorder} rounded-lg p-4 space-y-3`}>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    placeholder="School Name *"
                    className={`px-3 py-2 border ${c.moduleBorder} rounded ${c.cardBg} ${c.moduleText} text-sm`}
                  />
                  <input
                    type="text"
                    value={newYearName}
                    onChange={(e) => setNewYearName(e.target.value)}
                    placeholder="Year (e.g., 2024-2025) *"
                    className={`px-3 py-2 border ${c.moduleBorder} rounded ${c.cardBg} ${c.moduleText} text-sm`}
                  />
                </div>
                <input
                  type="text"
                  value={newTermName}
                  onChange={(e) => setNewTermName(e.target.value)}
                  placeholder="Term (e.g., Fall, Spring) - Optional"
                  className={`w-full px-3 py-2 border ${c.moduleBorder} rounded ${c.cardBg} ${c.moduleText} text-sm`}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs ${c.mutedText} mb-1`}>Start Date *</label>
                    <input
                      type="date"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                      className={`w-full px-3 py-2 border ${c.moduleBorder} rounded ${c.cardBg} ${c.moduleText} text-sm`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs ${c.mutedText} mb-1`}>End Date *</label>
                    <input
                      type="date"
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                      className={`w-full px-3 py-2 border ${c.moduleBorder} rounded ${c.cardBg} ${c.moduleText} text-sm`}
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCreateCalendar}
                    className={`flex-1 px-3 py-2 ${c.checkboxChecked} text-white rounded text-sm hover:opacity-90`}
                  >
                    Create Calendar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewCalendarForm(false)}
                    className={`px-3 py-2 border ${c.moduleBorder} rounded text-sm ${c.activityText}`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Work Schedule */}
          <div>
            <h4 className={`font-medium ${c.moduleText} mb-3`}>Work Schedule</h4>
            <p className={`text-sm ${c.mutedText} mb-3`}>
              Which days should you work on this course?
            </p>
            <div className="flex gap-2">
              {daysOfWeek.map(day => (
                <button
                  key={day.num}
                  type="button"
                  onClick={() => toggleWorkDay(day.num)}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    workDays.includes(day.num)
                      ? `${c.checkboxChecked} text-white`
                      : `border ${c.moduleBorder} ${c.activityText}`
                  }`}
                >
                  {day.name}
                </button>
              ))}
            </div>
          </div>

          {/* Class Schedule */}
          <div>
            <h4 className={`font-medium ${c.moduleText} mb-3`}>Class Meeting Days</h4>
            <p className={`text-sm ${c.mutedText} mb-3`}>
              Which days does this course have class meetings?
            </p>
            <div className="flex gap-2">
              {daysOfWeek.map(day => (
                <button
                  key={day.num}
                  type="button"
                  onClick={() => toggleClassDay(day.num)}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    classDays.includes(day.num)
                      ? `${c.checkboxChecked} text-white`
                      : `border ${c.moduleBorder} ${c.activityText}`
                  }`}
                >
                  {day.name}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className={`flex-1 px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText} hover:bg-opacity-10 transition-colors`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2 ${c.checkboxChecked} text-white rounded-lg hover:opacity-90 transition-opacity`}
            >
              {existingCourse ? 'Update Course' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
