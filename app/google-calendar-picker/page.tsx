'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, CheckCircle2, Loader2 } from 'lucide-react';

function CalendarPickerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const kidId = searchParams.get('kidId');

  const [calendars, setCalendars] = useState<any[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [refreshToken, setRefreshToken] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
        const loadCalendars = async () => {
          if (!kidId) {
            setError('Missing kid ID. Please try syncing again.');
            setLoading(false);
            return;
          }

          try {
            // Fetch calendar list from the temporary storage
            const response = await fetch(`/api/auth/google/calendar-list?kidId=${kidId}`);
            const data = await response.json();

            if (!response.ok || !data.calendars) {
              throw new Error(data.error || 'Failed to load calendars');
            }

            setCalendars(data.calendars);
            setAccessToken(data.accessToken);
            setRefreshToken(data.refreshToken);
            setExpiresAt(data.expiresAt);

            // Auto-select primary calendar
            const primaryCal = data.calendars.find((cal: any) => cal.primary);
            if (primaryCal) {
              setSelectedCalendarId(primaryCal.id);
            } else if (data.calendars.length > 0) {
              setSelectedCalendarId(data.calendars[0].id);
            }
          } catch (err: any) {
            console.error('Error loading calendars:', err);
            setError(err.message || 'Failed to load calendars. Please try again.');
          } finally {
            setLoading(false);
          }
        };

        loadCalendars();
      }, [kidId]);
  const handleSaveSelection = async () => {
    if (!selectedCalendarId || !kidId || !accessToken || !refreshToken || !expiresAt) return;

    try {
      setSaving(true);

      const selectedCalendar = calendars.find(cal => cal.id === selectedCalendarId);
      if (!selectedCalendar) throw new Error('Calendar not found');

      const response = await fetch('/api/auth/google/select-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kidId,
          calendarId: selectedCalendarId,
          calendarName: selectedCalendar.summary,
          accessToken,
          refreshToken,
          expiresAt,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save calendar selection');
      }

      // Redirect back to dashboard
      router.push(`/?calendar_status=connected&kidId=${kidId}`);
    } catch (err: any) {
      console.error('Error saving calendar selection:', err);
      setError(err.message || 'Failed to save. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 mb-4 mx-auto text-indigo-600 w-12" />
          <p className="text-gray-600">Loading your calendars...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 flex items-center justify-center min-h-screen p-4">
        <div className="bg-white max-w-md p-6 rounded-xl shadow-lg text-center w-full">
          <div className="bg-red-100 flex h-16 items-center justify-center mb-4 mx-auto p-3 rounded-full w-16">
            <span className="text-2xl text-red-600">✕</span>
          </div>
          <h2 className="font-semibold mb-2 text-gray-900 text-xl">Error</h2>
          <p className="mb-4 text-gray-600">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-white transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 flex items-center justify-center min-h-screen p-4">
      <div className="bg-white max-w-2xl p-6 rounded-xl shadow-lg w-full">
        <div className="flex gap-3 items-center mb-6">
          <div className="bg-indigo-100 p-3 rounded-full">
            <Calendar className="h-6 text-indigo-600 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-2xl text-gray-900">Select Google Calendar</h1>
            <p className="text-gray-600 text-sm">Choose which calendar to sync with OnTrack</p>
          </div>
        </div>

        {calendars.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-600">No calendars found in your Google account.</p>
            <button
              onClick={() => router.push('/')}
              className="bg-gray-200 hover:bg-gray-300 mt-4 px-4 py-2 rounded-lg text-gray-700 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <>
            <div className="max-h-96 mb-6 overflow-y-auto space-y-3">
              {calendars.map((calendar) => (
                <label
                  key={calendar.id}
                  className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedCalendarId === calendar.id
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="calendar"
                    value={calendar.id}
                    checked={selectedCalendarId === calendar.id}
                    onChange={(e) => setSelectedCalendarId(e.target.value)}
                    className="focus:ring-indigo-500 h-4 mt-1 text-indigo-600 w-4"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-2 items-center">
                      <p className="font-semibold text-gray-900">{calendar.summary}</p>
                      {calendar.primary && (
                        <span className="bg-indigo-100 font-medium px-2 py-0.5 rounded-full text-indigo-700 text-xs">
                          Primary
                        </span>
                      )}
                    </div>
                    {calendar.description && (
                      <p className="mt-1 text-gray-600 text-sm">{calendar.description}</p>
                    )}
                    <p className="mt-1 text-gray-500 text-xs">{calendar.id}</p>
                  </div>
                  {selectedCalendarId === calendar.id && (
                    <CheckCircle2 className="flex-shrink-0 h-5 mt-0.5 text-indigo-600 w-5" />
                  )}
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push('/')}
                disabled={saving}
                className="bg-gray-200 disabled:opacity-50 flex-1 font-medium hover:bg-gray-300 px-4 py-3 rounded-lg text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSelection}
                disabled={!selectedCalendarId || saving}
                className="bg-indigo-600 disabled:opacity-50 flex flex-1 font-medium gap-2 hover:bg-indigo-700 items-center justify-center px-4 py-3 rounded-lg text-white transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" />
                    Connecting...
                  </>
                ) : (
                  'Connect Calendar'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CalendarPickerPage() {
  return (
    <Suspense fallback={
      <div className="bg-gray-50 flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-12 text-indigo-600 w-12" />
      </div>
    }>
      <CalendarPickerContent />
    </Suspense>
  );
}
