// /lib/api/admin-users.ts

import { createClient } from "@/lib/supabase/client";
import { applyFilters } from "@/lib/filtering/apply-filters";
import { applySort } from "@/lib/filtering/apply-sort";
import { USER_ROLE_FIELD_DEFS, USER_POD_FIELD_DEFS } from "@/lib/filtering/admin-user-fields";
import type { FilterState, SortState } from "@/lib/filtering/types";

export type UserRole = "mentee" | "mentor" | "associate" | "pm";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface AdminUserRow {
  id: string;
  fullName: string | null;
  email: string | null;
  schoolOrOrg: string | null;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  createdAt: string;
}

export interface AdminUserPodRow {
  userId: string;
  fullName: string | null;
  email: string | null;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  podId: string | null;
  podName: string | null;
  cohortId: string | null;
}

export interface PodOption {
  value: string;
  label: string;
}

export async function fetchUsersForRolesTab(
  filterState: FilterState,
  sortState: SortState
): Promise<AdminUserRow[]> {
  const supabase = createClient();
  let query = supabase.from("users").select().is("deleted_at", null);
  query = applyFilters(query, USER_ROLE_FIELD_DEFS, filterState);
  query = applySort(query, USER_ROLE_FIELD_DEFS, sortState);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    fullName: (row.full_name as string) ?? null,
    email: (row.email as string) ?? null,
    schoolOrOrg: (row.school_or_org as string) ?? null,
    role: row.role as UserRole,
    approvalStatus: row.approval_status as ApprovalStatus,
    createdAt: row.created_at as string,
  }));
}

export async function fetchUsersForPodsTab(
  filterState: FilterState,
  sortState: SortState
): Promise<AdminUserPodRow[]> {
  const supabase = createClient();
  let query = supabase.from("v_user_pods").select();
  query = applyFilters(query, USER_POD_FIELD_DEFS, filterState);
  query = applySort(query, USER_POD_FIELD_DEFS, sortState);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    userId: row.user_id as string,
    fullName: (row.full_name as string) ?? null,
    email: (row.email as string) ?? null,
    role: row.role as UserRole,
    approvalStatus: row.approval_status as ApprovalStatus,
    podId: (row.pod_id as string) ?? null,
    podName: (row.pod_name as string) ?? null,
    cohortId: (row.cohort_id as string) ?? null,
  }));
}

export interface CohortOption {
  value: string;
  label: string;
}

export interface PodMemberSummary {
  userId: string;
  fullName: string | null;
  email: string | null;
  role: UserRole;
}

export interface PodOverview {
  id: string;
  name: string;
  cohortId: string;
  cohortName: string | null;
  skillLevel: string | null;
  mentors: PodMemberSummary[];
  mentees: PodMemberSummary[];
  associatesAndPms: PodMemberSummary[];
}

export async function fetchPodOptions(): Promise<PodOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pods")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []).map((pod) => ({ value: pod.id as string, label: pod.name as string }));
}

export async function fetchCohortOptions(): Promise<CohortOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cohorts")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []).map((cohort) => ({ value: cohort.id as string, label: cohort.name as string }));
}

export interface CreatePodInput {
  name: string;
  cohortId: string;
  skillLevel?: string;
  description?: string;
}

export async function createPod(input: CreatePodInput): Promise<PodOption> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pods")
    .insert({
      name: input.name,
      cohort_id: input.cohortId,
      skill_level: input.skillLevel ?? null,
      description: input.description ?? null,
    })
    .select("id, name")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create pod.");
  return { value: data.id as string, label: data.name as string };
}

/**
 * Grouped view for the pods overview panel: each pod with its members
 * split by role, so mentors/mentees are visually distinct rather than one
 * flat list. Uses two queries (pods, then all memberships via v_user_pods)
 * rather than a nested Supabase select, since v_user_pods already exists
 * and keeps this simple — fine at this data scale.
 */
export async function fetchPodsOverview(): Promise<PodOverview[]> {
  const supabase = createClient();

  const { data: pods, error: podsError } = await supabase
    .from("pods")
    .select("id, name, skill_level, cohort_id, cohorts(name)")
    .is("deleted_at", null)
    .order("name");
  if (podsError) throw new Error(podsError.message);

  const { data: members, error: membersError } = await supabase
    .from("v_user_pods")
    .select("user_id, full_name, email, role, pod_id")
    .not("pod_id", "is", null);
  if (membersError) throw new Error(membersError.message);

  return (pods ?? []).map((pod: Record<string, unknown>) => {
    const podId = pod.id as string;
    const podMembers = (members ?? []).filter((m: Record<string, unknown>) => m.pod_id === podId);

    const toSummary = (m: Record<string, unknown>): PodMemberSummary => ({
      userId: m.user_id as string,
      fullName: (m.full_name as string) ?? null,
      email: (m.email as string) ?? null,
      role: m.role as UserRole,
    });

    const cohort = pod.cohorts as { name: string } | null;

    return {
      id: podId,
      name: pod.name as string,
      cohortId: pod.cohort_id as string,
      cohortName: cohort?.name ?? null,
      skillLevel: (pod.skill_level as string) ?? null,
      mentors: podMembers.filter((m) => m.role === "mentor").map(toSummary),
      mentees: podMembers.filter((m) => m.role === "mentee").map(toSummary),
      associatesAndPms: podMembers
        .filter((m) => m.role === "associate" || m.role === "pm")
        .map(toSummary),
    };
  });
}

/**
 * UI-gated to PM only (see UserRolesTab) — not yet enforced by RLS.
 * Flagging: an associate could still call this directly today; add an RLS
 * policy on users.role updates before this ships past internal testing.
 */
export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("users").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);
}

/** Enforces "exactly one pod" by clearing any existing membership first. */
export async function assignUserToPod(userId: string, podId: string): Promise<void> {
  const supabase = createClient();

  const { error: deleteError } = await supabase.from("pod_members").delete().eq("user_id", userId);
  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await supabase
    .from("pod_members")
    .insert({ user_id: userId, pod_id: podId });
  if (insertError) throw new Error(insertError.message);
}

export async function removeUserFromPod(userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("pod_members").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}