'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { School, Calendar as CalendarIcon, Plane, Plus, Edit2, Trash2 } from 'lucide-react';

interface School {
  id: number;
  name: string;
  district?: string;
  address?: string;
  phone?: string;
  website?: string;
}

interface Calendar {
  id: number;
  school_id: number;
  school_name: string;
  school_year_name: string;
  term_name: string;
  start_date: string;
  end_date: string;
}

interface Holiday {
  id: number;
  calendar_id: number;
  start_date: string;
  end_date?: string;
  name: string;
  description?: string;
}

export default function SettingsView() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [activeTab, setActiveTab] = useState<'schools' | 'calendars' | 'holidays'>('schools');
  const [schools, setSchools] = useState<School[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);

  // School form
  const [showSchoolForm, setShowSchoolForm] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [schoolDistrict, setSchoolDistrict] = useState('');

  // Calendar form
  const [showCalendarForm, setShowCalendarForm] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<Calendar | null>(null);
  const [calSchoolName, setCalSchoolName] = useState('');
  const [calYearName, setCalYearName] = useState('');
  const [calTermName, setCalTermName] = useState('');
  const [calStartDate, setCalStartDate] = useState('');
  const [calEndDate, setCalEndDate] = useState('');

  // Holiday form
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<number | null>(null);
  const [holidayStartDate, setHolidayStartDate] = useState('');
  const [holidayEndDate, setHolidayEndDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayDescription, setHolidayDescription] = useState('');

  useEffect(() => {
    if (activeTab === 'schools') loadSchools();
    else if (activeTab === 'calendars') {
      loadSchools(); // Load schools for dropdown
      loadCalendars();
    }
    else if (activeTab === 'holidays') {
      loadCalendars();
      loadHolidays();
    }
  }, [activeTab]);

  const loadSchools = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/schools');
      const data = await res.json();
      setSchools(data || []);
    } catch (error) {
      console.error('Error loading schools:', error);
    }
    setLoading(false);
  };

  const loadCalendars = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/calendars');
      const data = await res.json();
      setCalendars(data || []);
    } catch (error) {
      console.error('Error loading calendars:', error);
    }
    setLoading(false);
  };

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/holidays');
      const data = await res.json();
      setHolidays(data || []);
    } catch (error) {
      console.error('Error loading holidays:', error);
    }
    setLoading(false);
  };

  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: editingSchool?.id,
          name: schoolName,
          district: schoolDistrict || null,
        }),
      });
      setShowSchoolForm(false);
      setEditingSchool(null);
      setSchoolName('');
      setSchoolDistrict('');
      loadSchools();
    } catch (error) {
      console.error('Error saving school:', error);
    }
  };

  const handleSaveCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/calendars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: calSchoolName,
          schoolYearName: calYearName,
          termName: calTermName || 'Full Year',
          startDate: calStartDate,
          endDate: calEndDate,
        }),
      });
      setShowCalendarForm(false);
      setEditingCalendar(null);
      setCalSchoolName('');
      setCalYearName('');
      setCalTermName('');
      setCalStartDate('');
      setCalEndDate('');
      loadCalendars();
    } catch (error) {
      console.error('Error saving calendar:', error);
    }
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCalendarId) return;

    try {
      await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holidayId: editingHoliday?.id,
          calendarId: selectedCalendarId,
          startDate: holidayStartDate,
          endDate: holidayEndDate || holidayStartDate, // Default to same day if no end date
          name: holidayName,
          description: holidayDescription || null,
        }),
      });
      setShowHolidayForm(false);
      setEditingHoliday(null);
      setSelectedCalendarId(null);
      setHolidayStartDate('');
      setHolidayEndDate('');
      setHolidayName('');
      setHolidayDescription('');
      loadHolidays();
    } catch (error) {
      console.error('Error saving holiday:', error);
    }
  };

  const deleteSchool = async (id: number) => {
    if (!confirm('Delete this school?')) return;
    try {
      await fetch(`/api/schools?id=${id}`, { method: 'DELETE' });
      loadSchools();
    } catch (error) {
      console.error('Error deleting school:', error);
    }
  };

  const deleteCalendar = async (id: number) => {
    if (!confirm('Delete this calendar?')) return;
    try {
      await fetch(`/api/calendars?id=${id}`, { method: 'DELETE' });
      loadCalendars();
    } catch (error) {
      console.error('Error deleting calendar:', error);
    }
  };

  const deleteHoliday = async (id: number) => {
    if (!confirm('Delete this holiday?')) return;
    try {
      await fetch(`/api/holidays?id=${id}`, { method: 'DELETE' });
      loadHolidays();
    } catch (error) {
      console.error('Error deleting holiday:', error);
    }
  };

  return (
    <div className={`h-full flex flex-col ${c.bg}`}>
      {/* Header */}
      <div className={`${c.cardBg} border-b ${c.divider} px-6 py-4`}>
        <h1 className={`text-2xl font-semibold ${c.moduleText}`}>Settings</h1>
        <p className={`text-sm ${c.mutedText} mt-1`}>Manage schools, calendars, and holidays</p>
      </div>

      {/* Tabs */}
      <div className={`${c.cardBg} border-b ${c.divider} px-6`}>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('schools')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'schools'
                ? `${c.checkboxChecked.split(' ')[0].replace('bg-', 'border-')} ${c.moduleText}`
                : `border-transparent ${c.mutedText} hover:${c.moduleText}`
            }`}
          >
            <div className="flex items-center gap-2">
              <School className="w-4 h-4" />
              Schools
            </div>
          </button>
          <button
            onClick={() => setActiveTab('calendars')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'calendars'
                ? `${c.checkboxChecked.split(' ')[0].replace('bg-', 'border-')} ${c.moduleText}`
                : `border-transparent ${c.mutedText} hover:${c.moduleText}`
            }`}
          >
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Calendars
            </div>
          </button>
          <button
            onClick={() => setActiveTab('holidays')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'holidays'
                ? `${c.checkboxChecked.split(' ')[0].replace('bg-', 'border-')} ${c.moduleText}`
                : `border-transparent ${c.mutedText} hover:${c.moduleText}`
            }`}
          >
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4" />
              Holidays
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'schools' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-lg font-semibold ${c.moduleText}`}>Schools</h2>
              <button
                onClick={() => setShowSchoolForm(!showSchoolForm)}
                className={`flex items-center gap-2 px-4 py-2 ${c.checkboxChecked} text-white rounded-lg`}
              >
                <Plus className="w-4 h-4" />
                Add School
              </button>
            </div>

            {showSchoolForm && (
              <form onSubmit={handleSaveSchool} className={`mb-6 p-4 border ${c.moduleBorder} rounded-lg ${c.cardBg}`}>
                <div className="space-y-3">
                  <div>
                    <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>School Name *</label>
                    <input
                      type="text"
                      required
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>District (optional)</label>
                    <input
                      type="text"
                      value={schoolDistrict}
                      onChange={(e) => setSchoolDistrict(e.target.value)}
                      className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className={`px-4 py-2 ${c.checkboxChecked} text-white rounded-lg`}>
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSchoolForm(false)}
                      className={`px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {schools.map((school) => (
                <div key={school.id} className={`p-4 border ${c.moduleBorder} rounded-lg ${c.cardBg} flex justify-between items-center`}>
                  <div>
                    <div className={`font-medium ${c.moduleText}`}>{school.name}</div>
                    {school.district && <div className={`text-sm ${c.mutedText}`}>{school.district}</div>}
                  </div>
                  <button
                    onClick={() => deleteSchool(school.id)}
                    className={`p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'calendars' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-lg font-semibold ${c.moduleText}`}>Calendars</h2>
              <button
                onClick={() => setShowCalendarForm(!showCalendarForm)}
                className={`flex items-center gap-2 px-4 py-2 ${c.checkboxChecked} text-white rounded-lg`}
              >
                <Plus className="w-4 h-4" />
                Add Calendar
              </button>
            </div>

            {showCalendarForm && (
              <form onSubmit={handleSaveCalendar} className={`mb-6 p-4 border ${c.moduleBorder} rounded-lg ${c.cardBg}`}>
                <div className="space-y-3">
                  <div>
                    <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>School *</label>
                    <select
                      required
                      value={calSchoolName}
                      onChange={(e) => setCalSchoolName(e.target.value)}
                      className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                    >
                      <option value="">Select school...</option>
                      {schools.map((school) => (
                        <option key={school.id} value={school.name}>
                          {school.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>School Year *</label>
                    <select
                      required
                      value={calYearName}
                      onChange={(e) => setCalYearName(e.target.value)}
                      className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                    >
                      <option value="">Select year...</option>
                      <option value="2024-25">2024-25</option>
                      <option value="2025-26">2025-26</option>
                      <option value="2026-27">2026-27</option>
                      <option value="2027-28">2027-28</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Term (optional)</label>
                    <input
                      type="text"
                      placeholder="Fall, Spring, or leave blank for Full Year"
                      value={calTermName}
                      onChange={(e) => setCalTermName(e.target.value)}
                      className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Start Date *</label>
                      <input
                        type="date"
                        required
                        value={calStartDate}
                        onChange={(e) => setCalStartDate(e.target.value)}
                        className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>End Date *</label>
                      <input
                        type="date"
                        required
                        value={calEndDate}
                        onChange={(e) => setCalEndDate(e.target.value)}
                        className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className={`px-4 py-2 ${c.checkboxChecked} text-white rounded-lg`}>
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCalendarForm(false)}
                      className={`px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {calendars.map((calendar) => (
                <div key={calendar.id} className={`p-4 border ${c.moduleBorder} rounded-lg ${c.cardBg} flex justify-between items-center`}>
                  <div>
                    <div className={`font-medium ${c.moduleText}`}>
                      {calendar.school_name} - {calendar.school_year_name}
                    </div>
                    <div className={`text-sm ${c.mutedText}`}>
                      {calendar.term_name} • {new Date(calendar.start_date).toLocaleDateString()} - {new Date(calendar.end_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingCalendar(calendar);
                        setCalSchoolName(calendar.school_name);
                        setCalYearName(calendar.school_year_name);
                        setCalTermName(calendar.term_name);
                        setCalStartDate(calendar.start_date);
                        setCalEndDate(calendar.end_date);
                        setShowCalendarForm(true);
                      }}
                      className={`p-2 ${c.moduleText} hover:bg-gray-100 rounded-lg transition-colors`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteCalendar(calendar.id)}
                      className={`p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'holidays' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-lg font-semibold ${c.moduleText}`}>Holidays</h2>
              <button
                onClick={() => setShowHolidayForm(!showHolidayForm)}
                className={`flex items-center gap-2 px-4 py-2 ${c.checkboxChecked} text-white rounded-lg`}
              >
                <Plus className="w-4 h-4" />
                Add Holiday
              </button>
            </div>

            {showHolidayForm && (
              <form onSubmit={handleSaveHoliday} className={`mb-6 p-4 border ${c.moduleBorder} rounded-lg ${c.cardBg}`}>
                <h3 className={`text-lg font-semibold ${c.moduleText} mb-4`}>
                  {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Calendar *</label>
                    <select
                      required
                      value={selectedCalendarId || ''}
                      onChange={(e) => setSelectedCalendarId(parseInt(e.target.value))}
                      className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                    >
                      <option value="">Select calendar...</option>
                      {calendars.map((cal) => (
                        <option key={cal.id} value={cal.id}>
                          {cal.school_name} - {cal.school_year_name} ({cal.term_name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Holiday Name *</label>
                    <input
                      type="text"
                      required
                      value={holidayName}
                      onChange={(e) => setHolidayName(e.target.value)}
                      className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Start Date *</label>
                      <input
                        type="date"
                        required
                        value={holidayStartDate}
                        onChange={(e) => setHolidayStartDate(e.target.value)}
                        className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>End Date (optional)</label>
                      <input
                        type="date"
                        value={holidayEndDate}
                        onChange={(e) => setHolidayEndDate(e.target.value)}
                        className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Description (optional)</label>
                    <input
                      type="text"
                      value={holidayDescription}
                      onChange={(e) => setHolidayDescription(e.target.value)}
                      className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className={`px-4 py-2 ${c.checkboxChecked} text-white rounded-lg`}>
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowHolidayForm(false)}
                      className={`px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {holidays.map((holiday) => {
                const cal = calendars.find(c => c.id === holiday.calendar_id);
                return (
                  <div key={holiday.id} className={`p-4 border ${c.moduleBorder} rounded-lg ${c.cardBg} flex justify-between items-center`}>
                    <div>
                      <div className={`font-medium ${c.moduleText}`}>{holiday.name}</div>
                      <div className={`text-sm ${c.mutedText}`}>
                        {new Date(holiday.start_date).toLocaleDateString()} • {cal?.school_name} ({cal?.term_name})
                      </div>
                      {holiday.description && <div className={`text-sm ${c.mutedText}`}>{holiday.description}</div>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingHoliday(holiday);
                          setSelectedCalendarId(holiday.calendar_id);
                          setHolidayStartDate(holiday.start_date);
                          setHolidayEndDate(holiday.end_date || holiday.start_date);
                          setHolidayName(holiday.name);
                          setHolidayDescription(holiday.description || '');
                          setShowHolidayForm(true);
                        }}
                        className={`p-2 ${c.mutedText} hover:${c.checkboxChecked} rounded-lg transition-colors`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteHoliday(holiday.id)}
                        className={`p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
