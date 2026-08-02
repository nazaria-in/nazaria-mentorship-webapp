// /lib/api/assignments.ts
//Deperated File

/*
import { createClient } from "@/lib/supabase/client";
import type { Assignment, AssignmentSubmissionSlot, AssignmentWithSlots } from "@/types/assignments";
import { UserRole } from "@/types/users";

export async function fetchAssignment(assignmentId: string): Promise<AssignmentWithSlots> {
  const supabase = createClient();
  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", assignmentId)
    .is("deleted_at", null)
    .single();
  if (assignmentError) throw assignmentError;

  const { data: slots, error: slotsError } = await supabase
    .from("assignment_submission_slots")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("order_index", { ascending: true });
  if (slotsError) throw slotsError;

  return { ...(assignment as Assignment), slots: (slots ?? []) as AssignmentSubmissionSlot[] };
}

export interface AssignmentListFilters {
  weekNumber?: number;
  isActive?: boolean;
  createdBy?: string;
}

export async function fetchAssignments(filters: AssignmentListFilters = {}): Promise<Assignment[]> {
  const supabase = createClient();
  let query = supabase.from("assignments").select("*").is("deleted_at", null);

  if (filters.weekNumber != null) query = query.eq("week_number", filters.weekNumber);
  if (filters.isActive != null) query = query.eq("is_active", filters.isActive);
  if (filters.createdBy) query = query.eq("created_by", filters.createdBy);

  const { data, error } = await query.order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Assignment[];
}

export interface CreateAssignmentInput {
  title: string;
  description: string;
  instructions?: string | null;
  week_number?: number | null;
  start_date: string;
  end_date?: string | null;
  created_by: string;
  slots: { title: string; order_index: number; max_versions: number }[];
}

// Inserts the assignment then bulk-inserts its slots. Not a single DB
// transaction (Supabase JS doesn't expose one for plain inserts) — if slot
// insertion fails, the assignment row is rolled back manually. Acceptable
// for MVP; move to a Postgres function if partial-fan-out becomes a problem.
export async function createAssignment(input: CreateAssignmentInput): Promise<AssignmentWithSlots> {
  const supabase = createClient();

  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .insert({
      title: input.title,
      description: input.description,
      instructions: input.instructions ?? null,
      week_number: input.week_number ?? null,
      start_date: input.start_date,
      end_date: input.end_date ?? null,
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (assignmentError) throw assignmentError;

  const slotRows = input.slots.map((s) => ({
    assignment_id: assignment.id,
    title: s.title,
    order_index: s.order_index,
    max_versions: s.max_versions,
  }));

  const { data: slots, error: slotsError } = await supabase
    .from("assignment_submission_slots")
    .insert(slotRows)
    .select("*");

  if (slotsError) {
    await supabase.from("assignments").delete().eq("id", assignment.id);
    throw slotsError;
  }

  return { ...(assignment as Assignment), slots: (slots ?? []) as AssignmentSubmissionSlot[] };
}

export interface UpdateAssignmentInput {
  id: string;
  title?: string;
  description?: string;
  instructions?: string | null;
  week_number?: number | null;
  start_date?: string;
  end_date?: string | null;
  is_active?: boolean;
}

export async function updateAssignment({ id, ...patch }: UpdateAssignmentInput): Promise<Assignment> {
  const supabase = createClient();
  const { data, error } = await supabase.from("assignments").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Assignment;
}

export async function softDeleteAssignment(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("assignments").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// Slot CRUD used by SubmissionSlotEditor when editing an existing assignment
// (not needed on initial create, where slots go in via createAssignment above).
export async function addSlot(input: Omit<AssignmentSubmissionSlot, "id" | "created_at">): Promise<AssignmentSubmissionSlot> {
  const supabase = createClient();
  const { data, error } = await supabase.from("assignment_submission_slots").insert(input).select("*").single();
  if (error) throw error;
  return data as AssignmentSubmissionSlot;
}

export async function updateSlot(id: string, patch: Partial<Pick<AssignmentSubmissionSlot, "title" | "order_index" | "max_versions">>): Promise<AssignmentSubmissionSlot> {
  const supabase = createClient();
  const { data, error } = await supabase.from("assignment_submission_slots").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as AssignmentSubmissionSlot;
}

export async function deleteSlot(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("assignment_submission_slots").delete().eq("id", id);
  if (error) throw error;
}


export interface FetchAssignmentsForRoleParams {
  role: UserRole;
  userId: string | null;
}

interface MenteeAssignmentJoinRow {
  assignment: Assignment | null;
}

export async function fetchAssignmentsForRole(
  params: FetchAssignmentsForRoleParams
): Promise<Assignment[]> {
  const { role, userId } = params;
  const supabase = createClient();

  if (role === "mentee") {
    if (!userId) return [];
    const { data, error } = await supabase
      .from("mentee_assignments")
      .select("assignment:assignments(*)")
      .eq("mentee_id", userId);
    if (error) throw error;

    const rows = (data ?? []) as unknown as MenteeAssignmentJoinRow[];
    const map = new Map<string, Assignment>();
    for (const row of rows) {
      if (row.assignment && !row.assignment.deleted_at) {
        map.set(row.assignment.id, row.assignment);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );
  }

  if (role === "mentor") {
    if (!userId) return [];
    return fetchAssignments({ createdBy: userId });
  }

  // pm / associate: everything
  return fetchAssignments();
}
*/