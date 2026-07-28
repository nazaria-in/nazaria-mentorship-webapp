// /lib/notifications/config.ts

/**
 * How far into a meeting's [starts_at, ends_at) window the exit-survey
 * nudge fires. NOT CONFIRMED WITH CLIENT YET — the exit-survey context doc
 * references "80%-elapsed" as the assumed placeholder, so this now matches
 * that rather than the earlier 0.6 guess. Could still end up being 1.0
 * (fires exactly at ends_at). Change this one value once confirmed;
 * nothing else references the number directly.
 *
 * Note: this fires once PER PENDING exit_surveys ROW (a mentor with 2
 * mentees in one meeting has 2 rows, and gets 2 separate reminders), not
 * once per meeting — see lib/notifications/exit-survey-notifications.ts.
 */
export const EXIT_SURVEY_TRIGGER_PERCENT = 0.8;

/** Offsets (ms, negative = before starts_at) for the meeting reminder cascade. */
export const MEETING_REMINDER_OFFSETS_MS = {
  threeDaysBefore: -3 * 24 * 60 * 60 * 1000,
  oneDayBefore: -1 * 24 * 60 * 60 * 1000,
  oneHourBefore: -1 * 60 * 60 * 1000,
} as const;

/** Percent-through-window marks for the assignment reminder cascade. */
export const ASSIGNMENT_REMINDER_PERCENTS = {
  firstDraft: 0.4,
  secondCheck: 0.7,
  finalPresentation: 0.9,
} as const;

/** Max number of overdue nudges sent for a single assignment/exit survey. */
export const MAX_OVERDUE_REMINDERS = 2;

/** Minimum spacing between overdue nudges, so "twice" doesn't mean "back to back". */
export const OVERDUE_REMINDER_SPACING_DAYS = 3;

/** How stale a resource's last update must be before the weekly nudge fires. */
export const RESOURCE_STALE_DAYS = 7;