// /lib/api/exit-surveys.ts

import { createClient } from "@/lib/supabase/client";
import { isValidExitSurveyEntry } from "@/types/exit-survey";
import { applyFilters } from "@/lib/filtering/apply-filters";
import { applySort } from "@/lib/filtering/apply-sort";
import { EXIT_SURVEY_STAFF_FIELD_DEFS } from "@/lib/filtering/exit-survey-fields";
import type { FilterState, SortState } from "@/lib/filtering/types";
import type { ExitSurveyRow, ExitSurveySubmission } from "@/types/exit-survey";

/** Enriched row with human-readable names + pod/mentor context for staff views. */
export interface ExitSurveyDetail extends ExitSurveyRow {
  meetingTitle: string;
  submitterFullName: string | null;
  subjectFullName: string | null;
  podId: string | null;
  podName: string | null;
  mentorNames: string[];
}

const STAFF_SELECT = `*,
  meeting:meetings(title),
  submitter:users!exit_surveys_user_id_fkey(full_name),
  subject:users!exit_surveys_subject_user_id_fkey(full_name)`;

/**
 * Fills in an already-existing pending row. AI fields are computed and
 * stored here but never shown back to the submitter — see
 * ExitSurveyReportView's `redacted` prop, which is what actually enforces
 * that (this function has no opinion on visibility, just persistence).
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
      ai_headline: submission.aiHeadline ?? null,
      ai_key_points: submission.aiKeyPoints ?? [],
      sentiment: submission.sentiment ?? null,
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
    throw new Error(`Survey saved, but notifying staff failed: ${notifyError.message}`);
  }

  return mapExitSurveyRow(surveyRow);
}

/** Full detail for the /exit-survey/[exitSurveyId] page, with pod/mentor context merged in. */
export async function getExitSurveyDetailById(exitSurveyId: string): Promise<ExitSurveyDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exit_surveys")
    .select(STAFF_SELECT)
    .eq("id", exitSurveyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const [detail] = await mergeContext([mapExitSurveyDetailRow(data as Record<string, unknown>)]);
  return detail;
}

/** Every exit_surveys row (pending + submitted) tied to one meeting — for the comparison page. */
export async function getExitSurveysForMeetingDetailed(meetingId: string): Promise<ExitSurveyDetail[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exit_surveys")
    .select(STAFF_SELECT)
    .eq("meeting_id", meetingId)
    .order("user_role", { ascending: true });

  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row) => mapExitSurveyDetailRow(row as Record<string, unknown>));
  return mergeContext(rows);
}

/**
 * Filtered/sorted submitted surveys for the staff dashboard table.
 * `podId`, if given, filters AFTER the merge (pod comes from a separate
 * view join, not a column SmartFilterBar's applyFilters can target
 * directly on exit_surveys) — see docs/EXIT_SURVEY_SYSTEM.md.
 */
export async function fetchExitSurveysForStaff(
  filterState: FilterState,
  sortState: SortState,
  podId?: string | null
): Promise<ExitSurveyDetail[]> {
  const supabase = createClient();
  let query = supabase.from("exit_surveys").select(STAFF_SELECT).not("submitted_at", "is", null);
  // @ts-expect-error -- Type instantiation is excessively deep and possibly infinite.
  query = applyFilters(query, EXIT_SURVEY_STAFF_FIELD_DEFS, filterState);
  query = applySort(query, EXIT_SURVEY_STAFF_FIELD_DEFS, sortState);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row) => mapExitSurveyDetailRow(row as Record<string, unknown>));
  const merged = await mergeContext(rows);
  return podId ? merged.filter((r) => r.podId === podId) : merged;
}

/** Escalations panel: submitted, needs_follow_up, urgency soon/urgent — always unfiltered. */
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
  const rows = (data ?? [])
    .map((row) => mapExitSurveyDetailRow(row as Record<string, unknown>))
    .sort((a, b) => urgencyWeight[a.followUpUrgency] - urgencyWeight[b.followUpUrgency]);

  return mergeContext(rows);
}

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

export interface PendingExitSurvey {
  exitSurveyId: string;
  meetingId: string;
  subjectUserId: string;
  subjectFullName: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  meetingStatus: string;
  /** When this exit_surveys row was created (i.e. when the meeting was created — rows are pre-created, not created on submit). */
  createdAt: string;
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
    createdAt: row.created_at as string,
  }));
}

/**
 * All currently-pending (submitted_at IS NULL, past the 80% threshold)
 * exit surveys for one specific user — used by the staff drill-down (e.g.
 * AboutMenteeBlock/AboutMentorBlock) to list a person's outstanding
 * surveys with their createdAt. Distinct from fetchPendingExitSurveys only
 * in intent/naming — same underlying view and shape, kept as its own
 * export so staff call sites read clearly at the call site.
 */
export async function fetchPendingExitSurveysForUser(userId: string): Promise<PendingExitSurvey[]> {
  return fetchPendingExitSurveys(userId);
}

/** Merges v_exit_survey_context (pod + mentor names) onto already-fetched detail rows. */
async function mergeContext(rows: ExitSurveyDetail[]): Promise<ExitSurveyDetail[]> {
  if (rows.length === 0) return rows;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_exit_survey_context")
    .select()
    .in(
      "exit_survey_id",
      rows.map((r) => r.id)
    );

  if (error) {
    // Context is supplementary — don't fail the whole fetch if this lookup
    // errors, just leave pod/mentor fields null.
    console.error("[exit-surveys] Failed to load pod/mentor context:", error.message);
    return rows;
  }

  const contextById = new Map(
    (data ?? []).map((row: Record<string, unknown>) => [row.exit_survey_id as string, row])
  );

  return rows.map((row) => {
    const context = contextById.get(row.id);
    return {
      ...row,
      podId: (context?.pod_id as string) ?? null,
      podName: (context?.pod_name as string) ?? null,
      mentorNames: (context?.mentor_names as string[]) ?? [],
    };
  });
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
    podId: null,
    podName: null,
    mentorNames: [],
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
    voicePromptLabel: (row.voice_prompt_label as string) ?? null,
    answers: (row.answers as ExitSurveyRow["answers"]) ?? null,
    signal: (row.signal as ExitSurveyRow["signal"]) ?? null,
    transcript: (row.transcript as string) ?? null,
    aiSummary: (row.ai_summary as string) ?? null,
    aiHeadline: (row.ai_headline as string) ?? null,
    aiKeyPoints: (row.ai_key_points as string[]) ?? [],
    sentiment: (row.sentiment as ExitSurveyRow["sentiment"]) ?? null,
    concernTags: (row.concern_tags as ExitSurveyRow["concernTags"]) ?? [],
    needsFollowUp: (row.needs_follow_up as boolean) ?? false,
    followUpUrgency: (row.follow_up_urgency as ExitSurveyRow["followUpUrgency"]) ?? "none",
    createdAt: row.created_at as string,
    submittedAt: (row.submitted_at as string) ?? null,
  };
}