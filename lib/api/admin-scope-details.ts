// lib/api/admin-scope-details.ts

import { createClient } from "@/lib/supabase/client";
import { fetchSelectablePeople } from "@/lib/api/people-picker";
import { fetchSubmittedExitSurveysForUser } from "@/lib/api/exit-surveys";
import { getMentorStats } from "@/lib/api/org-stats";
import type { AdminScope } from "@/lib/api/admin-scope";
import type { ExitSurveyRow } from "@/types/exit-survey";
import type { UserCardPerson } from "@/components/shared/UserCard";

export interface MenteeOverview {
  podName: string | null;
  mentorNames: string[];
  completedAssignments: number;
  totalAssignments: number;
  resourceStatusCounts: Record<string, number>;
  latestSurvey: ExitSurveyRow | null;
}

export async function fetchMenteeOverview(scope: AdminScope): Promise<MenteeOverview> {
  const supabase = createClient();

  const [podRow, mentorRows, assignmentRows, resourceRows, surveys] = await Promise.all([
    scope.podId
      ? supabase.from("pods").select("name").eq("id", scope.podId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    scope.podMentorIds.length > 0
      ? supabase.from("users").select("full_name").in("id", scope.podMentorIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("v_mentee_assignment_status").select("completion_status").eq("mentee_id", scope.userId),
    supabase.from("resources_and_courses").select("status").eq("assigned_to", scope.userId).is("deleted_at", null),
    fetchSubmittedExitSurveysForUser(scope.userId),
  ]);

  if (podRow.error) throw podRow.error;
  if (mentorRows.error) throw mentorRows.error;
  if (assignmentRows.error) throw assignmentRows.error;
  if (resourceRows.error) throw resourceRows.error;

  const assignments = (assignmentRows.data ?? []) as { completion_status: string }[];
  const resources = (resourceRows.data ?? []) as { status: string }[];

  const resourceStatusCounts: Record<string, number> = {};
  for (const r of resources) {
    resourceStatusCounts[r.status] = (resourceStatusCounts[r.status] ?? 0) + 1;
  }

  return {
    podName: (podRow.data as { name: string } | null)?.name ?? null,
    mentorNames: ((mentorRows.data ?? []) as { full_name: string | null }[]).map((m) => m.full_name ?? "Unnamed"),
    completedAssignments: assignments.filter((a) => a.completion_status === "completed").length,
    totalAssignments: assignments.length,
    resourceStatusCounts,
    latestSurvey: surveys[0] ?? null,
  };
}

export interface MentorOverview {
  podName: string | null;
  mentees: UserCardPerson[];
  completedAssignments: number;
  totalAssignments: number;
  openEscalations: number;
}

export async function fetchMentorOverview(scope: AdminScope): Promise<MentorOverview> {
  const supabase = createClient();

  const [podRow, mentees, mentorStatsRows] = await Promise.all([
    scope.podId
      ? supabase.from("pods").select("name").eq("id", scope.podId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    fetchSelectablePeople({ role: "mentee", mentorId: scope.userId }),
    getMentorStats(scope), // already filters to just this mentor's row when scope.role === "mentor"
  ]);

  if (podRow.error) throw podRow.error;

  const statsRow = mentorStatsRows[0];

  return {
    podName: (podRow.data as { name: string } | null)?.name ?? null,
    mentees,
    completedAssignments: statsRow?.completed_assignments ?? 0,
    totalAssignments: statsRow?.total_assignments ?? 0,
    openEscalations: statsRow?.open_escalations_among_mentees ?? 0,
  };
}