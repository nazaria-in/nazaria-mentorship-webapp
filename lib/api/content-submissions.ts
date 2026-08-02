// /lib/api/content-submissions.ts

import { supabase } from "@/lib/supabase/client";
import type { ContentSubmission, ContentSubmissionAnswers, SubmissionStatus } from "@/types/content";

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
  answers: ContentSubmissionAnswers;
  /** Prior submissions for this dispatch, already fetched — avoids a round trip to compute version_number. */
  priorVersionCount: number;
}

/**
 * Inserts the next version for a dispatch. Doesn't touch
 * content_dispatches.completed_at — completion is a separate mentor-only
 * action (Mark Complete, per Phase 2 of the todo), independent of any
 * individual submission's review status. Notification-on-submit is
 * intentionally not fired here — same deferral pattern as
 * dispatchContentItem in content-dispatches.ts — wired up once
 * lib/notifications/content-notifications.ts exists (see todo §G).
 */
export async function createSubmission({ dispatchId, answers, priorVersionCount }: CreateSubmissionInput): Promise<ContentSubmission> {
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
  return data as unknown as ContentSubmission;
}

interface ReviewSubmissionInput {
  submissionId: string;
  status: Extract<SubmissionStatus, "approved" | "revision_requested">;
  reviewedBy: string;
  feedback: string | null;
}

/**
 * Approve / Request Revision — per content_submissions row, independent of
 * Mark Complete (Phase 2 explicitly separates these two actions; approving
 * every submission doesn't auto-complete the dispatch, a mentor still has
 * to Mark Complete separately).
 */
export async function reviewSubmission({ submissionId, status, reviewedBy, feedback }: ReviewSubmissionInput): Promise<void> {
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
}