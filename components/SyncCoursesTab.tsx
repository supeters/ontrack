'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, Calendar } from 'lucide-react';

interface Course {
  id: number;
  course_name: string;
  school_id: number;
  source_type: 'canvas' | 'moodle' | null;
  lms_course_id: string | null;
  class_days: string | null;
  work_days: string | null;
  exclusion_patterns: string | null;
}

interface SyncCoursesTabProps {
  selectedSchoolYear: string;
}

export default function SyncCoursesTab({ selectedSchoolYear }: SyncCoursesTabProps) {
  const { theme } = useTheme();
  const { selectedKid } = useAuth();
  const c = theme.colors;

  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<Set<number>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [syncOutput, setSyncOutput] = useState<string>('');
  const [editingCourse, setEditingCourse] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    class_days: string;
    work_days: string;
    exclusion_patterns: string;
  }>({ class_days: '', work_days: '', exclusion_patterns: '' });

  // Load schools
  useEffect(() => {
    const loadSchools = async () => {
      try {
        const res = await fetch('/api/schools');
        const data = await res.json();
        setSchools(data || []);
      } catch (error) {
        console.error('Error loading schools:', error);
      }
    };
    loadSchools();
  }, []);

  // Load courses for the selected kid
  useEffect(() => {
    if (!selectedKid) {
      setAllCourses([]);
      setFilteredCourses([]);
      return;
    }

    const loadCourses = async () => {
      try {
        const url = `/api/courses?kidId=${selectedKid.id}${selectedSchoolYear ? `&schoolYear=${selectedSchoolYear}` : ''}`;
        const res = await fetch(url);
        const data = await res.json();
        const coursesData = Array.isArray(data) ? data : [];
        setAllCourses(coursesData);

        // Apply school filter if selected
        if (selectedSchoolId) {
          setFilteredCourses(coursesData.filter(c => c.school_id === selectedSchoolId));
        } else {
          setFilteredCourses(coursesData);
        }
      } catch (error) {
        console.error('Error loading courses:', error);
        setAllCourses([]);
        setFilteredCourses([]);
      }
    };
    loadCourses();
  }, [selectedKid, selectedSchoolYear]);

  // Filter courses when school selection changes
  useEffect(() => {
    if (selectedSchoolId) {
      setFilteredCourses(allCourses.filter(c => c.school_id === selectedSchoolId));
    } else {
      setFilteredCourses(allCourses);
    }
    setSelectedCourses(new Set()); // Clear selection when filter changes
  }, [selectedSchoolId, allCourses]);

  const toggleCourse = (courseId: number) => {
    const newSelected = new Set(selectedCourses);
    if (newSelected.has(courseId)) {
      newSelected.delete(courseId);
    } else {
      newSelected.add(courseId);
    }
    setSelectedCourses(newSelected);
  };

  const toggleAll = () => {
    if (selectedCourses.size === filteredCourses.length) {
      setSelectedCourses(new Set());
    } else {
      setSelectedCourses(new Set(filteredCourses.map(c => c.id)));
    }
  };

  const handleSync = async () => {
    if (selectedCourses.size === 0) return;

    setSyncing(true);
    setCalculating(true);
    setSyncOutput('');

    try {
      const courseIds = Array.from(selectedCourses);

      const response = await fetch('/api/sync-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_ids: courseIds,
          school_year: selectedSchoolYear,
          calculate_dates: true // Syncs AND calculates dates in one call
        })
      });

      if (!response.ok) {
        setSyncOutput(prev => prev + `❌ Error: ${response.statusText}\n`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.message) {
                setSyncOutput(prev => prev + data.message);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error: any) {
      setSyncOutput(prev => prev + `\n❌ Error: ${error.message}\n`);
    } finally {
      setSyncing(false);
      setCalculating(false);
    }
  };

  const startEdit = (course: Course) => {
    setEditingCourse(course.id);
    setEditValues({
      class_days: course.class_days || '',
      work_days: course.work_days || '',
      exclusion_patterns: course.exclusion_patterns || ''
    });
  };

  const cancelEdit = () => {
    setEditingCourse(null);
    setEditValues({ class_days: '', work_days: '', exclusion_patterns: '' });
  };

  const saveCourseSettings = async (courseId: number) => {
    try {
      const response = await fetch(`/api/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_days: editValues.class_days || null,
          work_days: editValues.work_days || null,
          exclusion_patterns: editValues.exclusion_patterns || null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update course settings');
      }

      // Refresh courses
      const url = `/api/courses?kidId=${selectedKid?.id}${selectedSchoolYear ? `&schoolYear=${selectedSchoolYear}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      const coursesData = Array.isArray(data) ? data : [];
      setAllCourses(coursesData);

      if (selectedSchoolId) {
        setFilteredCourses(coursesData.filter(c => c.school_id === selectedSchoolId));
      } else {
        setFilteredCourses(coursesData);
      }

      setEditingCourse(null);
      setEditValues({ class_days: '', work_days: '', exclusion_patterns: '' });
    } catch (error: any) {
      alert(`Error saving course settings: ${error.message}`);
    }
  };

  const lmsType = selectedSchoolId
    ? (selectedSchoolId === 1 ? 'Canvas' : selectedSchoolId === 2 ? 'Moodle' : 'Unknown')
    : 'All';

  return (
    <div>
      <h2 className={`text-lg font-semibold ${c.moduleText} mb-4`}>Sync Courses</h2>
      <p className={`text-sm ${c.mutedText} mb-6`}>
        Sync courses for {selectedKid?.name || 'selected student'} ({selectedSchoolYear}) from LMS and calculate plan dates
      </p>

      {/* School Filter */}
      <div className="mb-6">
        <label className={`block text-sm font-medium ${c.moduleText} mb-2`}>Filter by School (optional)</label>
        <select
          value={selectedSchoolId || ''}
          onChange={(e) => setSelectedSchoolId(e.target.value ? parseInt(e.target.value) : null)}
          className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
        >
          <option value="">All Schools</option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </select>
        <div className={`mt-2 text-sm ${c.mutedText}`}>
          LMS Type: <span className="font-medium">{lmsType}</span>
        </div>
      </div>

      {/* Course Selection Table */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className={`block text-sm font-medium ${c.moduleText}`}>
            Courses ({selectedCourses.size} selected)
          </label>
          <button
            onClick={toggleAll}
            className={`text-sm ${c.checkboxChecked.split(' ')[0].replace('bg-', 'text-')} hover:underline`}
          >
            {selectedCourses.size === filteredCourses.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className={`border ${c.moduleBorder} rounded-lg overflow-x-auto max-h-96 overflow-y-auto`}>
          <table className="border-collapse text-left w-full">
            <thead>
              <tr className={`border-b ${c.moduleBorder} text-xs uppercase tracking-wider ${c.mutedText} bg-black/5`}>
                <th className="p-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={filteredCourses.length > 0 && selectedCourses.size === filteredCourses.length}
                    onChange={toggleAll}
                    className="h-4 w-4"
                  />
                </th>
                <th className="p-3">Course Name</th>
                <th className="p-3">LMS ID / Status</th>
                <th className="p-3">Schedule Settings</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-gray-200 divide-y">
              {filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`p-4 text-sm ${c.mutedText} text-center`}>
                    {selectedKid ? 'No courses found' : 'Select a student from the main view'}
                  </td>
                </tr>
              ) : (
                filteredCourses.map((course) => (
                  <tr key={course.id} className="hover:bg-black/5 transition-colors">
                    <td className="align-top p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedCourses.has(course.id)}
                        onChange={() => toggleCourse(course.id)}
                        className="h-4 mt-1 w-4"
                      />
                    </td>
                    <td className={`p-3 text-sm font-medium ${c.moduleText} align-top`}>
                      {course.course_name}
                    </td>
                    <td className="align-top p-3 text-xs">
                      {course.lms_course_id ? (
                        <span className={c.mutedText}>
                          {course.source_type?.toUpperCase()} ID: {course.lms_course_id}
                        </span>
                      ) : (
                        <span className="font-medium text-orange-500">⚠️ Not mapped to LMS</span>
                      )}
                    </td>
                    <td className="align-top p-3 text-xs">
                      {editingCourse === course.id ? (
                        <div className="max-w-xs space-y-2">
                          <div>
                            <label className={`${c.mutedText} block mb-0.5 text-[10px]`}>Class Days</label>
                            <input
                              type="text"
                              value={editValues.class_days}
                              onChange={(e) => setEditValues({...editValues, class_days: e.target.value})}
                              placeholder="e.g., 135 or 524"
                              className={`w-full px-2 py-1 text-xs border ${c.moduleBorder} rounded`}
                            />
                          </div>
                          <div>
                            <label className={`${c.mutedText} block mb-0.5 text-[10px]`}>Work Days</label>
                            <input
                              type="text"
                              value={editValues.work_days}
                              onChange={(e) => setEditValues({...editValues, work_days: e.target.value})}
                              placeholder="e.g., 135 or 524"
                              className={`w-full px-2 py-1 text-xs border ${c.moduleBorder} rounded`}
                            />
                          </div>
                          <div>
                            <label className={`${c.mutedText} block mb-0.5 text-[10px]`}>Exclusion Patterns</label>
                            <input
                              type="text"
                              value={editValues.exclusion_patterns}
                              onChange={(e) => setEditValues({...editValues, exclusion_patterns: e.target.value})}
                              placeholder="e.g., quiz,test"
                              className={`w-full px-2 py-1 text-xs border ${c.moduleBorder} rounded`}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className={`space-y-1 ${c.mutedText}`}>
                          {course.class_days && <div>Class Days: {course.class_days}</div>}
                          {course.work_days && <div>Work Days: {course.work_days}</div>}
                          {course.exclusion_patterns && <div>Exclusions: {course.exclusion_patterns}</div>}
                          {!course.class_days && !course.work_days && !course.exclusion_patterns && (
                            <span className="italic opacity-70">No settings defined</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="align-top p-3 text-right">
                      {editingCourse === course.id ? (
                        <div className="flex gap-2 items-center justify-end">
                          <button
                            onClick={() => saveCourseSettings(course.id)}
                            className={`px-3 py-1 text-xs ${c.checkboxChecked} text-white rounded`}
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className={`px-3 py-1 text-xs border ${c.moduleBorder} rounded`}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(course)}
                          className={`text-xs ${c.checkboxChecked.split(' ')[0].replace('bg-', 'text-')} hover:underline`}
                        >
                          Edit settings
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    {/* Action Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handleSync}
          disabled={syncing || selectedCourses.size === 0}
          className={`flex items-center gap-2 px-4 py-2 ${
            syncing || selectedCourses.size === 0
              ? 'bg-gray-300 cursor-not-allowed'
              : c.checkboxChecked
          } text-white rounded-lg`}
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing & Calculating...' : 'Sync Activities & Calculate Dates'}
        </button>
      </div>

      {/* Output Console */}
      {syncOutput && (
        <div className={`border ${c.moduleBorder} rounded-lg p-4 ${c.cardBg}`}>
          <h3 className={`text-sm font-semibold ${c.moduleText} mb-2`}>Output</h3>
          <pre className={`text-xs ${c.moduleText} font-mono whitespace-pre-wrap max-h-96 overflow-y-auto`}>
            {syncOutput}
          </pre>
        </div>
      )}
    </div>
  );
}