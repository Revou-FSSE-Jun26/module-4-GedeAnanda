/** Date formatting with a fixed locale and time zone, so server and browser render the same text. */

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** `2026-12-31` or an ISO timestamp → `31 Dec 2026`. */
export function formatDate(value: string): string {
  return DAY.format(new Date(value));
}

/** True when a `YYYY-MM-DD` due date is before today (UTC). */
export function isOverdue(dueDate: string, now: Date = new Date()): boolean {
  return dueDate < now.toISOString().slice(0, 10);
}

/**
 * Whether a record was changed after it was created. The API stamps
 * `created_at` and `updated_at` separately, a few microseconds apart, so a
 * difference under a second still means "never edited".
 */
export function wasEdited(createdAt: string, updatedAt: string): boolean {
  return Date.parse(updatedAt) - Date.parse(createdAt) > 1000;
}
