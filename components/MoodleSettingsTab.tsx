'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  BookOpen, RefreshCw, Plus, Trash2, CheckCircle, Edit2,
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

  // Editing state for course fields
  const [editingCourse, setEditingCourse] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    work_days: string;
    class_days: string;
    exclusion_patterns: string;
  }>({ work_days: '', class_days: '', exclusion_patterns: '' });

  // Account form state
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<MoodleAccount | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountUrl, setAccountUrl] = useState('');
  const [accountUsername, setAccountUsername] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountToken, setAccountToken] = useState('');

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
      setLocalCourses(data || []);
    } catch (err) {
      console.error('Error loading local courses:', err);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKid) return;
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/moodle/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingAccount?.id,
          kidId: selectedKid.id,
          name: accountName,
          lmsUrl: accountUrl,
          username: accountUsername || null,
          password: accountPassword || null,
          apiToken: accountToken || null,
          isActive: true,
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save account');
      }

      setSuccess('Moodle account saved successfully!');
      setShowAccountForm(false);
      setEditingAccount(null);
      setAccountName('');
      setAccountUrl('');
      setAccountUsername('');
      setAccountPassword('');
      setAccountToken('');
      loadMoodleAccounts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditAccount = (account: MoodleAccount) => {
    setEditingAccount(account);
    setAccountName(account.name);
    setAccountUrl(account.lms_url);
    setAccountUsername(account.lms_user_name || '');
    setAccountToken(account.api_token || '');
    setAccountPassword('');
    setShowAccountForm(true);
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

  return (
    <div className="space-y-6">
      {/* Error Message Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 flex gap-2 items-center mb-4 p-3 rounded-lg text-red-700">
          <AlertCircle className="h-4 shrink-0 text-red-600 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Success Message Banner */}
      {success && (
        <div className="bg-green-50 border border-green-200 flex gap-2 items-center mb-4 p-3 rounded-lg text-green-700">
          <CheckCircle className="h-4 shrink-0 text-green-600 w-4" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {/* Accounts Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-semibold ${c.moduleText}`}>Moodle Accounts</h2>
          <button
            onClick={() => {
              setEditingAccount(null);
              setAccountName('');
              setAccountUrl('');
              setAccountUsername('');
              setAccountPassword('');
              setAccountToken('');
              setShowAccountForm(!showAccountForm);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${c.checkboxChecked} text-white rounded-lg`}
          >
            <Plus className="h-4 w-4" />
            Add Account
          </button>
        </div>

        {/* Account Form */}
        {showAccountForm && (
          <form onSubmit={handleSaveAccount} className={`p-4 mb-4 border ${c.moduleBorder} rounded-lg ${c.cardBg} space-y-4`}>
            <h3 className={`font-medium ${c.moduleText}`}>
              {editingAccount ? 'Edit Moodle Account' : 'Add Moodle Account'}
            </h3>
            <div className="gap-4 grid grid-cols-1 md:grid-cols-2">
              <div>
                <label className={`block text-xs ${c.mutedText} mb-1`}>Account Name</label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. TPS Moodle"
                  className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                />
              </div>
              <div>
                <label className={`block text-xs ${c.mutedText} mb-1`}>Moodle URL</label>
                <input
                  type="url"
                  required
                  value={accountUrl}
                  onChange={(e) => setAccountUrl(e.target.value)}
                  placeholder="https://moodle.example.com"
                  className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                />
              </div>
              <div>
                <label className={`block text-xs ${c.mutedText} mb-1`}>Username</label>
                <input
                  type="text"
                  value={accountUsername}
                  onChange={(e) => setAccountUsername(e.target.value)}
                  className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                />
              </div>
              <div>
                <label className={`block text-xs ${c.mutedText} mb-1`}>Password</label>
                <input
                  type="password"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  className={`w-full px-3 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className={`px-4 py-2 ${c.checkboxChecked} text-white rounded-lg`}>
                Save & Test
              </button>
              <button
                type="button"
                onClick={() => setShowAccountForm(false)}
                className={`px-4 py-2 border ${c.moduleBorder} rounded-lg ${c.moduleText}`}
              >
                Cancel
              </button>
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
                    <RefreshCw className={`h-3 w-3 ${testing === account.id ? 'animate-spin' : ''}`} />
                    Test
                  </button>
                  <button
                    onClick={() => handleEditAccount(account)}
                    className={`flex items-center gap-1 px-3 py-1 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100`}
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAccountId(account.id);
                      loadMoodleCourses(account.id);
                    }}
                    disabled={loading || !account.is_active}
                    className={`flex items-center gap-1 px-3 py-1 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50`}
                  >
                    <BookOpen className={`h-3 w-3 ${loading && selectedAccountId === account.id ? 'animate-spin' : ''}`} />
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
                          <div className="gap-2 grid grid-cols-3">
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
                              className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-white text-xs"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditingCourse}
                              className="border border-gray-300 hover:bg-gray-100 px-3 py-1 rounded text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1 gap-4 grid grid-cols-3 text-xs">
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
                            className="border border-gray-300 hover:bg-gray-100 px-3 py-1 rounded text-xs"
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
    </div>
  );
}