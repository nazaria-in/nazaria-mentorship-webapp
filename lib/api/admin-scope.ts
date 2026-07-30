// lib/api/admin-scope.ts
import { createClient } from "@/lib/supabase/client";

export interface AdminScope {
  userId: string;
  role: "pm" | "associate" | "mentor" | "mentee";
  podId: string | null;
  /** Mentors in the same pod as this user (relevant when role is mentee too). */
  podMentorIds: string[];
  /** Mentees in the same pod as this user (relevant when role is mentor too). */
  podMenteeIds: string[];
}

/**
 * Resolves the `?id=` query param into a scope every dashboard section can
 * filter against. pm/associate get an "unscoped" result (podId null, empty
 * member lists) — callers should show a banner and fall back to org-wide
 * data rather than try to filter by this, per admin-rework-plan.md §1.3.
 */
export async function resolveAdminScope(userId: string): Promise<AdminScope> {
  const supabase = createClient();

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .single();
  if (userError || !userRow) throw userError ?? new Error("User not found");

  const role = userRow.role as AdminScope["role"];

  if (role === "pm" || role === "associate") {
    return { userId, role, podId: null, podMentorIds: [], podMenteeIds: [] };
  }

  const { data: podRow, error: podError } = await supabase
    .from("v_user_pods")
    .select("pod_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (podError) throw podError;
  const podId = (podRow?.pod_id as string | undefined) ?? null;

  if (!podId) {
    return { userId, role, podId: null, podMentorIds: [], podMenteeIds: [] };
  }

  const { data: rosterRows, error: rosterError } = await supabase
    .from("v_user_pods")
    .select("user_id, role")
    .eq("pod_id", podId);
  if (rosterError) throw rosterError;

  const roster = (rosterRows ?? []) as { user_id: string; role: string }[];
  return {
    userId,
    role,
    podId,
    podMentorIds: roster.filter((r) => r.role === "mentor").map((r) => r.user_id),
    podMenteeIds: roster.filter((r) => r.role === "mentee").map((r) => r.user_id),
  };
}