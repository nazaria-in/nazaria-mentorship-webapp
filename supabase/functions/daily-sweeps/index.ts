// /supabase/functions/daily-sweeps/index.ts

// Deno edge function — invoked once daily at 09:00 UTC by pg_cron.
// Unlike dispatch-notifications (which flushes pre-scheduled rows), this
// function DECIDES whether new notifications are needed by checking live
// state. "Still not done N days later" can't be pre-scheduled at creation
// time, so it's evaluated here.
//
// SECTIONS
//   1. Overdue assignments  — content_dispatches that are past due_at and
//                           not yet completed, using v_mentee_assignment_status.
//   2. Overdue exit surveys — exit_surveys that are unsubmitted and past
//                           their meeting's ends_at.
//
// REMOVED SECTION (schema no longer exists):
//   3. Stale resources — previously queried resources_and_courses and
//      resource_updates tables, both of which were deleted when the content
//      model moved to content_items / content_dispatches. Removed rather
//      than guessed around. Re-add if a "stale content" sweep is ever
//      re-scoped against the new schema.
//
// Constants below duplicate lib/notifications/config.ts intentionally —
// this Deno function cannot import Next.js-aliased paths. Keep the two in
// sync if you change these values.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

const MAX_OVERDUE_REMINDERS = 2;
const OVERDUE_REMINDER_SPACING_DAYS = 3;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

interface AssignmentStatusRow {
  content_dispatch_id: string;
  mentee_id: string;
  due_at: string | null;
  completion_status: string;
  content_item_id: string;
}

interface ContentItemRow {
  id: string;
  title: string;
}

interface ExitSurveyRow {
  id: string;
  user_id: string;
  meeting_id: string;
  meetings: {
    title: string;
    ends_at: string;
  } | null;
}

interface PriorReminderRow {
  created_at: string;
}

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("authorization");
  let authorized = false;

  try {
    const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (secretKeysJson) {
      const keysObj = JSON.parse(secretKeysJson);
      const validKeys = Object.values(keysObj);
      authorized = validKeys.some((k) => authHeader === `Bearer ${k}`);
    }
  } catch {
    // Ignore parsing errors and check fallback
  }

  if (SERVICE_ROLE_KEY && authHeader === `Bearer ${SERVICE_ROLE_KEY}`) {
    authorized = true;
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const now = new Date().toISOString();
  const spacingCutoff = daysAgoIso(OVERDUE_REMINDER_SPACING_DAYS);

  const results = {
    overdueAssignments: 0,
    overdueExitSurveys: 0,
  };

  // ── 1. Overdue assignments ───────────────────────────────────────────────
  // v_mentee_assignment_status joins content_dispatches + content_submissions
  // and exposes completion_status as a computed column. We want dispatches
  // that have a due_at in the past and are not yet marked completed.
  const { data: overdueAssignments, error: assignmentsError } = await supabase
    .from("v_mentee_assignment_status")
    .select("content_dispatch_id, mentee_id, due_at, completion_status, content_item_id")
    .neq("completion_status", "completed")
    .not("due_at", "is", null)
    .lt("due_at", now);

  if (assignmentsError) {
    console.error("[daily-sweeps] Failed to fetch overdue assignments", assignmentsError);
  }

  for (const row of (overdueAssignments ?? []) as AssignmentStatusRow[]) {
    if (!row.due_at) continue;

    // Fetch the content item title for the notification copy.
    const { data: contentItem } = await supabase
      .from("content_items")
      .select("id, title")
      .eq("id", row.content_item_id)
      .single<ContentItemRow>();

    const title = contentItem?.title ?? "Assignment";

    // Count how many overdue reminders have already been sent for this
    // dispatch — stop after MAX_OVERDUE_REMINDERS.
    const { data: priorReminders } = await supabase
      .from("notifications")
      .select("created_at")
      .eq("content_dispatch_id", row.content_dispatch_id)
      .eq("type", "reminder")
      .gt("created_at", row.due_at)
      .order("created_at", { ascending: false });

    const overdueCount = (priorReminders ?? []).length;
    if (overdueCount >= MAX_OVERDUE_REMINDERS) continue;

    // Don't re-nudge if we already sent one within the spacing window.
    const lastSentAt = (priorReminders as PriorReminderRow[] | null)?.[0]
      ?.created_at;
    if (lastSentAt && lastSentAt > spacingCutoff) continue;

    const { data: notification } = await supabase
      .from("notifications")
      .insert({
        type: "reminder",
        title: `${title} — overdue`,
        body: "This item is overdue. Please submit as soon as you can.",
        content_dispatch_id: row.content_dispatch_id,
        scheduled_for: now,
      })
      .select("id")
      .single();

    if (notification) {
      await supabase.from("user_notifications").insert({
        notification_id: notification.id,
        user_id: row.mentee_id,
        status: "pending",
      });
      results.overdueAssignments++;
    }
  }

  // ── 2. Overdue exit surveys ──────────────────────────────────────────────
  // exit_surveys rows with no submitted_at whose meeting has already ended.
  const { data: overdueSurveys, error: surveysError } = await supabase
    .from("exit_surveys")
    .select("id, user_id, meeting_id, meetings(title, ends_at)")
    .is("submitted_at", null);

  if (surveysError) {
    console.error("[daily-sweeps] Failed to fetch overdue exit surveys", surveysError);
  }

  for (const row of (overdueSurveys ?? []) as ExitSurveyRow[]) {
    const meeting = row.meetings;
    // Skip surveys whose meeting hasn't ended yet.
    if (!meeting || meeting.ends_at >= now) continue;

    // Count how many overdue nudges have been sent for this survey after
    // the meeting ended.
    const { data: priorReminders } = await supabase
      .from("notifications")
      .select("created_at")
      .eq("exit_survey_id", row.id)
      .eq("type", "exit_survey_pending")
      .gt("created_at", meeting.ends_at)
      .order("created_at", { ascending: false });

    const overdueCount = (priorReminders ?? []).length;
    if (overdueCount >= MAX_OVERDUE_REMINDERS) continue;

    const lastSentAt = (priorReminders as PriorReminderRow[] | null)?.[0]
      ?.created_at;
    if (lastSentAt && lastSentAt > spacingCutoff) continue;

    const { data: notification } = await supabase
      .from("notifications")
      .insert({
        type: "exit_survey_pending",
        title: `Exit survey overdue — ${meeting.title}`,
        body: "Please fill out your exit survey when you get a chance.",
        meeting_id: row.meeting_id,
        exit_survey_id: row.id,
        scheduled_for: now,
      })
      .select("id")
      .single();

    if (notification) {
      await supabase.from("user_notifications").insert({
        notification_id: notification.id,
        user_id: row.user_id,
        status: "pending",
      });
      results.overdueExitSurveys++;
    }
  }

  console.log("[daily-sweeps] done", results);

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
});