// /lib/api/mentee-assignments.ts

import { createClient } from "@/lib/supabase/client";
import type {
  AssignmentSubmissionSlot,
  MenteeAssignment,
  MenteeAssignmentSummary,
  MenteeSubmission,
  SlotWithSubmissions,
  SubmissionStatus,
} from "@/types/assignments";

export async function fetchMenteeAssignment(menteeAssignmentId: string): Promise<MenteeAssignment> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mentee_assignments")
    .select("*")
    .eq("id", menteeAssignmentId)
    .single();
  if (error) throw error;
  return data as MenteeAssignment;
}

// Finds (or the caller can create) the mentee_assignments row for the
// current mentee + a given assignment — used by the mentee's own "submit" view.
export async function fetchMenteeAssignmentFor(assignmentId: string, menteeId: string): Promise<MenteeAssignment | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mentee_assignments")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("mentee_id", menteeId)
    .maybeSingle();
  if (error) throw error;
  return (data as MenteeAssignment) ?? null;
}

// Builds the slot+versions structure SlotSubmissionsPanel renders directly.
// Grouping happens in JS since the dataset per mentee is small (a handful
// of slots, a handful of versions each) — not worth a view for this one.
export async function fetchSlotSubmissions(
  assignmentId: string,
  menteeAssignmentId: string
): Promise<SlotWithSubmissions[]> {
  const supabase = createClient();

  const { data: slots, error: slotsError } = await supabase
    .from("assignment_submission_slots")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("order_index", { ascending: true });
  if (slotsError) throw slotsError;

  const { data: submissions, error: subsError } = await supabase
    .from("mentee_submissions")
    .select("*, file:files(id, title, url)")
    .eq("mentee_assignment_id", menteeAssignmentId)
    .order("version_number", { ascending: true });
  if (subsError) throw subsError;

  const typedSlots = (slots ?? []) as AssignmentSubmissionSlot[];
  const typedSubmissions = (submissions ?? []) as SlotWithSubmissions["versions"];

  return typedSlots.map((slot) => ({
    slot,
    versions: typedSubmissions.filter((s) => s.slot_id === slot.id),
  }));
}

// Staff-facing grid: one row per mentee this assignment was dispatched to,
// with a rolled-up pending/submitted count. Left as parallel client-side
// queries for MVP — recommend querying v_mentee_assignment_status once this
// list needs to scale past a cohort or two.
interface DispatchRow {
  id: string;
  mentee_id: string;
  due_at: string;
  is_completed: boolean;
  mentee: { id: string; full_name: string | null } | null;
}

interface SubmissionRow {
  mentee_assignment_id: string;
  slot_id: string;
  status: SubmissionStatus;
  version_number: number;
}

export async function fetchMenteeAssignmentSummaries(
  assignmentId: string
): Promise<MenteeAssignmentSummary[]> {
  const supabase = createClient();

  const { data: dispatches, error: dispatchError } = await supabase
    .from("mentee_assignments")
    .select("id, mentee_id, due_at, is_completed, mentee:users!mentee_assignments_mentee_id_fkey(id, full_name)")
    .eq("assignment_id", assignmentId);
  if (dispatchError) throw dispatchError;
  const typedDispatches = (dispatches ?? []) as unknown as DispatchRow[];

  const { data: slots, error: slotsError } = await supabase
    .from("assignment_submission_slots")
    .select("id")
    .eq("assignment_id", assignmentId);
  if (slotsError) throw slotsError;
  const totalSlots = slots?.length ?? 0;

  const menteeAssignmentIds = typedDispatches.map((d) => d.id);
  const { data: submissions, error: subsError } = menteeAssignmentIds.length
    ? await supabase
        .from("mentee_submissions")
        .select("mentee_assignment_id, slot_id, status, version_number")
        .in("mentee_assignment_id", menteeAssignmentIds)
    : { data: [] as SubmissionRow[], error: null };
  if (subsError) throw subsError;
  const typedSubmissions = (submissions ?? []) as SubmissionRow[];

  const summaries: MenteeAssignmentSummary[] = typedDispatches.map((d) => {
    const rows = typedSubmissions.filter((s) => s.mentee_assignment_id === d.id);
    const submittedSlotIds = new Set(rows.map((r) => r.slot_id));
    const latestBySlot = new Map<string, { status: SubmissionStatus; version_number: number }>();
    for (const r of rows) {
      const existing = latestBySlot.get(r.slot_id);
      if (!existing || r.version_number > existing.version_number) latestBySlot.set(r.slot_id, r);
    }
    const latestStatuses = Array.from(latestBySlot.values());
    const pendingReviewCount = latestStatuses.filter((r) => r.status === "pending_review").length;
    const revisionRequestedCount = latestStatuses.filter((r) => r.status === "revision_requested").length;

    return {
      menteeAssignmentId: d.id,
      mentee: { id: d.mentee_id, full_name: d.mentee?.full_name?.trim() || "Unnamed mentee" },
      dueAt: d.due_at,
      isCompleted: d.is_completed,
      totalSlots,
      pendingReviewCount,
      revisionRequestedCount,
      submittedCount: submittedSlotIds.size,
    };
  });

  // podId filtering requires a pod_members join — apply once that hook/join is wired up.
  return summaries;
}


// ---- Mentee actions ----

export async function submitVersion(input: {
  mentee_assignment_id: string;
  slot_id: string;
  file_id: string;
  version_number: number;
}): Promise<MenteeSubmission> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mentee_submissions")
    .insert({ ...input, status: "pending_review" })
    .select("*")
    .single();
  if (error) throw error;
  return data as MenteeSubmission;
}

// ---- Mentor/staff actions ----

// `status` must be a real submission_status value ("approved" or
// "revision_requested" — "pending_review" is only ever set by submitVersion).
// The previous version of this function hardcoded status: "reviewed", which
// is not a valid enum value for this column — every review silently failed
// at the DB layer, which is why reviewed submissions kept showing as pending.
export async function reviewSubmission(input: {
  submissionId: string;
  feedback: string;
  reviewedBy: string;
  status: Extract<SubmissionStatus, "approved" | "revision_requested">;
}): Promise<MenteeSubmission> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mentee_submissions")
    .update({
      status: input.status,
      feedback: input.feedback,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.submissionId)
    .select("*")
    .single();
  if (error) throw error;
  return data as MenteeSubmission;
}

// ---- Dispatch ----

export async function dispatchAssignment(input: {
  assignmentId: string;
  menteeIds: string[];
  assignedBy: string;
  dueAt: string;
  description?: string | null;
}): Promise<MenteeAssignment[]> {
  const supabase = createClient();
  const rows = input.menteeIds.map((menteeId) => ({
    assignment_id: input.assignmentId,
    mentee_id: menteeId,
    assigned_by: input.assignedBy,
    due_at: input.dueAt,
    description: input.description ?? null,
  }));
  const { data, error } = await supabase.from("mentee_assignments").insert(rows).select("*");
  if (error) throw error;
  return (data ?? []) as MenteeAssignment[];
}