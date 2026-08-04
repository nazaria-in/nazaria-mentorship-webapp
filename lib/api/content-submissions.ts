// /lib/api/content-submissions.ts

import { supabase } from "@/lib/supabase/client";
import { notifyContentSubmitted, notifyContentReviewed } from "@/lib/notifications/content-notifications";
import type { ContentSubmission, ContentSubmissionAnswers, SubmissionStatus } from "@/types/content";
import type { ContentQuestionEntry } from "@/components/content/ContentSubmissionTemplateEditor";

/**
 * All versions for one dispatch, newest first — powers both the mentee's
 * "your submission history" view and the staff review panel (which reviews
 * the latest, but can show prior versions/feedback for context).
 */
export async function fetchSubmissionsForDispatch(dispatchId: string): Promise<ContentSubmission[]> {
  const { data, error } = await supabase
    .from("content_submissions")
    .select("*")
    .eq("dispatch_id", dispatchId)
    .order("version_number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ContentSubmission[];
}

export async function fetchLatestSubmission(dispatchId: string): Promise<ContentSubmission | null> {
  const { data, error } = await supabase
    .from("content_submissions")
    .select("*")
    .eq("dispatch_id", dispatchId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ContentSubmission) ?? null;
}

interface CreateSubmissionInput {
  dispatchId: string;
  contentItemId: string;
  answers: ContentSubmissionAnswers;
  /** Prior submissions for this dispatch, already fetched — avoids a round trip to compute version_number. */
  priorVersionCount: number;
  /**
   * The template's additional_questions definitions — needed only to know
   * which question ids have analyticsEnabled + a metricKey, so their
   * answers can be denormalized into content_analytics_answers.
   */
  questionDefs: ContentQuestionEntry[];
  /**
   * ADDED for notification wiring — mentor to notify (content_items.created_by
   * is the natural choice: whoever authored the item), the content item's
   * title for the notification copy, and the submitting mentee's display
   * name (for the "X submitted work" body). Caller (the mentee-facing
   * submission form) already has all three in scope.
   */
  mentorId: string;
  menteeName: string;
  contentItemTitle: string;
}

/**
 * Inserts the next version for a dispatch. Doesn't touch
 * content_dispatches.completed_at — completion is a separate mentor-only
 * action (Mark Complete), independent of any individual submission's
 * review status.
 */
export async function createSubmission({
  dispatchId,
  contentItemId,
  answers,
  priorVersionCount,
  questionDefs,
  mentorId,
  menteeName,
  contentItemTitle,
}: CreateSubmissionInput): Promise<ContentSubmission> {
  const { data, error } = await supabase
    .from("content_submissions")
    .insert({
      dispatch_id: dispatchId,
      version_number: priorVersionCount + 1,
      answers,
      status: "pending_review" as SubmissionStatus,
    })
    .select()
    .single();
  if (error) throw error;

  const submission = data as unknown as ContentSubmission;

  await writeAnalyticsAnswers(submission, contentItemId, questionDefs);

  await notifyContentSubmitted(supabase, {
    contentDispatchId: dispatchId,
    contentItemTitle,
    mentorId,
    menteeName,
  }).catch((err) => {
    // Same soft-fail posture as the analytics write below: the submission
    // itself already succeeded above, a notification hiccup shouldn't
    // surface as a submission failure to the mentee.
    console.error("[content-submissions] Submission saved but mentor notification failed", dispatchId, err);
  });

  return submission;
}

/**
 * §F — writes one content_analytics_answers row per question flagged
 * analyticsEnabled with a metricKey. Wrapped in try/catch and logged
 * rather than thrown so a missing/misconfigured analytics table never
 * blocks an actual submission from succeeding.
 */
async function writeAnalyticsAnswers(
  submission: ContentSubmission,
  contentItemId: string,
  questionDefs: ContentQuestionEntry[]
): Promise<void> {
  const rows = questionDefs
    .filter((q) => q.analyticsEnabled && q.metricKey && submission.answers.additional_questions[q.id] !== undefined)
    .map((q) => ({
      content_submission_id: submission.id,
      content_item_id: contentItemId,
      question_id: q.id,
      metric_key: q.metricKey as string,
      value: submission.answers.additional_questions[q.id],
    }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("content_analytics_answers").insert(rows);
  if (error) {
    console.error("[content-submissions] Failed to write analytics answers (table may not exist yet)", error);
  }
}

interface ReviewSubmissionInput {
  submissionId: string;
  status: Extract<SubmissionStatus, "approved" | "revision_requested">;
  reviewedBy: string;
  feedback: string | null;
  /**
   * ADDED for notification wiring — dispatchId + menteeId to notify + the
   * content item's title for the notification copy. Caller (the staff
   * review panel) already has all three in scope (the dispatch row it's
   * reviewing against).
   */
  contentDispatchId: string;
  menteeId: string;
  contentItemTitle: string;
}

/**
 * Approve / Request Revision — per content_submissions row, independent of
 * Mark Complete (approving every submission doesn't auto-complete the
 * dispatch, a mentor still has to Mark Complete separately).
 */
export async function reviewSubmission({
  submissionId,
  status,
  reviewedBy,
  feedback,
  contentDispatchId,
  menteeId,
  contentItemTitle,
}: ReviewSubmissionInput): Promise<void> {
  const { error } = await supabase
    .from("content_submissions")
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      feedback,
    })
    .eq("id", submissionId);
  if (error) throw error;

  await notifyContentReviewed(supabase, {
    contentDispatchId,
    contentItemTitle,
    menteeId,
    status,
  }).catch((err) => {
    console.error("[content-submissions] Review saved but mentee notification failed", submissionId, err);
  });
}