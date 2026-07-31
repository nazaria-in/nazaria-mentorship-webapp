// /lib/notifications/exit-survey-notifications.ts

import { createNotification, cancelPendingNotifications } from "@/lib/api/notifications";
import { EXIT_SURVEY_TRIGGER_PERCENT } from "@/lib/notifications/config";
import { NotificationsClient } from "@/types/notifications";

export interface PendingExitSurveyRow {
  exitSurveyId: string;
  /** The submitter — mentee for their own row, mentor for a mentor<->mentee row. */
  submitterUserId: string;
  meetingTitle: string;
}

export interface MeetingWindow {
  startsAt: string;
  endsAt: string;
}

/**
 * Schedules one submission-reminder notification per pending exit_surveys
 * row, at EXIT_SURVEY_TRIGGER_PERCENT through the meeting window. Call
 * this once, right after createPendingExitSurveys() inserts the rows for
 * a newly created meeting — pass it exactly the rows that function just
 * created (id + submitter + meeting title), so this never has to re-derive
 * who owes what survey.
 *
 * Each row gets its OWN notification with its OWN exit_survey_id — a
 * mentor with 2 mentees in one meeting gets 2 separate reminders, one per
 * mentee's survey, because those are 2 separate exit_surveys rows they
 * each need to fill in independently.
 *
 * CLAMPED, NOT SKIPPED: earlier versions of this function early-returned
 * entirely if the computed trigger time had already passed by the time
 * this ran. In practice, meeting creation involves several sequential
 * awaited steps before this function is even reached (Calendar event
 * creation, per-participant invite + reminder scheduling, exit-survey
 * provisioning) — for short meetings (test meetings especially, but real
 * short check-ins too) that processing time alone can exceed the trigger
 * window, silently producing zero reminders with no error anywhere. Now
 * clamped to "now" instead: if the intended trigger has already passed,
 * the reminder still gets created, just scheduled immediately rather than
 * abandoned.
 */
export async function scheduleExitSurveyReminders(
  supabase: NotificationsClient,
  rows: PendingExitSurveyRow[],
  meetingWindow: MeetingWindow
): Promise<void> {
  const startsAtMs = new Date(meetingWindow.startsAt).getTime();
  const endsAtMs = new Date(meetingWindow.endsAt).getTime();
  const triggerMs = startsAtMs + EXIT_SURVEY_TRIGGER_PERCENT * (endsAtMs - startsAtMs);
  const scheduledFor = new Date(Math.max(triggerMs, Date.now()));

  for (const row of rows) {
    await createNotification(supabase, {
      createdBy: null,
      type: "exit_survey_pending",
      title: `Exit survey — ${row.meetingTitle}`,
      body: "Please fill out your exit survey.",
      recipientUserIds: [row.submitterUserId],
      scheduledFor,
      exitSurveyId: row.exitSurveyId,
    });
  }
}

/**
 * Call from submitExitSurvey right after the UPDATE sets submitted_at —
 * cancels that row's still-pending reminder (no point nudging someone
 * about a form they just filled in) and alerts staff, WITH the
 * user_notifications fan-out (the earlier draft only inserted the
 * notifications row and never fanned out — nobody actually received it
 * under the per-recipient model; this fixes that).
 */
export async function onExitSurveySubmitted(
  supabase: NotificationsClient,
  input: {
    exitSurveyId: string;
    meetingId: string;
    meetingTitle: string;
    submitterUserId: string;
    submitterRole: "mentor" | "mentee";
    signal: "green" | "yellow" | "red";
    staffUserIds: string[];
  }
): Promise<void> {
  await cancelPendingNotifications(supabase, {
    meetingId: input.meetingId,
    userId: input.submitterUserId,
  });

  if (input.staffUserIds.length === 0) return; // no approved pm/associate to notify — shouldn't happen, but don't throw over it

  await createNotification(supabase, {
    createdBy: input.submitterUserId,
    type: "exit_survey_pending",
    title: `Exit survey submitted — ${input.meetingTitle}`,
    body: `${input.submitterRole} survey submitted — signal: ${input.signal}`,
    recipientUserIds: input.staffUserIds,
    exitSurveyId: input.exitSurveyId,
  });
}

/**
 * Daily sweep helper (called from the daily-sweeps edge function's
 * corresponding raw-SQL version, kept here as the canonical reference for
 * what that query does): find exit_surveys rows still pending
 * (submitted_at IS NULL) whose meeting has ended, and where fewer than
 * MAX_OVERDUE_REMINDERS overdue nudges have been sent so far.
 * The edge function reimplements this in raw Supabase calls (Deno can't
 * import this Next.js-aliased file directly) — keep the two in sync if
 * this logic changes.
 */
export const OVERDUE_EXIT_SURVEY_QUERY_NOTE =
  "See supabase/functions/daily-sweeps/index.ts — exit_surveys WHERE submitted_at IS NULL AND meeting.ends_at < now(), capped by MAX_OVERDUE_REMINDERS.";