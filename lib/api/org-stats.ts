// lib/api/org-stats.ts
import { createClient } from "@/lib/supabase/client";
import type { PodStats, MentorStats } from "@/types/admin";

export async function getPodStats(): Promise<PodStats[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_pod_stats")
    .select("*")
    .order("open_escalations", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PodStats[];
}

export async function getMentorStats(): Promise<MentorStats[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_mentor_stats")
    .select("*")
    .order("open_escalations_among_mentees", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MentorStats[];
}