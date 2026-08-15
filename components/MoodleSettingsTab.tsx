'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  BookOpen, RefreshCw, Plus, Trash2, CheckCircle,
  AlertCircle, User, Link as LinkIcon, XCircle
} from 'lucide-react';

interface MoodleAccount {
  id: number;
  kid_id: number;
  lms_url: string;
  lms_user_name: string;
  name: string;
  is_active: boolean;
  api_token: string | null;
  last_sync: string | null;
}

interface MoodleCourse {
  lms_id: string;
  fullname: string;
  shortname: string;
  matched: boolean;
  matchedCourseId: number | null;
  matchedCourseName: string | null;
}

interface LocalCourse {
  id: number;
  course_name: string;
  lms_course_id: string | null;
  work_days: string | null;
  class_days: string | null;
  exclusion_patterns: string | null;
}

interface MoodleSettingsTabProps {
  selectedSchoolYear: string;
}

export default function MoodleSettingsTab({ selectedSchoolYear }: MoodleSettingsTabProps) {
  const { theme } = useTheme();
  const { selectedKid, kids } = useAuth();
  const c = theme.colors;

  const [moodleAccounts, setMoodleAccounts] = useState<MoodleAccount[]>([]);
  const [moodleCourses, setMoodleCourses] = useState<MoodleCourse[]>([]);
  const [localCourses, setLocalCourses] = useState<LocalCourse[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync state
  const [selectedCourses, setSelectedCourses] = useState<Set<number>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncOutput, setSyncOutput] = useState<string>('');

  // Editing state for course fields
  const [editingCourse, setEditingCourse] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    work_days: string;
    class_days: string;
    exclusion_patterns: string;
  }>({ work_days: '', class_days: '', exclusion_patterns: '' });

  // Add account form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccount, setNewAccount] = useState({
    kid_id: selectedKid?.id || 0,
    moodle_url: 'https://mpoa.memoriapress.com',
    username: '',
    password: ''
  });

  useEffect(() => {
    loadMoodleAccounts();
    loadLocalCourses();
  }, [selectedKid, selectedSchoolYear]);

  useEffect(() => {
    if (moodleAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(moodleAccounts[0].id);
    }
  }, [moodleAccounts]);

  const loadMoodleAccounts = async () => {
    if (!selectedKid) return;
    try {
      const res = await fetch(`/api/moodle/accounts?kidId=${selectedKid.id}`);
      const data = await res.json();
      setMoodleAccounts(data || []);
    } catch (err) {
      console.error('Error loading Moodle accounts:', err);
    }
  };

  const loadMoodleCourses = async (accountId: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/moodle/list-courses?accountId=${accountId}`);
      const data = await res.json();

      if (res.ok) {
        setMoodleCourses(data || []);
      } else {
        setError(data.error || 'Failed to load courses');
      }
    } catch (err: any) {
      console.error('Error loading Moodle courses:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadLocalCourses = async () => {
    if (!selectedKid || !selectedSchoolYear) return;
    try {
      const res = await fetch(`/api/courses?kidId=${selectedKid.id}&schoolYear=${selectedSchoolYear}`);
      const data = await res.json();
      console.log('Loaded local courses:', data);
      console.log('Courses with lms_course_id:', data.filter((c: any) => c.lms_course_id));
      setLocalCourses(data || []);
    } catch (err) {
      console.error('Error loading local courses:', err);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/moodle/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccount)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add account');
      }

      setSuccess('Moodle account added successfully!');
      setShowAddForm(false);
      setNewAccount({
        kid_id: selectedKid?.id || 0,
        moodle_url: 'https://mpoa.memoriapress.com',
        username: '',
        password: ''
      });
      loadMoodleAccounts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const testConnection = async (accountId: number) => {
    setTesting(accountId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/moodle/test-connection?accountId=${accountId}`);
      const data = await res.json();

      if (data.success) {
        setSuccess('Connection successful!');
        loadMoodleAccounts();
      } else {
        setError(data.error || 'Connection failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTesting(null);
    }
  };

  const deleteAccount = async (accountId: number) => {
    if (!confirm('Delete this Moodle account?')) return;

    try {
      await fetch(`/api/moodle/accounts?id=${accountId}`, { method: 'DELETE' });
      loadMoodleAccounts();
      setSuccess('Account deleted successfully');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const matchCourse = async (lmsId: string, localCourseId: number | null) => {
    try {
      await fetch('/api/moodle/match-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lmsId, localCourseId })
      });

      // Reload courses to show updated match status
      if (selectedAccountId) {
        loadMoodleCourses(selectedAccountId);
      }
      loadLocalCourses();
      setSuccess('Course mapping updated');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEditingCourse = (course: LocalCourse) => {
    setEditingCourse(course.id);
    setEditValues({
      work_days: course.work_days || '',
      class_days: course.class_days || '',
      exclusion_patterns: course.exclusion_patterns || ''
    });
  };

  const cancelEditingCourse = () => {
    setEditingCourse(null);
    setEditValues({ work_days: '', class_days: '', exclusion_patterns: '' });
  };

  const saveCourse = async (courseId: number) => {
    try {
      const response = await fetch('/api/moodle/update-course-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          work_days: editValues.work_days || null,
          class_days: editValues.class_days || null,
          exclusion_patterns: editValues.exclusion_patterns || null
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update course');
      }

      loadLocalCourses();
      setEditingCourse(null);
      setSuccess('Course settings updated');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleCourseSelection = (courseId: number) => {
    const newSelection = new Set(selectedCourses);
    if (newSelection.has(courseId)) {
      newSelection.delete(courseId);
    } else {
      newSelection.add(courseId);
    }
    setSelectedCourses(newSelection);
  };

  const selectAllCourses = () => {
    const coursesWithLmsId = localCourses.filter(c => c.lms_course_id);
    setSelectedCourses(new Set(coursesWithLmsId.map(c => c.id)));
  };

  const deselectAllCourses = () => {
    setSelectedCourses(new Set());
  };

  const syncSelectedCourses = async (mode: 'incremental' | 'all' = 'incremental') => {
    if (selectedCourses.size === 0) {
      setError('Please select at least one course to sync');
      return;
    }

    setSyncing(true);
    setSyncOutput('');
    setError(null);

    try {
      const response = await fetch('/api/moodle/sync-modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseIds: Array.from(selectedCourses),
          mode: mode
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Sync failed');
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.message) {
              setSyncOutput(prev => prev + data.message);
            }
            if (data.error) {
              setSyncOutput(prev => prev + data.error);
            }
          }
        }
      }

      setSuccess(`${mode === 'all' ? 'Full' : 'Incremental'} sync completed!`);
    } catch (err: any) {
      setError(err.message);
      setSyncOutput(prev => prev + `\n❌ Error: ${err.message}\n`);
    } finally {
      setSyncing(false);
    }
  };

  const calculatePlanDates = async () => {
    if (selectedCourses.size === 0) {
      setError('Please select at least one course');
      return;
    }

    setSyncing(true);
    setSyncOutput('');
    setError(null);

    try {
      const response = await fetch('/api/moodle/calculate-plan-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseIds: Array.from(selectedCourses) })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Plan date calculation failed');
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.message) {
              setSyncOutput(prev => prev + data.message);
            }
            if (data.error) {
              setSyncOutput(prev => prev + data.error);
            }
          }
        }
      }

      setSuccess('Plan dates calculated!');
    } catch (err: any) {
      setError(err.message);
      setSyncOutput(prev => prev + `\n❌ Error: ${err.message}\n`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      {/* Error/Success Messages */}
      {error && (
        <div className={`mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2`}>
          <AlertCircle className="h-4 text-red-600 w-4" />
          <span className="text-red-800 text-sm">{error}</span>
        </div>
      )}
      {success && (
        <div className={`mb-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2`}>
          <CheckCircle className="h-4 text-green-600 w-4" />
          <span className="text-green-800 text-sm">{success}</span>
        </div>
      )}

      {/* Moodle Accounts Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-semibold ${c.moduleText}`}>Moodle Accounts</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`flex items-center gap-2 px-4 py-2 ${c.checkboxChecked} text-white rounded-lg`}
          >
            <Plus className="h-4 w-4" />
            Add Account
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddAccount} className={`mb-6 p-4 border ${c.moduleBorder} rounded-lg ${c.cardBg}`}>
            <div className="space-y-3">
              <div>
                <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Student *</label>
                <select
                  required
                  value={newAccount.kid_id}
                  onChange={(e) => setNewAccount({ ...newAccount, kid_id: parseInt(e.target.value) })}
                  className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                >
                  <option value="">Select student...</option>
                  {kids?.map((kid) => (
                    <option key={kid.id} value={kid.id}>{kid.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Moodle URL *</label>
                <input
                  type="url"
                  required
                  value={newAccount.moodle_url}
                  onChange={(e) => setNewAccount({ ...newAccount, moodle_url: e.target.value })}
                  className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Username *</label>
                <input
                  type="text"
                  required
                  value={newAccount.username}
                  onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value })}
                  className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${c.moduleText} mb-1`}>Password *</label>
                <input
                  type="password"
                  required
                  value={newAccount.password}
                  onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                  className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className={`px-4 py-2 ${c.checkboxChecked} text-white rounded-lg`}>
                  Add & Test
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className={`px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {moodleAccounts.map((account) => {
            const kidName = kids?.find(k => k.id === account.kid_id)?.name || 'Unknown';
            return (
              <div key={account.id} className={`p-4 border ${c.moduleBorder} rounded-lg ${c.cardBg}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex gap-3 items-center">
                    <User className={`h-5 w-5 ${c.mutedText}`} />
                    <div>
                      <div className={`font-medium ${c.moduleText}`}>{kidName}</div>
                      <div className={`text-sm ${c.mutedText}`}>{account.lms_user_name} @ {account.lms_url}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {account.is_active ? (
                      <span className="bg-green-100 px-2 py-1 rounded-full text-green-800 text-xs">Connected</span>
                    ) : (
                      <span className="bg-yellow-100 px-2 py-1 rounded-full text-xs text-yellow-800">Not Connected</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => testConnection(account.id)}
                    disabled={testing === account.id}
                    className={`flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50`}
                  >
                    {testing === account.id ? (
                      <RefreshCw className="animate-spin h-3 w-3" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Test
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAccountId(account.id);
                      loadMoodleCourses(account.id);
                    }}
                    disabled={loading || !account.is_active}
                    className={`flex items-center gap-1 px-3 py-1 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50`}
                  >
                    {loading && selectedAccountId === account.id ? (
                      <RefreshCw className="animate-spin h-3 w-3" />
                    ) : (
                      <BookOpen className="h-3 w-3" />
                    )}
                    List Courses
                  </button>
                  <button
                    onClick={() => deleteAccount(account.id)}
                    className={`flex items-center gap-1 px-3 py-1 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100`}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
                {account.last_sync && (
                  <div className={`text-xs ${c.mutedText} mt-2`}>
                    Last sync: {new Date(account.last_sync).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
          {moodleAccounts.length === 0 && (
            <div className={`p-8 text-center border ${c.moduleBorder} rounded-lg ${c.cardBg}`}>
              <BookOpen className={`h-12 w-12 ${c.mutedText} mx-auto mb-2`} />
              <p className={`${c.mutedText}`}>No Moodle accounts configured</p>
              <p className={`text-sm ${c.mutedText} mt-1`}>Add a Moodle account to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Course Mapping Section */}
      {moodleCourses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-semibold ${c.moduleText}`}>Moodle Courses</h2>
            <p className={`text-sm ${c.mutedText}`}>
              {moodleCourses.filter(c => c.matched).length} of {moodleCourses.length} matched
            </p>
          </div>

          <div className="space-y-2">
            {moodleCourses.map((moodleCourse) => (
              <div key={moodleCourse.lms_id} className={`p-4 border ${c.moduleBorder} rounded-lg ${c.cardBg}`}>
                <div className="flex gap-4 items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-2 items-center">
                      {moodleCourse.matched ? (
                        <CheckCircle className="h-4 shrink-0 text-green-600 w-4" />
                      ) : (
                        <XCircle className="h-4 shrink-0 text-orange-500 w-4" />
                      )}
                      <div className="min-w-0">
                        <div className={`font-medium ${c.moduleText} truncate`}>{moodleCourse.fullname}</div>
                        <div className={`text-sm ${c.mutedText}`}>{moodleCourse.lms_id}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 items-center shrink-0">
                    <LinkIcon className={`h-4 w-4 ${c.mutedText}`} />
                    <select
                      value={moodleCourse.matchedCourseId || ''}
                      onChange={(e) => matchCourse(moodleCourse.lms_id, e.target.value ? parseInt(e.target.value) : null)}
                      className={`px-3 py-1.5 text-sm border ${c.moduleBorder} rounded-lg ${c.moduleText} min-w-[200px]`}
                    >
                      <option value="">-- Not Matched --</option>
                      {localCourses
                        .filter(lc => !lc.lms_course_id || lc.lms_course_id === moodleCourse.lms_id)
                        .map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.course_name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                {moodleCourse.matched && moodleCourse.matchedCourseId && (() => {
                  const matchedCourse = localCourses.find(c => c.id === moodleCourse.matchedCourseId);
                  if (!matchedCourse) return null;
                  const isEditing = editingCourse === matchedCourse.id;

                  return (
                    <div className={`mt-3 ml-6 p-3 bg-gray-50 rounded border ${c.moduleBorder}`}>
                      <div className={`text-xs ${c.mutedText} mb-2`}>
                        ✓ Matched to: {moodleCourse.matchedCourseName}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className={`text-xs ${c.mutedText}`}>Work Days</label>
                              <input
                                type="text"
                                value={editValues.work_days}
                                onChange={(e) => setEditValues({ ...editValues, work_days: e.target.value })}
                                placeholder="12345"
                                className={`w-full px-2 py-1 text-sm border ${c.moduleBorder} rounded`}
                              />
                            </div>
                            <div>
                              <label className={`text-xs ${c.mutedText}`}>Class Days</label>
                              <input
                                type="text"
                                value={editValues.class_days}
                                onChange={(e) => setEditValues({ ...editValues, class_days: e.target.value })}
                                placeholder="135"
                                className={`w-full px-2 py-1 text-sm border ${c.moduleBorder} rounded`}
                              />
                            </div>
                            <div>
                              <label className={`text-xs ${c.mutedText}`}>Exclusion Patterns</label>
                              <input
                                type="text"
                                value={editValues.exclusion_patterns}
                                onChange={(e) => setEditValues({ ...editValues, exclusion_patterns: e.target.value })}
                                placeholder="warm-up,quiz"
                                className={`w-full px-2 py-1 text-sm border ${c.moduleBorder} rounded`}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveCourse(matchedCourse.id)}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditingCourse}
                              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-3 gap-4 text-xs flex-1">
                            <div>
                              <span className={c.mutedText}>Work Days: </span>
                              <span className={c.moduleText}>{matchedCourse.work_days || 'not set'}</span>
                            </div>
                            <div>
                              <span className={c.mutedText}>Class Days: </span>
                              <span className={c.moduleText}>{matchedCourse.class_days || 'not set'}</span>
                            </div>
                            <div>
                              <span className={c.mutedText}>Exclusions: </span>
                              <span className={c.moduleText}>{matchedCourse.exclusion_patterns || 'none'}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => startEditingCourse(matchedCourse)}
                            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync Modules Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-semibold ${c.moduleText}`}>Sync Course Modules</h2>
          <div className="flex gap-2">
            <button
              onClick={selectAllCourses}
              disabled={syncing}
              className={`px-3 py-1 text-sm border ${c.moduleBorder} rounded-lg ${c.moduleText} hover:bg-gray-50 disabled:opacity-50`}
            >
              Select All
            </button>
            <button
              onClick={deselectAllCourses}
              disabled={syncing}
              className={`px-3 py-1 text-sm border ${c.moduleBorder} rounded-lg ${c.moduleText} hover:bg-gray-50 disabled:opacity-50`}
            >
              Deselect All
            </button>
            <button
              onClick={() => syncSelectedCourses('incremental')}
              disabled={syncing || selectedCourses.size === 0}
              className={`flex items-center gap-2 px-4 py-1 ${c.checkboxChecked} text-white rounded-lg disabled:opacity-50`}
            >
              {syncing ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Incremental Sync ({selectedCourses.size})
                </>
              )}
            </button>
            <button
              onClick={() => syncSelectedCourses('all')}
              disabled={syncing || selectedCourses.size === 0}
              className={`flex items-center gap-2 px-4 py-1 bg-orange-600 text-white rounded-lg disabled:opacity-50 hover:bg-orange-700`}
            >
              {syncing ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4" />
                  Full Sync...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Full Sync ({selectedCourses.size})
                </>
              )}
            </button>
            <button
              onClick={calculatePlanDates}
              disabled={syncing || selectedCourses.size === 0}
              className={`flex items-center gap-2 px-4 py-1 bg-purple-600 text-white rounded-lg disabled:opacity-50 hover:bg-purple-700`}
            >
              {syncing ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4" />
                  Calculating...
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4" />
                  Recalc Plan Dates ({selectedCourses.size})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Course Selection List */}
        <div className="gap-2 grid grid-cols-2 mb-4">
          {localCourses
            .filter(c => c.lms_course_id)
            .map((course) => (
              <label
                key={course.id}
                className={`flex items-center gap-2 p-3 border ${c.moduleBorder} rounded-lg cursor-pointer hover:bg-gray-50 ${
                  selectedCourses.has(course.id) ? 'bg-blue-50 border-blue-300' : c.cardBg
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedCourses.has(course.id)}
                  onChange={() => toggleCourseSelection(course.id)}
                  disabled={syncing}
                  className="h-4 w-4"
                />
                <span className={`text-sm ${c.moduleText}`}>{course.course_name}</span>
              </label>
            ))}
        </div>

        {localCourses.filter(c => c.lms_course_id).length === 0 && (
          <div className={`p-8 text-center border ${c.moduleBorder} rounded-lg ${c.cardBg}`}>
            <p className={`${c.mutedText}`}>No courses with Moodle mapping found</p>
            <p className={`text-sm ${c.mutedText} mt-1`}>Map courses to Moodle first</p>
          </div>
        )}

        {/* Sync Output Console */}
        {syncOutput && (
          <div className="mt-4">
            <h3 className={`text-sm font-semibold ${c.moduleText} mb-2`}>Sync Output:</h3>
            <pre className={`p-4 bg-black text-green-400 rounded-lg overflow-auto max-h-96 text-xs font-mono`}>
              {syncOutput}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
