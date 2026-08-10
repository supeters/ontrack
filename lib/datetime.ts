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
  if (!timestamp) {
    return { date: null, hour: 0, minute: 0, dateStr: '', timeStr: '' };
  }

  // Split into date and time parts
  const parts = timestamp.includes('T')
    ? timestamp.split('T')
    : timestamp.includes(' ')
    ? timestamp.split(' ')
    : [timestamp, '00:00:00'];

  const [datePart, timePart] = parts;

  // Parse time
  const timeComponents = timePart.split(':');
  const hour = parseInt(timeComponents[0] || '0');
  const minute = parseInt(timeComponents[1] || '0');
  const second = parseInt(timeComponents[2]?.split('.')[0] || '0');

  // Parse date
  const dateComponents = datePart.split('-');
  const year = parseInt(dateComponents[0]);
  const month = parseInt(dateComponents[1]) - 1; // JavaScript months are 0-indexed
  const day = parseInt(dateComponents[2]);

  // Create Date object in local timezone (not UTC)
  const date = new Date(year, month, day, hour, minute, second);

  return {
    date,
    hour,
    minute,
    dateStr: datePart,
    timeStr: timePart,
  };
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
