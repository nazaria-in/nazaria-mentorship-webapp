// /lib/api/assignment-status.ts

import { createClient } from "@/lib/supabase/client";

export type MenteeAssignmentCompletionStatus = "completed" | "pending_review" | "not_started";

export interface MenteeAssignmentStatus {
  menteeAssignmentId: string;
  assignmentId: string;
  menteeId: string;
  dueAt: string;
  isCompleted: boolean;
  totalSlots: number;
  approvedSlots: number;
  pendingSlots: number;
  revisionSlots: number;
  completionStatus: MenteeAssignmentCompletionStatus;
}

interface MenteeAssignmentStatusRow {
  mentee_assignment_id: string;
  assignment_id: string;
  mentee_id: string;
  due_at: string;
  is_completed: boolean;
  total_slots: number;
  approved_slots: number;
  pending_slots: number;
  revision_slots: number;
  completion_status: MenteeAssignmentCompletionStatus;
}

function mapRow(row: MenteeAssignmentStatusRow): MenteeAssignmentStatus {
  return {
    menteeAssignmentId: row.mentee_assignment_id,
    assignmentId: row.assignment_id,
    menteeId: row.mentee_id,
    dueAt: row.due_at,
    isCompleted: row.is_completed,
    totalSlots: row.total_slots,
    approvedSlots: row.approved_slots,
    pendingSlots: row.pending_slots,
    revisionSlots: row.revision_slots,
    completionStatus: row.completion_status,
  };
}

/**
 * Reads derived completion status for a single mentee_assignment from
 * v_mentee_assignment_status. This is the source of truth for "is this
 * assignment done" — completionStatus is computed from actual submission
 * review state, not a manually-toggled flag. Nothing writes to this; it's
 * read-only by design.
 */
export async function fetchMenteeAssignmentStatus(
  menteeAssignmentId: string
): Promise<MenteeAssignmentStatus | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_mentee_assignment_status")
    .select("*")
    .eq("mentee_assignment_id", menteeAssignmentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapRow(data as MenteeAssignmentStatusRow);
}

/** Batch version for grids showing many mentees against one assignment. */
export async function fetchMenteeAssignmentStatusesForAssignment(
  assignmentId: string
): Promise<MenteeAssignmentStatus[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_mentee_assignment_status")
    .select("*")
    .eq("assignment_id", assignmentId);

  if (error) throw error;
  return ((data ?? []) as MenteeAssignmentStatusRow[]).map(mapRow);
}