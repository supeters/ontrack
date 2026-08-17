'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  BookOpen, RefreshCw, CheckCircle, AlertCircle, Link as LinkIcon, Plus, Edit2, Trash2
} from 'lucide-react';

interface CanvasAccount {
  id: number;
  kid_id: number;
  lms_url: string;
  name: string;
  is_active: boolean;
  api_token: string | null;
  last_sync: string | null;
}

interface CanvasCourse {
  lms_id: string;
  name: string;
  course_code: string;
  workflow_state: string;
  mapped_course_id: number | null;
  mapped_course_name: string | null;
}

interface LocalCourse {
  id: number;
  course_name: string;
  lms_course_id: string | null;
}

interface CanvasSettingsTabProps {
  selectedSchoolYear: string;
}

export default function CanvasSettingsTab({ selectedSchoolYear }: CanvasSettingsTabProps) {
  const { theme } = useTheme();
  const { selectedKid } = useAuth();
  const c = theme.colors;

  const [canvasAccounts, setCanvasAccounts] = useState<CanvasAccount[]>([]);
  const [canvasCourses, setCanvasCourses] = useState<CanvasCourse[]>([]);
  const [localCourses, setLocalCourses] = useState<LocalCourse[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Account form state
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CanvasAccount | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountUrl, setAccountUrl] = useState('');
  const [accountToken, setAccountToken] = useState('');

  useEffect(() => {
    loadCanvasAccounts();
    loadLocalCourses();
  }, [selectedKid, selectedSchoolYear]);

  useEffect(() => {
    if (canvasAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(canvasAccounts[0].id);
    }
  }, [canvasAccounts]);

  const loadCanvasAccounts = async () => {
    if (!selectedKid) return;
    try {
      const res = await fetch(`/api/canvas/accounts?kidId=${selectedKid.id}`);
      const data = await res.json();
      setCanvasAccounts(data || []);
    } catch (err) {
      console.error('Error loading Canvas accounts:', err);
    }
  };

  const loadLocalCourses = async () => {
    if (!selectedKid) return;
    try {
      const res = await fetch(`/api/courses?kidId=${selectedKid.id}&schoolYear=${selectedSchoolYear}`);
      const data = await res.json();
      setLocalCourses(data || []);
    } catch (err) {
      console.error('Error loading local courses:', err);
    }
  };

  const loadCanvasCourses = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/canvas/list-courses?accountId=${selectedAccountId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCanvasCourses(data.courses || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKid) return;

    try {
      const res = await fetch('/api/canvas/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingAccount?.id,
          kidId: selectedKid.id,
          name: accountName,
          lmsUrl: accountUrl,
          apiToken: accountToken || null,
          isActive: true,
        })
      });

      if (!res.ok) throw new Error('Failed to save account');

      setSuccess('Account saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
      setShowAccountForm(false);
      setEditingAccount(null);
      setAccountName('');
      setAccountUrl('');
      setAccountToken('');
      loadCanvasAccounts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditAccount = (account: CanvasAccount) => {
    setEditingAccount(account);
    setAccountName(account.name);
    setAccountUrl(account.lms_url);
    setAccountToken(account.api_token || '');
    setShowAccountForm(true);
  };

  const handleDeleteAccount = async (accountId: number) => {
    if (!selectedKid) return;
    if (!confirm('Delete this Canvas account?')) return;

    try {
      const res = await fetch(`/api/canvas/accounts?id=${accountId}&kidId=${selectedKid.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete account');

      setSuccess('Account deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
      loadCanvasAccounts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const matchCourse = async (canvasLmsId: string, localCourseId: number) => {
    try {
      const res = await fetch('/api/canvas/match-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lmsId: canvasLmsId,
          localCourseId: localCourseId
        })
      });

      if (!res.ok) throw new Error('Failed to match course');

      setSuccess('Course matched successfully!');
      setTimeout(() => setSuccess(null), 3000);

      await loadCanvasCourses();
      await loadLocalCourses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const selectedAccount = canvasAccounts.find(a => a.id === selectedAccountId);

  return (
    <div className="space-y-6">
      {/* Manage Accounts */}
      <div className={`${c.card} p-6 rounded-xl`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-bold ${c.text} flex items-center gap-2`}>
            <BookOpen className="h-5 w-5" />
            Canvas LMS Accounts
          </h3>
          <button
            onClick={() => {
              setEditingAccount(null);
              setAccountName('');
              setAccountUrl('');
              setAccountToken('');
              setShowAccountForm(!showAccountForm);
            }}
            className={`${c.primary} px-4 py-2 rounded-lg flex items-center gap-2`}
          >
            <Plus className="h-4 w-4" />
            Add Account
          </button>
        </div>

        {showAccountForm && (
          <form onSubmit={handleSaveAccount} className={`mb-4 p-4 border ${c.border} rounded-lg space-y-3`}>
            <div>
              <label className={`block text-sm font-medium ${c.text} mb-1`}>
                Account Name *
              </label>
              <input
                type="text"
                required
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g., Canvas Main"
                className={`w-full ${c.input} px-3 py-2 rounded-lg`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium ${c.text} mb-1`}>
                Canvas URL *
              </label>
              <input
                type="url"
                required
                value={accountUrl}
                onChange={(e) => setAccountUrl(e.target.value)}
                placeholder="https://your-school.instructure.com"
                className={`w-full ${c.input} px-3 py-2 rounded-lg`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium ${c.text} mb-1`}>
                API Token (optional)
              </label>
              <input
                type="password"
                value={accountToken}
                onChange={(e) => setAccountToken(e.target.value)}
                placeholder="Canvas API token"
                className={`w-full ${c.input} px-3 py-2 rounded-lg`}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className={`${c.primary} px-4 py-2 rounded-lg`}>
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAccountForm(false);
                  setEditingAccount(null);
                }}
                className={`${c.secondary} px-4 py-2 rounded-lg`}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {canvasAccounts.length === 0 ? (
          <p className={c.mutedText}>No Canvas accounts configured</p>
        ) : (
          <div className="space-y-2">
            {canvasAccounts.map(account => (
              <div key={account.id} className={`${c.border} p-4 rounded-lg flex items-center justify-between`}>
                <div>
                  <p className={`font-semibold ${c.text}`}>{account.name}</p>
                  <p className={`text-sm ${c.mutedText}`}>{account.lms_url}</p>
                  {account.api_token && (
                    <p className="text-green-600 text-xs">API Token configured</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditAccount(account)}
                    className={`p-2 ${c.mutedText} hover:${c.text} rounded-lg transition-colors`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(account.id)}
                    className="hover:bg-red-50 p-2 rounded-lg text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Load Courses from Canvas */}
      {canvasAccounts.length > 0 && (
        <div className={`${c.card} p-6 rounded-xl`}>
          <h3 className={`text-lg font-bold ${c.text} mb-4`}>
            Load Courses from Canvas
          </h3>

          <select
            value={selectedAccountId || ''}
            onChange={(e) => setSelectedAccountId(parseInt(e.target.value))}
            className={`w-full ${c.input} px-4 py-2 rounded-lg mb-4`}
          >
            {canvasAccounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.lms_url})
              </option>
            ))}
          </select>

          {selectedAccount && (
            <button
              onClick={loadCanvasCourses}
              disabled={loading}
              className={`${c.primary} px-4 py-2 rounded-lg flex items-center gap-2`}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Load Canvas Courses'}
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 flex gap-2 items-center p-4 rounded-xl text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 flex gap-2 items-center p-4 rounded-xl text-green-700">
          <CheckCircle className="h-5 w-5" />
          {success}
        </div>
      )}

      {/* Canvas Courses List (Table View) */}
      {canvasCourses.length > 0 && (
        <div className={`${c.card} p-6 rounded-xl`}>
          <h3 className={`text-lg font-bold ${c.text} mb-4`}>
            Canvas Courses - Map to Local Courses
          </h3>

          <div className="overflow-x-auto">
            <table className="border-collapse text-left w-full">
              <thead>
                <tr className={`border-b ${c.border} text-sm ${c.mutedText}`}>
                  <th className="font-semibold px-4 py-3">Course Name</th>
                  <th className="font-semibold px-4 py-3">Course Code</th>
                  <th className="font-semibold px-4 py-3">Mapping Status</th>
                  <th className="font-semibold px-4 py-3 text-right">Action / Assign</th>
                </tr>
              </thead>
              <tbody className="divide-gray-100 divide-y">
                {canvasCourses.map(course => (
                  <tr key={course.lms_id} className={`hover:bg-gray-50/50 transition-colors`}>
                    <td className={`py-3 px-4 font-medium ${c.text}`}>
                      {course.name}
                    </td>
                    <td className={`py-3 px-4 text-sm ${c.mutedText}`}>
                      {course.course_code || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {course.mapped_course_name ? (
                        <span className="flex font-medium gap-1 items-center text-green-600">
                          <LinkIcon className="h-3.5 w-3.5" />
                          {course.mapped_course_name}
                        </span>
                      ) : (
                        <span className="font-medium text-amber-600">Not Mapped</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!course.mapped_course_id ? (
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              matchCourse(course.lms_id, parseInt(e.target.value));
                            }
                          }}
                          className={`${c.input} px-3 py-1.5 rounded-lg text-sm max-w-xs ml-auto`}
                          defaultValue=""
                        >
                          <option value="">Select local course...</option>
                          {localCourses.map(local => (
                            <option key={local.id} value={local.id}>
                              {local.course_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-xs ${c.mutedText}`}>Mapped</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}