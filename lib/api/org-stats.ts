// lib/api/org-stats.ts
import { createClient } from "@/lib/supabase/client";
import type { PodStats, MentorStats, PendingExitSurveySummaryRow, PendingExitSurveySummaryEntry } from "@/types/admin";
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
    rows = []; // scoped to a person with no team — nothing to show, not everything
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

/**
 * Per-mentee/mentor rollup of currently-unfilled exit surveys, for the
 * staff dashboard's ExitSurveyCompletionSection.
 *
 * There's no view for this the way v_mentor_stats covers mentors —
 * v_pod_stats only rolls mentees up at the pod level — so this fetches
 * the raw v_pending_exit_surveys rows and enriches them with v_user_pods
 * (name/role/pod/cohort) client-side, same "fetch then enrich" approach
 * mergeContext() in lib/api/exit-surveys.ts already uses.
 */
export async function getExitSurveyPendingSummary(scope?: AdminScope | null): Promise<PendingExitSurveySummaryRow[]> {
  const supabase = createClient();

  const { data: pendingRows, error: pendingError } = await supabase.from("v_pending_exit_surveys").select("*");
  if (pendingError) throw pendingError;
  if (!pendingRows || pendingRows.length === 0) return [];

  const userIds = Array.from(new Set(pendingRows.map((r) => r.user_id as string)));

  const { data: userPodRows, error: userPodError } = await supabase
    .from("v_user_pods")
    .select("user_id, full_name, role, pod_id, pod_name, cohort_id")
    .in("user_id", userIds);
  if (userPodError) throw userPodError;

  const userInfoById = new Map((userPodRows ?? []).map((r) => [r.user_id as string, r]));

  const grouped = new Map<string, PendingExitSurveySummaryRow>();

  for (const row of pendingRows) {
    const userId = row.user_id as string;
    const info = userInfoById.get(userId);
    // Exit surveys are only ever owed by mentors/mentees — skip anything
    // else defensively (a pm/associate row shouldn't appear here, but
    // don't silently misclassify one if it somehow does).
    if (!info || (info.role !== "mentor" && info.role !== "mentee")) continue;

    const entry: PendingExitSurveySummaryEntry = {
      exitSurveyId: row.exit_survey_id as string,
      meetingTitle: row.title as string,
      createdAt: row.created_at as string,
    };

    const existing = grouped.get(userId);
    if (existing) {
      existing.pendingCount += 1;
      existing.surveys.push(entry);
      if (entry.createdAt < existing.oldestCreatedAt) existing.oldestCreatedAt = entry.createdAt;
    } else {
      grouped.set(userId, {
        userId,
        fullName: (info.full_name as string) ?? null,
        role: info.role as "mentor" | "mentee",
        podId: (info.pod_id as string) ?? null,
        podName: (info.pod_name as string) ?? null,
        cohortId: (info.cohort_id as string) ?? null,
        pendingCount: 1,
        oldestCreatedAt: entry.createdAt,
        surveys: [entry],
      });
    }
  }

  let rows = Array.from(grouped.values());

  if (scope && scope.podId) {
    rows = rows.filter((r) => r.podId === scope.podId);
  } else if (scope && (scope.role === "mentor" || scope.role === "mentee") && !scope.podId) {
    rows = [];
  }

  return rows.sort((a, b) => b.pendingCount - a.pendingCount || (a.oldestCreatedAt < b.oldestCreatedAt ? -1 : 1));
}