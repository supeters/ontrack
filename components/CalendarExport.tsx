'use client';

import { useState } from 'react';
import { Calendar, Copy, Check, Info, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function CalendarExport() {
  const { kids } = useAuth();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedKid, setExpandedKid] = useState<number | null>(null);

  const getCalendarUrl = (kidId: number) => {
    // Use the existing Supabase function
    return `https://jfdrzjueqfxvozwcsyhm.supabase.co/functions/v1/ics-feed?kid_id=${kidId}&secret=family-calendar-2025`;
  };

  const copyToClipboard = async (text: string, kidId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(kidId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getWebcalUrl = (kidId: number) => {
    const httpUrl = getCalendarUrl(kidId);
    return httpUrl.replace('https://', 'webcal://');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Calendar Export</h2>
              <p className="text-sm text-gray-600 mt-1">
                Subscribe to live calendar feeds
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="p-6 bg-blue-50 border-b border-blue-100">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-2">How to use calendar feeds:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Copy the calendar URL below</li>
                <li>Open your calendar app (Google Calendar, Apple Calendar, Outlook, etc.)</li>
                <li>Look for &quot;Add Calendar&quot; or &quot;Subscribe to Calendar&quot; option</li>
                <li>Paste the URL and subscribe</li>
                <li>Events will automatically sync as they&apos;re added or updated</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Kids List */}
        <div className="p-6 space-y-4">
          {kids.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No students found.</p>
            </div>
          ) : (
            kids.map(kid => {
              const calendarUrl = getCalendarUrl(kid.id);
              const webcalUrl = getWebcalUrl(kid.id);
              const isExpanded = expandedKid === kid.id;

              return (
                <div
                  key={kid.id}
                  className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {kid.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {kid.name}&apos;s Calendar
                          </h3>
                          <p className="text-sm text-gray-600">
                            Live feed of events and activities
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedKid(isExpanded ? null : kid.id)}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                      >
                        {isExpanded ? 'Hide URLs' : 'Show URLs'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 space-y-4 bg-white">
                      {/* Standard URL */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Calendar Feed URL (ICS)
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={calendarUrl}
                            readOnly
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono text-gray-700"
                          />
                          <button
                            onClick={() => copyToClipboard(calendarUrl, `${kid.id}-ics`)}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            title="Copy URL"
                          >
                            {copiedId === `${kid.id}-ics` ? (
                              <Check className="w-5 h-5" />
                            ) : (
                              <Copy className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Quick Links */}
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-3">
                          Quick Add to:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calendarUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                          >
                            Google Calendar
                          </a>
                          <a
                            href={webcalUrl}
                            className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 transition-colors"
                          >
                            Apple Calendar
                          </a>
                          <a
                            href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(calendarUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-blue-700 text-white text-sm rounded hover:bg-blue-800 transition-colors"
                          >
                            Outlook
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
