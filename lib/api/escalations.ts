// lib/api/escalations.ts
import { createClient } from "@/lib/supabase/client";
import type { Escalation } from "@/types/admin";
import type { AdminScope } from "@/lib/api/admin-scope";

/**
 * scope narrows to a single mentee's own escalations, or a mentor's pod
 * mentees' escalations — same rule org-stats.ts uses for pod/mentor stats
 * (see admin-rework-plan.md §1.3). pm/associate scope (podId null, empty
 * member lists) intentionally falls through to unfiltered/org-wide.
 */
export async function getEscalations(scope?: AdminScope | null): Promise<Escalation[]> {
  const supabase = createClient();
  let query = supabase.from("v_escalations").select("*");

  if (scope) {
    if (scope.role === "mentee") {
      query = query.eq("subject_user_id", scope.userId);
    } else if (scope.role === "mentor") {
      if (scope.podMenteeIds.length === 0) {
        return []; // mentor with no pod mentees — nothing to show, not org-wide
      }
      query = query.in("subject_user_id", scope.podMenteeIds);
    }
    // pm/associate: no podId/member lists to filter by — falls through unfiltered
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;

  const urgencyRank: Record<string, number> = { urgent: 0, soon: 1, none: 2 };

  return ((data ?? []) as Escalation[]).sort((a, b) => {
    const rankDiff = urgencyRank[a.follow_up_urgency] - urgencyRank[b.follow_up_urgency];
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/**
 * "Reviewed" isn't a separate column — it's just clearing the existing
 * needs_follow_up flag (and urgency, since there's nothing left to follow
 * up on). No new columns, reuses what's already there.
 *
 * LIMITATION: v_escalations also includes rows purely because signal =
 * 'red', independent of needs_follow_up. This function does NOT touch
 * signal — clearing it would falsify the record. A red-signal survey with
 * needs_follow_up already false will still show up in the feed after
 * calling this. Dismissing that case cleanly needs a new column (e.g.
 * reviewed_at) — flagging, not solving here.
 */
export async function markEscalationReviewed(exitSurveyId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("exit_surveys")
    .update({ needs_follow_up: false, follow_up_urgency: "none" })
    .eq("id", exitSurveyId);

  if (error) throw error;
}