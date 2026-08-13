// /lib/api/pods.ts

import { createClient } from "@/lib/supabase/client";
import type { UserRole, ApprovalStatus } from "@/types/users";
import type { PodWithMembers } from "@/types/pods";

interface PodRow {
  id: string;
  name: string;
  cohort_id: string;
  cohorts: { name: string } | null;
}

interface PodMemberRow {
  pod_id: string;
  user: { id: string; full_name: string | null; role: UserRole; approval_status: ApprovalStatus } | null;
}

export interface FetchPodMemberGroupsParams {
  /** Only members with this role are surfaced as selectable inside each pod. */
  role: UserRole;
  /** Scope to one mentor's own pods (found via their own pod_members rows). Ignored if podId is set. */
  mentorId?: string;
  /** Scope to a single pod. */
  podId?: string;
  /** Default true — matches fetchUsersByApproval's existing "approved only" convention for anything selectable in a dispatch flow. */
  onlyApproved?: boolean;
  /** Default false — pods with zero matching members are dropped from the result, since an empty pod card isn't useful in a selection UI. */
  includeEmptyPods?: boolean;
}

export async function fetchPodMemberGroups(params: FetchPodMemberGroupsParams): Promise<PodWithMembers[]> {
  const { role, mentorId, podId, onlyApproved = true, includeEmptyPods = false } = params;
  const supabase = createClient();

  let podIds: string[] | undefined;

  if (podId) {
    podIds = [podId];
  } else if (mentorId) {
    const { data: mentorPodRows, error: mentorPodError } = await supabase
      .from("pod_members")
      .select("pod_id")
      .eq("user_id", mentorId);
    if (mentorPodError) throw mentorPodError;
    podIds = (mentorPodRows ?? []).map((r) => r.pod_id as string);
    if (podIds.length === 0) return []; // mentor isn't in any pod yet
  }

  let podsQuery = supabase.from("pods").select("id, name, cohort_id, cohorts(name)").is("deleted_at", null);
  if (podIds) podsQuery = podsQuery.in("id", podIds);
  const { data: pods, error: podsError } = await podsQuery.order("name", { ascending: true });
  if (podsError) throw podsError;
  const typedPods = (pods ?? []) as unknown as PodRow[];
  if (typedPods.length === 0) return [];

  const relevantPodIds = typedPods.map((p) => p.id);

  const { data: memberRows, error: membersError } = await supabase
    .from("pod_members")
    .select("pod_id, user:users!pod_members_user_id_fkey(id, full_name, role, approval_status)")
    .in("pod_id", relevantPodIds);
  if (membersError) throw membersError;
  const typedMembers = (memberRows ?? []) as unknown as PodMemberRow[];

  const membersByPod = new Map<string, PodWithMembers["members"]>();
  for (const row of typedMembers) {
    if (!row.user) continue;
    if (row.user.role !== role) continue;
    if (onlyApproved && row.user.approval_status !== "approved") continue;
    const list = membersByPod.get(row.pod_id) ?? [];
    list.push({ id: row.user.id, full_name: row.user.full_name?.trim() || "Unnamed" });
    membersByPod.set(row.pod_id, list);
  }

  return typedPods
    .map((p) => ({
      id: p.id,
      name: p.name,
      cohortId: p.cohort_id,
      cohortName: p.cohorts?.name,
      members: (membersByPod.get(p.id) ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    }))
    .filter((pod) => includeEmptyPods || pod.members.length > 0);
}

/**
 * Every non-deleted pod across every cohort — including pods with zero
 * matching members — with members restricted to `roles`. Distinct from
 * fetchPodMemberGroups (which scopes to one mentor/pod and defaults to
 * hiding empty pods): this is for staff-facing pickers (invite lists,
 * roster assignment) where a PM/associate needs to see and select into
 * every team, populated or not, e.g. "select everyone on an empty team"
 * being a harmless no-op rather than the team not existing in the UI.
 */
export async function fetchAllPodGroupsForRoles(roles: UserRole[]): Promise<PodWithMembers[]> {
  const supabase = createClient();

  const { data: pods, error: podsError } = await supabase
    .from("pods")
    .select("id, name, cohort_id, cohorts(name)")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (podsError) throw podsError;
  const typedPods = (pods ?? []) as unknown as PodRow[];
  if (typedPods.length === 0) return [];

  const podIds = typedPods.map((p) => p.id);

  const { data: memberRows, error: membersError } = await supabase
    .from("pod_members")
    .select("pod_id, user:users!pod_members_user_id_fkey(id, full_name, role, approval_status)")
    .in("pod_id", podIds);
  if (membersError) throw membersError;
  const typedMembers = (memberRows ?? []) as unknown as PodMemberRow[];

  const membersByPod = new Map<string, PodWithMembers["members"]>();
  for (const row of typedMembers) {
    if (!row.user) continue;
    if (!roles.includes(row.user.role)) continue;
    if (row.user.approval_status !== "approved") continue;
    const list = membersByPod.get(row.pod_id) ?? [];
    list.push({ id: row.user.id, full_name: row.user.full_name?.trim() || "Unnamed" });
    membersByPod.set(row.pod_id, list);
  }

  return typedPods.map((p) => ({
    id: p.id,
    name: p.name,
    cohortId: p.cohort_id,
    cohortName: p.cohorts?.name,
    members: (membersByPod.get(p.id) ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name)),
  }));
}


/**
 * Every mentee id sitting in any pod this mentor is a member of. Used to
 * scope the mentor's assignments/courses/resources list to "dispatched to
 * my mentees" rather than "created by me". Mirrors the mentorId branch in
 * fetchPodMemberGroups (same pod_members lookup), but flattened to just
 * ids across all the mentor's pods instead of grouped per-pod.
 */
export async function getMenteeIdsForMentor(mentorId: string): Promise<string[]> {
  const supabase = createClient();

  const { data: mentorPodRows, error: mentorPodError } = await supabase
    .from("pod_members")
    .select("pod_id")
    .eq("user_id", mentorId);
  if (mentorPodError) throw mentorPodError;

  const podIds = Array.from(new Set((mentorPodRows ?? []).map((r) => r.pod_id as string)));
  if (podIds.length === 0) return [];

  const { data: memberRows, error: membersError } = await supabase
    .from("pod_members")
    .select("user:users!pod_members_user_id_fkey(id, role)")
    .in("pod_id", podIds);
  if (membersError) throw membersError;

  const typedRows = (memberRows ?? []) as unknown as { user: { id: string; role: string } | null }[];

  return Array.from(
    new Set(
      typedRows
        .filter((row) => row.user !== null && row.user.role === "mentee")
        .map((row) => row.user!.id)
    )
  );
}