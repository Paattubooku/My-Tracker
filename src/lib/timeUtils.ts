/**
 * Timezone and date utility functions for the hydration engine
 */

/**
 * Parse timezone offset string (e.g., "+05:30") to minutes
 */
export function parseTimezoneOffset(offset: string): number {
  const match = offset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid timezone offset format: ${offset}`);
  }

  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);

  return sign * (hours * 60 + minutes);
}

/**
 * Get current UTC time in milliseconds
 */
export function getCurrentUTC(): Date {
  return new Date();
}

/**
 * Convert UTC Date to local Date using timezone offset
 */
export function toLocalTime(utcDate: Date, timezoneOffset: string): Date {
  const offsetMinutes = parseTimezoneOffset(timezoneOffset);
  const localTime = new Date(utcDate.getTime() + offsetMinutes * 60 * 1000);
  return localTime;
}

/**
 * Format a Date to HH:MM string
 */
export function formatTime(date: Date): string {
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Get current time as HH:MM string
 */
export function getCurrentTimeFormatted(localDate: Date): string {
  return `${localDate.getUTCHours().toString().padStart(2, '0')}:${localDate.getUTCMinutes().toString().padStart(2, '0')}`;
}

/**
 * Parse HH:MM string to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Format Date to YYYY-MM-DD string
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayISO(): string {
  return formatDateISO(new Date());
}

/**
 * Check if current local time is within waking hours
 */
export function isWithinWakingHours(
  currentLocalTime: Date,
  wakeTime: string,
  sleepTime: string
): boolean {
  const currentMinutes = timeToMinutes(formatTime(currentLocalTime));
  const wakeMinutes = timeToMinutes(wakeTime);
  const sleepMinutes = timeToMinutes(sleepTime);

  // Handle overnight wake/sleep (e.g., wake 06:00, sleep 22:00)
  if (wakeMinutes < sleepMinutes) {
    return currentMinutes >= wakeMinutes && currentMinutes < sleepMinutes;
  }
  // Handle overnight (e.g., wake 22:00, sleep 06:00)
  return currentMinutes >= wakeMinutes || currentMinutes < sleepMinutes;
}

/**
 * Calculate elapsed minutes since wake time
 */
export function calculateElapsedMinutes(currentLocalTime: Date, wakeTime: string): number {
  const currentMinutes = timeToMinutes(formatTime(currentLocalTime));
  const wakeMinutes = timeToMinutes(wakeTime);

  let elapsed = currentMinutes - wakeMinutes;
  if (elapsed < 0) {
    elapsed += 24 * 60; // Handle if current time is after midnight but before wake time
  }

  return elapsed;
}

/**
 * Calculate total waking minutes from wake time to sleep time
 */
export function calculateTotalWakingMinutes(wakeTime: string, sleepTime: string): number {
  const wakeMinutes = timeToMinutes(wakeTime);
  const sleepMinutes = timeToMinutes(sleepTime);

  let total = sleepMinutes - wakeMinutes;
  if (total <= 0) {
    total += 24 * 60; // Handle overnight
  }

  return total;
}

/**
 * Calculate minutes between two UTC timestamps
 */
export function minutesBetween(date1: Date, date2: Date): number {
  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  return diffMs / (60 * 1000);
}

/**
 * Get an array of date strings for the past N days
 */
export function getPastDaysArray(days: number): string[] {
  const dates: string[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    dates.push(formatDateISO(date));
  }

  return dates;
}
