// /lib/api/exit-surveys.ts

import { createClient } from "@/lib/supabase/client";
import { MENTEE_ACTION_ITEM_QUESTION } from "@/lib/exit-survey/templates";
import { isValidExitSurveyEntry } from "@/types/exit-survey";
import type { ExitSurveyRow, ExitSurveySubmission } from "@/types/exit-survey";

/**
 * Inserts the exit survey, then fans out notifications:
 *  - PM/associate get an `exit_survey_pending` notification with
 *    exit_survey_id set (submitted, ready to review) — see migration note
 *    on why this reuses that type instead of a new enum value.
 *  - If the submitter is a mentee and answered the "anything else" question,
 *    that text is copied into notifications.action_items so the existing
 *    pod-messages pipeline can pick it up downstream.
 */
export async function submitExitSurvey(
  submission: ExitSurveySubmission
): Promise<ExitSurveyRow> {
  if (!submission.answers.every(isValidExitSurveyEntry)) {
    throw new Error("Malformed exit survey answers — refusing to submit.");
  }

  const supabase = createClient();

  const { data: surveyRow, error: insertError } = await supabase
    .from("exit_surveys")
    .insert({
      meeting_id: submission.meetingId,
      user_id: submission.userId,
      user_role: submission.userRole,
      answers: submission.answers,
      signal: submission.signal,
      transcript: submission.transcript ?? null,
      ai_summary: submission.aiSummary ?? null,
      concern_tags: submission.concernTags ?? [],
      needs_follow_up: submission.needsFollowUp ?? false,
      follow_up_urgency: submission.followUpUrgency ?? "none",
    })
    .select()
    .single();

  if (insertError || !surveyRow) {
    throw new Error(insertError?.message ?? "Failed to insert exit survey.");
  }

  const actionItemEntry = submission.answers.find(
    (entry) => entry.question === MENTEE_ACTION_ITEM_QUESTION && entry.type === "short_answer"
  );
  const actionItemText =
    submission.userRole === "mentee" &&
    actionItemEntry?.type === "short_answer" &&
    actionItemEntry.selected.trim().length > 0
      ? actionItemEntry.selected.trim()
      : null;

  const { error: notifyError } = await supabase.from("notifications").insert({
    type: "exit_survey_pending",
    title: "Exit survey submitted",
    body: `${submission.userRole} exit survey submitted — signal: ${submission.signal}`,
    meeting_id: submission.meetingId,
    exit_survey_id: surveyRow.id as string,
    action_items: actionItemText,
  });

  if (notifyError) {
    // Survey itself is saved; surface the notification failure separately
    // rather than rolling back a successful submission over a side-effect.
    throw new Error(`Survey saved, but notifying staff failed: ${notifyError.message}`);
  }

  return mapExitSurveyRow(surveyRow);
}

/**
 * Used by the meeting detail page to show submitted-vs-pending state per
 * attendee. Returns null if this user hasn't submitted for this meeting yet.
 */
export async function getExitSurveyForMeetingAndUser(
  meetingId: string,
  userId: string
): Promise<ExitSurveyRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exit_surveys")
    .select()
    .eq("meeting_id", meetingId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapExitSurveyRow(data) : null;
}

/**
 * All exit surveys submitted for a given meeting — used on the meeting
 * detail page for staff, who see everyone's submission (not just their own).
 */
export async function getExitSurveysForMeeting(meetingId: string): Promise<ExitSurveyRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exit_surveys")
    .select()
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapExitSurveyRow);
}

/**
 * Recent exit surveys across all meetings, for the PM/associate dashboard
 * widget. Sorted so urgent follow-ups and red/yellow signals are easy to
 * scan first without opening each row.
 */
export async function getRecentExitSurveysForStaff(limit = 20): Promise<ExitSurveyRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exit_surveys")
    .select()
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const signalWeight: Record<ExitSurveyRow["signal"], number> = { red: 0, yellow: 1, green: 2 };
  const urgencyWeight: Record<ExitSurveyRow["followUpUrgency"], number> = { urgent: 0, soon: 1, none: 2 };

  return (data ?? [])
    .map(mapExitSurveyRow)
    .sort((a, b) => {
      const urgencyDiff = urgencyWeight[a.followUpUrgency] - urgencyWeight[b.followUpUrgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return signalWeight[a.signal] - signalWeight[b.signal];
    });
}

/**
 * Meetings this user still needs to fill an exit survey for. Backed by
 * v_pending_exit_surveys — drives the "what do I need to fill in" list
 * on the exit survey demo page (and later, a real dashboard widget).
 */
export interface PendingExitSurvey {
  meetingId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetingStatus: string;
}

export async function fetchPendingExitSurveys(userId: string): Promise<PendingExitSurvey[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_pending_exit_surveys")
    .select()
    .eq("user_id", userId)
    .order("starts_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    meetingId: row.meeting_id as string,
    title: row.title as string,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    meetingStatus: row.meeting_status as string,
  }));
}

function mapExitSurveyRow(row: Record<string, unknown>): ExitSurveyRow {
  return {
    id: row.id as string,
    meetingId: row.meeting_id as string,
    userId: row.user_id as string,
    userRole: row.user_role as ExitSurveyRow["userRole"],
    answers: row.answers as ExitSurveyRow["answers"],
    signal: row.signal as ExitSurveyRow["signal"],
    transcript: (row.transcript as string) ?? null,
    aiSummary: (row.ai_summary as string) ?? null,
    concernTags: (row.concern_tags as ExitSurveyRow["concernTags"]) ?? [],
    needsFollowUp: (row.needs_follow_up as boolean) ?? false,
    followUpUrgency: (row.follow_up_urgency as ExitSurveyRow["followUpUrgency"]) ?? "none",
    createdAt: row.created_at as string,
  };
}