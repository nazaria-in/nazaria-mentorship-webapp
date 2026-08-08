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

// ---------------------------------------------------------------------------
// ADDED — content_items reminder cascade (lib/notifications/content-notifications.ts).
// Everything above this line is unchanged from the existing file.
// ---------------------------------------------------------------------------

/**
 * Percent-through-window marks for the REQUIRED-submission content
 * reminder cascade (submission_starts_at → submission_ends_at). Same
 * 40/70/90 marks as the old per-assignment cascade
 * (ASSIGNMENT_REMINDER_PERCENTS above, kept as-is since other code may
 * still reference it) — reused here under a content-model-scoped name so
 * the two aren't accidentally conflated later if they ever diverge.
 * NOTE: only fortyPercent/seventyPercent are currently wired into
 * scheduleContentDeadlineReminders — ninetyPercent is defined for parity
 * with ASSIGNMENT_REMINDER_PERCENTS but not yet used by that cascade
 * (it fires an "overdue" notification at 100% instead).
 */
export const CONTENT_REMINDER_PERCENTS = {
  fortyPercent: 0.4,
  seventyPercent: 0.7,
  ninetyPercent: 0.9,
} as const;

/**
 * Percent-through-window marks for the exit-survey reminder cascade
 * (meeting starts_at → ends_at). eightyPercent is DERIVED from
 * EXIT_SURVEY_TRIGGER_PERCENT above rather than a second literal — the
 * original draft of this constant hardcoded 0.8 separately with a comment
 * claiming equality, which would have silently drifted the moment
 * EXIT_SURVEY_TRIGGER_PERCENT got confirmed to a different value. Now
 * there is exactly one source of truth for that number.
 */
export const EXIT_SURVEY_REMINDER_PERCENTS = {
  fiftyPercent: 0.5,
  eightyPercent: EXIT_SURVEY_TRIGGER_PERCENT,
} as const;

/**
 * When a content_item's submission_starts_at is a bare date (midnight,
 * from the date-only picker in ContentItemFormModal) rather than a real
 * time-of-day, the first reminder fires at this hour UTC instead of at
 * midnight. "Let's say 9am for everything that doesn't have time" — your
 * words; change this one value if 9am UTC isn't the right anchor for your
 * users' actual timezone distribution.
 */
export const CONTENT_REMINDER_START_HOUR_UTC = 9;