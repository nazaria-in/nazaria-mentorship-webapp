// /lib/api/exit-surveys.ts

import { createClient } from "@/lib/supabase/client";
import { isValidExitSurveyEntry } from "@/types/exit-survey";
import type { ExitSurveyRow, ExitSurveySubmission } from "@/types/exit-survey";

/**
 * Fills in an already-existing pending exit_surveys row (created at meeting
 * creation time — see /app/api/meetings/route.ts). This is an UPDATE, not
 * an insert: the row's id, meeting_id, user_id, subject_user_id, and
 * template_snapshot are already set. Also notifies PM/associate that a
 * survey was submitted. The mentee "anything else" → pod chat action-item
 * behavior has been removed; nothing here writes to notifications.action_items.
 */
export async function submitExitSurvey(submission: ExitSurveySubmission): Promise<ExitSurveyRow> {
  if (!submission.answers.every(isValidExitSurveyEntry)) {
    throw new Error("Malformed exit survey answers — refusing to submit.");
  }

  const supabase = createClient();

  const { data: surveyRow, error: updateError } = await supabase
    .from("exit_surveys")
    .update({
      answers: submission.answers,
      signal: submission.signal,
      transcript: submission.transcript ?? null,
      ai_summary: submission.aiSummary ?? null,
      concern_tags: submission.concernTags ?? [],
      needs_follow_up: submission.needsFollowUp ?? false,
      follow_up_urgency: submission.followUpUrgency ?? "none",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", submission.exitSurveyId)
    .select()
    .single();

  if (updateError || !surveyRow) {
    throw new Error(updateError?.message ?? "Failed to submit exit survey.");
  }

  const { error: notifyError } = await supabase.from("notifications").insert({
    type: "exit_survey_pending",
    title: "Exit survey submitted",
    body: `${surveyRow.user_role} exit survey submitted — signal: ${submission.signal}`,
    meeting_id: surveyRow.meeting_id as string,
    exit_survey_id: surveyRow.id as string,
  });

  if (notifyError) {
    // Survey itself is saved; surface the notification failure separately
    // rather than rolling back a successful submission over a side-effect.
    throw new Error(`Survey saved, but notifying staff failed: ${notifyError.message}`);
  }

  return mapExitSurveyRow(surveyRow);
}

export async function getExitSurveyById(exitSurveyId: string): Promise<ExitSurveyRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exit_surveys")
    .select()
    .eq("id", exitSurveyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapExitSurveyRow(data) : null;
}

/**
 * All exit survey rows (pending and submitted) for a given meeting — used
 * on the meeting detail page for staff, who see every mentor/mentee pair,
 * not just their own.
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
 * Recent SUBMITTED exit surveys across all meetings, for the PM/associate
 * dashboard widget. Sorted so urgent follow-ups and red/yellow signals are
 * easy to scan first without opening each row.
 */
export async function getRecentExitSurveysForStaff(limit = 20): Promise<ExitSurveyRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exit_surveys")
    .select()
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const signalWeight: Record<string, number> = { red: 0, yellow: 1, green: 2 };
  const urgencyWeight: Record<string, number> = { urgent: 0, soon: 1, none: 2 };

  return (data ?? [])
    .map(mapExitSurveyRow)
    .sort((a, b) => {
      const urgencyDiff = urgencyWeight[a.followUpUrgency] - urgencyWeight[b.followUpUrgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return signalWeight[a.signal ?? "green"] - signalWeight[b.signal ?? "green"];
    });
}

/**
 * Pending (unsubmitted) exit survey rows for a user — backed by
 * v_pending_exit_surveys. Includes the subject's name so a mentor with
 * multiple mentees can tell the rows apart in the list.
 */
export interface PendingExitSurvey {
  exitSurveyId: string;
  meetingId: string;
  subjectUserId: string;
  subjectFullName: string | null;
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
    exitSurveyId: row.exit_survey_id as string,
    meetingId: row.meeting_id as string,
    subjectUserId: row.subject_user_id as string,
    subjectFullName: (row.subject_full_name as string) ?? null,
    title: row.title as string,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    meetingStatus: row.meeting_status as string,
  }));
}

import { applyFilters } from "@/lib/filtering/apply-filters";
import { applySort } from "@/lib/filtering/apply-sort";
import { EXIT_SURVEY_STAFF_FIELD_DEFS } from "@/lib/filtering/exit-survey-fields";
import type { FilterState, SortState } from "@/lib/filtering/types";

/** Enriched row with human-readable names for the staff report view/table. */
export interface ExitSurveyDetail extends ExitSurveyRow {
  meetingTitle: string;
  submitterFullName: string | null;
  subjectFullName: string | null;
}

const STAFF_SELECT = `*,
  meeting:meetings(title),
  submitter:users!exit_surveys_user_id_fkey(full_name),
  subject:users!exit_surveys_subject_user_id_fkey(full_name)`;

/**
 * Full detail for the /exit-survey/[exitSurveyId] report view — used by
 * both the fill flow (own pending row) and the staff full-report view.
 * NOTE: the two embedded FK names (exit_surveys_user_id_fkey,
 * exit_surveys_subject_user_id_fkey) are Postgres's default auto-generated
 * names from migration 0005's `references` clauses — verify these match in
 * Supabase if this select errors, and adjust here if they don't.
 */
export async function getExitSurveyDetailById(exitSurveyId: string): Promise<ExitSurveyDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exit_surveys")
    .select(STAFF_SELECT)
    .eq("id", exitSurveyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapExitSurveyDetailRow(data as Record<string, unknown>) : null;
}

/** Filtered/sorted submitted surveys for the staff dashboard table. */
export async function fetchExitSurveysForStaff(
  filterState: FilterState,
  sortState: SortState
): Promise<ExitSurveyDetail[]> {
  const supabase = createClient();
  let query = supabase.from("exit_surveys").select(STAFF_SELECT).not("submitted_at", "is", null);
  query = applyFilters(query, EXIT_SURVEY_STAFF_FIELD_DEFS, filterState);
  query = applySort(query, EXIT_SURVEY_STAFF_FIELD_DEFS, sortState);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapExitSurveyDetailRow(row as Record<string, unknown>));
}

/**
 * Escalations panel: submitted, needs_follow_up, urgency soon/urgent —
 * shown above the filtered table, not subject to whatever filters are set
 * there, so an urgent case is never accidentally filtered out of view.
 */
export async function fetchExitSurveyEscalations(): Promise<ExitSurveyDetail[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exit_surveys")
    .select(STAFF_SELECT)
    .not("submitted_at", "is", null)
    .eq("needs_follow_up", true)
    .in("follow_up_urgency", ["soon", "urgent"])
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(error.message);

  const urgencyWeight: Record<string, number> = { urgent: 0, soon: 1, none: 2 };
  return (data ?? [])
    .map((row) => mapExitSurveyDetailRow(row as Record<string, unknown>))
    .sort((a, b) => urgencyWeight[a.followUpUrgency] - urgencyWeight[b.followUpUrgency]);
}

/** A user's own submission history — for their view of "surveys I've filled out." */
export async function fetchSubmittedExitSurveysForUser(userId: string): Promise<ExitSurveyRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exit_surveys")
    .select()
    .eq("user_id", userId)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapExitSurveyRow);
}

function mapExitSurveyDetailRow(row: Record<string, unknown>): ExitSurveyDetail {
  const meeting = row.meeting as { title: string } | null;
  const submitter = row.submitter as { full_name: string | null } | null;
  const subject = row.subject as { full_name: string | null } | null;

  return {
    ...mapExitSurveyRow(row),
    meetingTitle: meeting?.title ?? "Untitled meeting",
    submitterFullName: submitter?.full_name ?? null,
    subjectFullName: subject?.full_name ?? null,
  };
}

function mapExitSurveyRow(row: Record<string, unknown>): ExitSurveyRow {
  return {
    id: row.id as string,
    meetingId: row.meeting_id as string,
    userId: row.user_id as string,
    subjectUserId: row.subject_user_id as string,
    userRole: row.user_role as ExitSurveyRow["userRole"],
    templateId: (row.template_id as string) ?? null,
    templateSnapshot: (row.template_snapshot as ExitSurveyRow["templateSnapshot"]) ?? [],
    answers: (row.answers as ExitSurveyRow["answers"]) ?? null,
    signal: (row.signal as ExitSurveyRow["signal"]) ?? null,
    transcript: (row.transcript as string) ?? null,
    aiSummary: (row.ai_summary as string) ?? null,
    concernTags: (row.concern_tags as ExitSurveyRow["concernTags"]) ?? [],
    needsFollowUp: (row.needs_follow_up as boolean) ?? false,
    followUpUrgency: (row.follow_up_urgency as ExitSurveyRow["followUpUrgency"]) ?? "none",
    createdAt: row.created_at as string,
    submittedAt: (row.submitted_at as string) ?? null,
  };
}