// /types/assignments.ts

export type SubmissionStatus = "pending_review" | "revision_requested" | "approved"; // matches submission_status enum in Supabase

export interface AssignmentSubmissionSlot {
  id: string;
  assignment_id: string;
  title: string;
  order_index: number;
  max_versions: number;
  created_at: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  instructions: string | null;
  week_number: number | null;
  start_date: string; // date
  end_date: string | null; // date, soft due date
  is_active: boolean;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
}

export interface AssignmentWithSlots extends Assignment {
  slots: AssignmentSubmissionSlot[];
}

export interface MenteeAssignment {
  id: string;
  mentee_id: string;
  assignment_id: string;
  assigned_by: string;
  description: string | null;
  due_at: string;
  pushed_at: string;
  is_completed: boolean;
  notification_sent_at: string | null;
}

export interface MenteeSubmission {
  id: string;
  mentee_assignment_id: string;
  slot_id: string;
  file_id: string;
  version_number: number;
  submitted_at: string;
  status: SubmissionStatus;
  feedback: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

// Denormalized shape used by the mentee/staff-facing submissions panel —
// one entry per slot, carrying its own ordered version list. Built client
// side from `slots` + `mentee_submissions` (small dataset, fine to group in JS).
export interface SlotWithSubmissions {
  slot: AssignmentSubmissionSlot;
  versions: (MenteeSubmission & { file?: { id: string; title: string | null; url: string | null } })[];
}

// Row shape for the staff-facing "mentees for this assignment" grid.
export interface MenteeAssignmentSummary {
  menteeAssignmentId: string;
  mentee: { id: string; full_name: string; pod_id?: string; pod_name?: string };
  dueAt: string;
  isCompleted: boolean;
  totalSlots: number;
  pendingReviewCount: number; // count of latest-per-slot submissions still pending_review
  revisionRequestedCount: number; // count of latest-per-slot submissions sent back for revision
  submittedCount: number; // slots with at least one version submitted
}

export type AssignmentDetailsMode = "submit" | "review";