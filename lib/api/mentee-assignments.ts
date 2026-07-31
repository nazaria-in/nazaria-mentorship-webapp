// /lib/api/mentee-assignments.ts

import { createClient } from "@/lib/supabase/client";
import { fetchPodMemberGroups } from "@/lib/api/pods";
import { scheduleAssignmentReminders } from "@/lib/notifications/assignment-notifications";
import {
  checkAndNotifyAssignmentCompletion,
  notifyAssignmentSubmitted,
  notifyAssignmentReviewed,
} from "@/lib/notifications/assignment-notifications";
import type { UserRole } from "@/types/users";
import type {
  Assignment,
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

interface SubmittedVersionRow extends MenteeSubmission {
  mentee_assignment: {
    id: string;
    mentee_id: string;
    assigned_by: string;
    assignment: { title: string } | null;
    mentee: { full_name: string | null } | null;
  } | null;
}

/**
 * Inserts the submission, then notifies whoever dispatched this assignment
 * (mentee_assignments.assigned_by — the mentor/staff who assigned it, the
 * correct "review this" recipient regardless of whether that was a mentor
 * or a staff member). AddSubmissionForm only ever has slotId/
 * menteeAssignmentId/nextVersionNumber in scope, so the mentor id, mentee's
 * display name, and assignment title are all resolved here via the same
 * single-query-join pattern reviewSubmission below uses, rather than
 * pushing that lookup onto the caller.
 */
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
    .select(
      "*, mentee_assignment:mentee_assignments(id, mentee_id, assigned_by, assignment:assignments(title), mentee:users!mentee_assignments_mentee_id_fkey(full_name))"
    )
    .single();
  if (error) throw error;

  const row = data as unknown as SubmittedVersionRow;

  if (row.mentee_assignment) {
    try {
      await notifyAssignmentSubmitted(supabase, {
        menteeAssignmentId: row.mentee_assignment.id,
        assignmentTitle: row.mentee_assignment.assignment?.title ?? "Assignment",
        mentorId: row.mentee_assignment.assigned_by,
        menteeName: row.mentee_assignment.mentee?.full_name?.trim() || "A mentee",
      });
    } catch (notificationError) {
      console.error("[mentee-assignments] Failed to notify mentor of new submission", notificationError, {
        menteeAssignmentId: row.mentee_assignment.id,
      });
    }
  }

  const { mentee_assignment: _menteeAssignment, ...submission } = row;
  return submission as MenteeSubmission;
}

// ---- Mentor/staff actions ----

interface ReviewedSubmissionRow extends MenteeSubmission {
  mentee_assignment: {
    id: string;
    mentee_id: string;
    assignment: { title: string } | null;
  } | null;
}

// `status` must be a real submission_status value ("approved" or
// "revision_requested" — "pending_review" is only ever set by submitVersion).
// The previous version of this function hardcoded status: "reviewed", which
// is not a valid enum value for this column — every review silently failed
// at the DB layer, which is why reviewed submissions kept showing as pending.
//
// Now notifies the mentee on EVERY review outcome (approved or
// revision_requested) via notifyAssignmentReviewed, in addition to the
// existing completion check — those are two distinct notifications: one
// per-submission ("your work was reviewed"), one assignment-level
// ("everything's approved now"). Both can fire from the same approval.
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
    .select("*, mentee_assignment:mentee_assignments(id, mentee_id, assignment:assignments(title))")
    .single();
  if (error) throw error;

  const row = data as unknown as ReviewedSubmissionRow;

  if (row.mentee_assignment) {
    try {
      await notifyAssignmentReviewed(supabase, {
        menteeAssignmentId: row.mentee_assignment.id,
        assignmentTitle: row.mentee_assignment.assignment?.title ?? "Assignment",
        menteeId: row.mentee_assignment.mentee_id,
        status: input.status,
      });
    } catch (notificationError) {
      console.error("[mentee-assignments] Failed to notify mentee of review outcome", notificationError, {
        submissionId: input.submissionId,
      });
    }

    if (input.status === "approved") {
      try {
        await checkAndNotifyAssignmentCompletion(supabase, {
          menteeAssignmentId: row.mentee_assignment.id,
          menteeId: row.mentee_assignment.mentee_id,
          assignmentTitle: row.mentee_assignment.assignment?.title ?? "Assignment",
        });
      } catch (notificationError) {
        console.error("[mentee-assignments] Failed to check/notify assignment completion", notificationError, {
          submissionId: input.submissionId,
        });
      }
    }
  }

  const { mentee_assignment: _menteeAssignment, ...submission } = row;
  return submission as MenteeSubmission;
}

// ---- Dispatch ----

export async function dispatchAssignment(input: {
  assignmentId: string;
  menteeIds: string[];
  assignedBy: string;
  dueAt: string;
  description?: string | null;
  /** Needed for the reminder cascade notification copy — pass the value
   *  already loaded on the caller's side (e.g. AssignmentFormModal's
   *  rosterTarget) rather than re-fetching it here. */
  assignmentTitle: string;
  /** Same reasoning as assignmentTitle — used as the reminder cascade anchor. */
  assignmentStartDate: string;
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
  const created = (data ?? []) as MenteeAssignment[];

  for (const menteeAssignment of created) {
    try {
      await scheduleAssignmentReminders(supabase, {
        menteeAssignmentId: menteeAssignment.id,
        menteeId: menteeAssignment.mentee_id,
        assignmentTitle: input.assignmentTitle,
        assignmentStartDate: input.assignmentStartDate,
        dueAt: menteeAssignment.due_at,
      });
    } catch (notificationError) {
      console.error("[mentee-assignments] Failed to schedule reminders for dispatched mentee", notificationError, {
        menteeAssignmentId: menteeAssignment.id,
      });
    }
  }

  return created;
}

export interface AssignedMenteeRef {
  menteeAssignmentId: string;
  menteeId: string;
}

interface AssignedMenteeRow {
  id: string;
  mentee_id: string;
}

// Lightweight lookup for the edit-roster step — seeds PodMemberSelector's
// committed ids and resolves mentee_id -> the actual mentee_assignments row
// id that removeMenteeAssignment below needs.
export async function fetchAssignedMenteeRefs(assignmentId: string): Promise<AssignedMenteeRef[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mentee_assignments")
    .select("id, mentee_id")
    .eq("assignment_id", assignmentId);
  if (error) throw error;
  const typed = (data ?? []) as AssignedMenteeRow[];
  return typed.map((d) => ({ menteeAssignmentId: d.id, menteeId: d.mentee_id }));
}

// Hard delete — mentee_assignments has no deleted_at column, so there's no
// soft-delete option here. FLAGGED GAP: mentee_submissions.mentee_assignment_id
// is a FK into this table, and the schema dump doesn't show that FK's ON
// DELETE behavior. If it's RESTRICT/NO ACTION (Postgres default), this
// throws when the mentee already has submissions attached — the caller
// needs to surface that error, not swallow it. If it's CASCADE, their
// submissions vanish silently along with the row. Confirm which one your
// migration set before trusting this in production.
export async function removeMenteeAssignment(menteeAssignmentId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("mentee_assignments").delete().eq("id", menteeAssignmentId);
  if (error) throw error;
}

// ---- Dashboard timeline ----

export interface MenteeAssignmentTimelineRow {
  id: string;
  mentee_id: string;
  due_at: string;
  is_completed: boolean;
  assignment: { id: string; title: string } | null;
}

export interface FetchMenteeAssignmentsForTimelineParams {
  role: UserRole;
  userId: string | null;
  rangeStart: string;
  rangeEnd: string;
}

/**
 * Role-scoped mentee_assignments for the dashboard timeline:
 * - mentee: only their own rows (empty if not logged in).
 * - mentor: rows for mentees in the mentor's own pod(s).
 * - pm/associate: every row (staff oversight).
 * Scoped to [rangeStart, rangeEnd) on due_at to match Timeline's range.
 */
export async function fetchMenteeAssignmentsForTimeline(
  params: FetchMenteeAssignmentsForTimelineParams,
): Promise<MenteeAssignmentTimelineRow[]> {
  const { role, userId, rangeStart, rangeEnd } = params;
  const supabase = createClient();

  const SELECT = "id, mentee_id, due_at, is_completed, assignment:assignments(id, title)";

  if (role === "mentee") {
    if (!userId) return [];
    const { data, error } = await supabase
      .from("mentee_assignments")
      .select(SELECT)
      .eq("mentee_id", userId)
      .gte("due_at", rangeStart)
      .lt("due_at", rangeEnd);
    if (error) throw error;
    return (data ?? []) as unknown as MenteeAssignmentTimelineRow[];
  }

  if (role === "mentor") {
    if (!userId) return [];
    const podGroups = await fetchPodMemberGroups({ role: "mentee", mentorId: userId, includeEmptyPods: true });
    const menteeIds = Array.from(new Set(podGroups.flatMap((pod) => pod.members.map((m) => m.id))));
    if (menteeIds.length === 0) return [];

    const { data, error } = await supabase
      .from("mentee_assignments")
      .select(SELECT)
      .in("mentee_id", menteeIds)
      .gte("due_at", rangeStart)
      .lt("due_at", rangeEnd);
    if (error) throw error;
    return (data ?? []) as unknown as MenteeAssignmentTimelineRow[];
  }

  // pm / associate: everything in range
  const { data, error } = await supabase
    .from("mentee_assignments")
    .select(SELECT)
    .gte("due_at", rangeStart)
    .lt("due_at", rangeEnd);
  if (error) throw error;
  return (data ?? []) as unknown as MenteeAssignmentTimelineRow[];
}

export interface FetchAssignedAssignmentsForUserParams {
  role: UserRole;
  userId: string | null;
}

interface MenteeAssignmentWithAssignmentRow {
  id: string;
  mentee_id: string;
  assignment: Assignment | null;
}

const ASSIGNED_SELECT = "id, mentee_id, assignment:assignments(*)";

function dedupeByAssignmentId(rows: MenteeAssignmentWithAssignmentRow[]): Assignment[] {
  const map = new Map<string, Assignment>();
  for (const row of rows) {
    if (row.assignment) map.set(row.assignment.id, row.assignment);
  }
  return Array.from(map.values());
}

/**
 * Assignments actually dispatched to the logged-in user, via mentee_assignments
 * (not the raw assignments table — an assignment only "belongs" to someone once
 * it has a mentee_assignments row).
 * - mentee: only their own dispatched assignments (empty if not logged in).
 * - mentor: assignments dispatched to mentees in the mentor's own pod(s).
 * - pm/associate: every dispatched assignment (staff oversight).
 */
export async function fetchAssignedAssignmentsForUser(
  params: FetchAssignedAssignmentsForUserParams,
): Promise<Assignment[]> {
  const { role, userId } = params;
  const supabase = createClient();

  if (role === "mentee") {
    if (!userId) return [];
    const { data, error } = await supabase
      .from("mentee_assignments")
      .select(ASSIGNED_SELECT)
      .eq("mentee_id", userId);
    if (error) throw error;
    return dedupeByAssignmentId((data ?? []) as unknown as MenteeAssignmentWithAssignmentRow[]);
  }

  if (role === "mentor") {
    if (!userId) return [];
    const podGroups = await fetchPodMemberGroups({ role: "mentee", mentorId: userId, includeEmptyPods: true });
    const menteeIds = Array.from(new Set(podGroups.flatMap((pod) => pod.members.map((m) => m.id))));
    if (menteeIds.length === 0) return [];

    const { data, error } = await supabase
      .from("mentee_assignments")
      .select(ASSIGNED_SELECT)
      .in("mentee_id", menteeIds);
    if (error) throw error;
    return dedupeByAssignmentId((data ?? []) as unknown as MenteeAssignmentWithAssignmentRow[]);
  }

  // pm / associate: everything dispatched, across all mentees
  const { data, error } = await supabase.from("mentee_assignments").select(ASSIGNED_SELECT);
  if (error) throw error;
  return dedupeByAssignmentId((data ?? []) as unknown as MenteeAssignmentWithAssignmentRow[]);
}