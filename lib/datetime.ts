/**
 * Utility functions for handling dates and times
 * Solves timezone issues where timestamp without timezone from PostgreSQL
 * is incorrectly parsed as UTC by JavaScript
 */

/**
 * Parse a timestamp string from database as local time (not UTC)
 * Database format: "2026-05-05 10:00:00" or "2026-05-05T10:00:00"
 * Returns: { date: Date, hour: number, minute: number, dateStr: string, timeStr: string }
 */
export function parseLocalTimestamp(timestamp: string | null | undefined): {
  date: Date | null;
  hour: number;
  minute: number;
  dateStr: string;
  timeStr: string;
} {
  if (!timestamp || typeof timestamp !== 'string' || !timestamp.trim()) {
    return { date: null, hour: 0, minute: 0, dateStr: '', timeStr: '' };
  }

  const cleanStr = timestamp.trim();

  // 1. Try standard JS Date parsing directly (handles "8/18/2026, 3:05:14 PM", "2026-08-18T15:05:14", etc.)
  const directDate = new Date(cleanStr);
  if (!isNaN(directDate.getTime()) && directDate.getFullYear() > 2020) {
    return {
      date: directDate,
      hour: directDate.getHours(),
      minute: directDate.getMinutes(),
      dateStr: directDate.toISOString().split('T')[0],
      timeStr: directDate.toTimeString().split(' ')[0],
    };
  }

  // 2. Fallback for space-separated "YYYY-MM-DD HH:mm:ss" strings where new Date() might fail cross-browser
  if (cleanStr.includes('-')) {
    const normalizedStr = cleanStr.replace(' ', 'T');
    const fallbackDate = new Date(normalizedStr);
    
    if (!isNaN(fallbackDate.getTime()) && fallbackDate.getFullYear() > 2020) {
      return {
        date: fallbackDate,
        hour: fallbackDate.getHours(),
        minute: fallbackDate.getMinutes(),
        dateStr: fallbackDate.toISOString().split('T')[0],
        timeStr: fallbackDate.toTimeString().split(' ')[0],
      };
    }
  }

  // If parsing fails completely, return null cleanly instead of an epoch date
  return { date: null, hour: 0, minute: 0, dateStr: '', timeStr: '' };
}

/**
 * Format time as 12-hour format (e.g., "2:30 PM")
 */
export function formatTime12Hour(timestamp: string | null | undefined): string {
  const parsed = parseLocalTimestamp(timestamp);
  if (!parsed.date) return '';

  const hour12 = parsed.hour === 0 ? 12 : parsed.hour > 12 ? parsed.hour - 12 : parsed.hour;
  const minute = parsed.minute.toString().padStart(2, '0');
  const ampm = parsed.hour >= 12 ? 'PM' : 'AM';

  return `${hour12}:${minute} ${ampm}`;
}

/**
 * Format time as 24-hour format (e.g., "14:30")
 */
export function formatTime24Hour(timestamp: string | null | undefined): string {
  const parsed = parseLocalTimestamp(timestamp);
  if (!parsed.date) return '';

  const hour = parsed.hour.toString().padStart(2, '0');
  const minute = parsed.minute.toString().padStart(2, '0');

  return `${hour}:${minute}`;
}

/**
 * Get the hour from a timestamp (0-23)
 */
export function getHour(timestamp: string | null | undefined): number {
  return parseLocalTimestamp(timestamp).hour;
}

/**
 * Get the date part from a timestamp (YYYY-MM-DD)
 */
export function getDateStr(timestamp: string | null | undefined): string {
  return parseLocalTimestamp(timestamp).dateStr;
}

/**
 * Format date as "Mon, May 5"
 */
export function formatDateShort(dateStr: string): string {
  const parsed = parseLocalTimestamp(`${dateStr} 00:00:00`);
  if (!parsed.date) return '';

  return parsed.date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a Date object as YYYY-MM-DD in local timezone (not UTC)
 * This avoids the timezone shift that happens with date.toISOString()
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Create a timestamp for database storage from date and time strings
 * Formats as "YYYY-MM-DD HH:MM:SS" in local timezone (not UTC)
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timeStr - Time string in HH:MM or HH:MM:SS format
 * @returns Timestamp string for PostgreSQL "timestamp without time zone" column
 */
export function createLocalTimestamp(dateStr: string, timeStr: string): string {
  const [hours, minutes, seconds = '00'] = timeStr.split(':');
  return `${dateStr} ${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
}

/**
 * Format a Date object as "YYYY-MM-DD HH:MM:SS" in local timezone
 * Use this when storing timestamps in database to avoid timezone conversion
 */
export function formatTimestampLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}
