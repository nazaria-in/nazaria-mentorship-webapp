// lib/api/escalations.ts
import { createClient } from "@/lib/supabase/client";
import type { Escalation } from "@/types/admin";

export async function getEscalations(): Promise<Escalation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_escalations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const urgencyRank: Record<string, number> = { urgent: 0, soon: 1, none: 2 };

  return ((data ?? []) as Escalation[]).sort((a, b) => {
    const rankDiff =
      urgencyRank[a.follow_up_urgency] - urgencyRank[b.follow_up_urgency];
    if (rankDiff !== 0) return rankDiff;
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });
}

/**
 * "Reviewed" isn't a separate column — it's just clearing the existing
 * needs_follow_up flag (and urgency, since there's nothing left to follow
 * up on). No new columns, reuses what's already there.
 *
 * LIMITATION, read before wiring this into UI: v_escalations also includes
 * rows purely because signal = 'red', independent of needs_follow_up. This
 * function does NOT touch signal (it's the survey's actual content/rating,
 * not an actionable flag — clearing it would falsify the record). That
 * means a red-signal survey with needs_follow_up already false will still
 * show up in the escalation feed after calling this, and there's no clean
 * schema-only way to "dismiss" it. If you want red-signal escalations to be
 * dismissible too, that genuinely needs a new column (e.g. reviewed_at) —
 * there's no way around it with the existing columns. Flagging rather than
 * quietly building something that looks like it works but doesn't cover
 * this case.
 */
export async function markEscalationReviewed(
  exitSurveyId: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("exit_surveys")
    .update({ needs_follow_up: false, follow_up_urgency: "none" })
    .eq("id", exitSurveyId);

  if (error) throw error;
}