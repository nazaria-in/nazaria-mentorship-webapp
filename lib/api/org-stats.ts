// lib/api/org-stats.ts
import { createClient } from "@/lib/supabase/client";
import type { PodStats, MentorStats } from "@/types/admin";
import type { AdminScope } from "@/lib/api/admin-scope";

export async function getPodStats(scope?: AdminScope | null): Promise<PodStats[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_pod_stats")
    .select("*")
    .order("open_escalations", { ascending: false });
  if (error) throw error;
  let rows = (data ?? []) as PodStats[];

  if (scope && scope.podId) {
    rows = rows.filter((r) => r.pod_id === scope.podId);
  } else if (scope && (scope.role === "mentor" || scope.role === "mentee") && !scope.podId) {
    rows = []; // scoped to a person with no pod — nothing to show, not everything
  }

  return rows;
}

export async function getMentorStats(scope?: AdminScope | null): Promise<MentorStats[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_mentor_stats")
    .select("*")
    .order("open_escalations_among_mentees", { ascending: false });
  if (error) throw error;
  let rows = (data ?? []) as MentorStats[];

  if (scope) {
    if (scope.role === "mentor") {
      rows = rows.filter((r) => r.mentor_id === scope.userId);
    } else if (scope.role === "mentee") {
      const mentorSet = new Set(scope.podMentorIds);
      rows = rows.filter((r) => mentorSet.has(r.mentor_id));
    }
  }

  return rows;
}