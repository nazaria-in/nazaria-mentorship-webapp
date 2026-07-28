// /lib/server/exit-survey-provisioning.ts

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ExitSurveyTemplateEntry } from "@/types/exit-survey";

/**
 * One pending row per mentee (their own survey) plus one pending row per
 * (mentor, mentee) pair (that mentor's survey about that specific mentee),
 * using whichever template is currently active for each role. Snapshots
 * the template's questions AND voice_prompt_label at creation time.
 *
 * Idempotent-ish: uses upsert with ignoreDuplicates on the
 * (meeting_id, user_id, subject_user_id) unique constraint, so calling
 * this twice for the same meeting (e.g. via the manual backfill route)
 * won't create duplicate rows or clobber already-submitted ones.
 *
 * If a role has no active template, that role's rows are skipped with a
 * console.warn rather than throwing — meeting creation should never fail
 * because of a missing template, but this IS the most likely reason a
 * meeting ends up with zero exit surveys, so check server logs for this
 * warning first when debugging a "no exit survey was created" report.
 */
export async function createPendingExitSurveys(
  meetingId: string,
  participantIds: string[]
): Promise<{ rowsCreated: number; warnings: string[] }> {
  const admin = supabaseAdmin;
  const warnings: string[] = [];

  const { data: profiles, error: profilesError } = await admin
    .from("users")
    .select("id, role")
    .in("id", participantIds);
  if (profilesError) throw new Error(`Failed to load participant profiles: ${profilesError.message}`);

  // Only mentor/mentee ever get rows — pm/associate participants (e.g. sitting
  // in on a meeting) are intentionally excluded here, not filtered anywhere
  // downstream. Confirmed: no exit survey should exist for pm/associate.
  const mentorIds = (profiles ?? []).filter((p) => p.role === "mentor").map((p) => p.id as string);
  const menteeIds = (profiles ?? []).filter((p) => p.role === "mentee").map((p) => p.id as string);

  if (mentorIds.length === 0 && menteeIds.length === 0) {
    warnings.push("No mentor or mentee participants — no exit survey rows to create.");
    return { rowsCreated: 0, warnings };
  }

  const { data: templates, error: templatesError } = await admin
    .from("exit_survey_templates")
    .select("id, role, questions, voice_prompt_label")
    .in("role", ["mentor", "mentee"])
    .eq("is_active", true);
  if (templatesError) throw new Error(`Failed to load active templates: ${templatesError.message}`);

  const mentorTemplate = (templates ?? []).find((t) => t.role === "mentor");
  const menteeTemplate = (templates ?? []).find((t) => t.role === "mentee");

  if (!mentorTemplate) {
    const msg = "No active mentor exit survey template — mentor rows skipped.";
    console.warn(`[exit-survey-provisioning] ${msg} meetingId=${meetingId}`);
    warnings.push(msg);
  }
  if (!menteeTemplate) {
    const msg = "No active mentee exit survey template — mentee rows skipped.";
    console.warn(`[exit-survey-provisioning] ${msg} meetingId=${meetingId}`);
    warnings.push(msg);
  }

  const rows: Record<string, unknown>[] = [];

  for (const menteeId of menteeIds) {
    if (menteeTemplate) {
      rows.push({
        meeting_id: meetingId,
        user_id: menteeId,
        subject_user_id: menteeId,
        user_role: "mentee",
        template_id: menteeTemplate.id,
        template_snapshot: menteeTemplate.questions as ExitSurveyTemplateEntry[],
        voice_prompt_label: menteeTemplate.voice_prompt_label ?? null,
      });
    }
    if (mentorTemplate) {
      for (const mentorId of mentorIds) {
        rows.push({
          meeting_id: meetingId,
          user_id: mentorId,
          subject_user_id: menteeId,
          user_role: "mentor",
          template_id: mentorTemplate.id,
          template_snapshot: mentorTemplate.questions as ExitSurveyTemplateEntry[],
          voice_prompt_label: mentorTemplate.voice_prompt_label ?? null,
        });
      }
    }
  }

  if (rows.length === 0) {
    return { rowsCreated: 0, warnings };
  }

  const { error: insertError, count } = await admin
    .from("exit_surveys")
    .upsert(rows, { onConflict: "meeting_id,user_id,subject_user_id", ignoreDuplicates: true, count: "exact" });

  if (insertError) throw new Error(`Failed to insert exit survey rows: ${insertError.message}`);

  return { rowsCreated: count ?? rows.length, warnings };
}