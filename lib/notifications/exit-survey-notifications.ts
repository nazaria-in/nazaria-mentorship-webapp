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
 * ADDED: fires once per pending exit_surveys row, scheduled for the
 * meeting's ends_at (clamped to "now" for the same reason as the
 * 80% reminder above — a meeting whose ends_at has already passed by
 * the time this runs, e.g. a backfilled/late-created survey row, should
 * still get an overdue notice rather than silently getting none).
 *
 * No manual cancellation needed on submit: v_visible_user_notifications
 * suppresses this at read time once exit_surveys.submitted_at is set for
 * that row's user_id, so there's nothing to clean up here the way the
 * meeting reminder cascade needs cancelPendingNotifications.
 */
export async function scheduleExitSurveyOverdueReminder(
  supabase: NotificationsClient,
  row: PendingExitSurveyRow,
  meetingEndsAt: string
): Promise<void> {
  const scheduledForMs = Math.max(new Date(meetingEndsAt).getTime(), Date.now());
  await createNotification(supabase, {
    createdBy: null,
    type: "exit_survey_pending",
    title: `${row.meetingTitle} — exit survey overdue`,
    body: "This exit survey is now overdue.",
    recipientUserIds: [row.submitterUserId],
    scheduledFor: new Date(scheduledForMs),
    exitSurveyId: row.exitSurveyId,
  });
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