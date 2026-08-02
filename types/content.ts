// /types/content.ts

import type { ContentSubmissionTemplate, ContentType } from "@/components/content/ContentSubmissionTemplateEditor";

export type { ContentType };

export interface Week {
  id: string;
  name: string;
  order_index: number;
  start_date: string | null;
  end_date: string | null;
}

export interface Tag {
  id: string;
  name: string;
}

/** A content_items row — the reusable template/definition, not a per-mentee instance. */
export interface ContentItem {
  id: string;
  content_type: ContentType;
  title: string;
  description: string | null;
  instructions: string | null;
  week_id: string | null;
  submission_template: ContentSubmissionTemplate;
  is_active: boolean;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
}

export interface ContentItemWithMeta extends ContentItem {
  week: Week | null;
  tags: Tag[];
}

/**
 * SCHEMA GAP: v_mentee_assignment_status only covers content_type = 'assignment'
 * (see supabase-v_mentee_assignment_status.sql). Courses/resources have no
 * equivalent view yet — their completion is derived client-side from
 * content_dispatches.completed_at only, which loses the richer
 * pending/needs-revision states assignments get. Flagging rather than
 * papering over: if course review flows are ever added, this needs its own
 * view the same way assignments got one.
 */
export type CompletionStatus =
  | "completed"
  | "pending_review"
  | "needs_revision"
  | "approved_awaiting_completion"
  | "not_started";

export interface ContentDispatch {
  id: string;
  content_item_id: string;
  mentee_id: string;
  assigned_by: string;
  due_at: string | null;
  pushed_at: string;
  completed_at: string | null;
  completed_by: string | null;
}

/** A mentee-facing row: their dispatch, joined back to the template + derived status. */
export interface MenteeContentDispatch extends ContentDispatch {
  content_item: ContentItemWithMeta;
  completion_status: CompletionStatus;
  latest_submission_status: "pending_review" | "revision_requested" | "approved" | null;
  total_submissions: number;
}

export interface MenteeRef {
  menteeId: string;
  contentDispatchId: string;
}

// ---------------------------------------------------------------------------
// Submissions — one row per version. Answers shape below is a convention
// this codebase uses on top of the jsonb `answers` column; Postgres only
// enforces it being an object, not this specific shape.
// ---------------------------------------------------------------------------

export type SubmissionStatus = "pending_review" | "revision_requested" | "approved";

/** Values keyed by ContentQuestionEntry.id from submission_template.additional_questions. */
export type AdditionalQuestionAnswerValue = string | string[] | number;

export interface AssignmentSubmissionAnswers {
  submission_link: string;
  difficulty_level: number | null;
}

export interface CourseSubmissionAnswers {
  modules_completed: number | null;
  difficulty_level: number | null;
}

/**
 * Resources have no type_specific answer shape (mirrors
 * ResourceTypeSpecific being `Record<string, never>` in the template
 * editor) — a resource submission, when required/optional, is just the
 * additional_questions answers with no type_specific payload at all.
 */
export interface ContentSubmissionAnswers {
  type_specific?: {
    assignment?: AssignmentSubmissionAnswers;
    course?: CourseSubmissionAnswers;
  };
  additional_questions: Record<string, AdditionalQuestionAnswerValue>;
}

export interface ContentSubmission {
  id: string;
  dispatch_id: string;
  version_number: number;
  answers: ContentSubmissionAnswers;
  status: SubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  feedback: string | null;
  submitted_at: string;
}