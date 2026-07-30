// lib/api/cohorts-browser.ts
//
// Kept separate from lib/api/pods.ts (haven't seen its contents) — merge in
// if it already has overlapping fetchers.

import { createClient } from "@/lib/supabase/client";

export interface CohortSummary {
  id: string;
  name: string;
  status: "upcoming" | "active" | "completed";
}

export interface PodSummary {
  id: string;
  name: string;
  cohort_id: string;
}

export interface PodMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: "pm" | "associate" | "mentor" | "mentee";
  approval_status: "pending" | "approved" | "rejected";
  school_or_org: string | null;
}

export async function fetchCohorts(): Promise<CohortSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cohorts")
    .select("id, name, status")
    .is("deleted_at", null)
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CohortSummary[];
}

export async function fetchPodsForCohort(cohortId: string): Promise<PodSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pods")
    .select("id, name, cohort_id")
    .eq("cohort_id", cohortId)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PodSummary[];
}

export async function fetchPodRoster(podId: string): Promise<PodMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_user_pods")
    .select("user_id, full_name, email, role, approval_status, school_or_org")
    .eq("pod_id", podId)
    .order("role", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PodMember[];
}