// /supabase/functions/daily-sweeps/index.ts

// Deno edge function, invoked once daily by pg_cron (see the migration
// alongside this file). Unlike dispatch-notifications (which just flushes
// pre-scheduled rows), this one DECIDES whether new notifications are
// needed by checking live state — overdue assignments, overdue exit
// surveys, and stale resources can't be pre-scheduled at creation time
// the way meeting/assignment cascades can, because "still not done N days
// later" isn't knowable in advance.
//
// Constants below duplicate lib/notifications/config.ts — this function
// can't import that Next.js-aliased file directly (different runtime).
// Keep the two in sync if you change these numbers.


import { createClient } from "@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

const MAX_OVERDUE_REMINDERS = 2;
const OVERDUE_REMINDER_SPACING_DAYS = 3;
const RESOURCE_STALE_DAYS = 7;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SECRET_KEYS")}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const now = new Date().toISOString();

  const results = {
    overdueAssignments: 0,
    overdueExitSurveys: 0,
    staleResources: 0,
  };

  // ---- 1. Overdue assignments ----
  const { data: overdueAssignments } = await supabase
    .from("mentee_assignments")
    .select("id, mentee_id, due_at, assignment:assignments(title)")
    .eq("is_completed", false)
    .lt("due_at", now);

  for (const row of overdueAssignments ?? []) {
    const assignmentTitle = (row as unknown as { assignment: { title: string } | null }).assignment?.title ?? "Assignment";

    const { data: priorReminders } = await supabase
      .from("notifications")
      .select("created_at")
      .eq("mentee_assignment_id", row.id)
      .eq("type", "assignment_due")
      .gt("created_at", row.due_at as string)
      .order("created_at", { ascending: false });

    const overdueCount = priorReminders?.length ?? 0;
    if (overdueCount >= MAX_OVERDUE_REMINDERS) continue;

    const lastSentAt = priorReminders?.[0]?.created_at as string | undefined;
    if (lastSentAt && new Date(lastSentAt).getTime() > Date.now() - OVERDUE_REMINDER_SPACING_DAYS * 86_400_000) {
      continue;
    }

    const { data: notification } = await supabase
      .from("notifications")
      .insert({
        type: "assignment_due",
        title: `${assignmentTitle} — overdue`,
        body: "This assignment is overdue. Please submit as soon as you can.",
        mentee_assignment_id: row.id,
        scheduled_for: now,
      })
      .select("id")
      .single();

    if (notification) {
      await supabase
        .from("user_notifications")
        .insert({ notification_id: notification.id, user_id: row.mentee_id, status: "pending" });
      results.overdueAssignments++;
    }
  }

  // ---- 2. Overdue exit surveys ----
  const { data: overdueSurveys } = await supabase
    .from("exit_surveys")
    .select("id, user_id, meeting:meetings(id, title, ends_at)")
    .is("submitted_at", null);

  for (const row of overdueSurveys ?? []) {
    const meeting = (row as unknown as { meeting: { id: string; title: string; ends_at: string } | null }).meeting;
    if (!meeting || meeting.ends_at >= now) continue;

    const { data: priorReminders } = await supabase
      .from("notifications")
      .select("created_at")
      .eq("exit_survey_id", row.id)
      .eq("type", "exit_survey_pending")
      .gt("created_at", meeting.ends_at)
      .order("created_at", { ascending: false });

    const overdueCount = priorReminders?.length ?? 0;
    if (overdueCount >= MAX_OVERDUE_REMINDERS) continue;

    const lastSentAt = priorReminders?.[0]?.created_at as string | undefined;
    if (lastSentAt && new Date(lastSentAt).getTime() > Date.now() - OVERDUE_REMINDER_SPACING_DAYS * 86_400_000) {
      continue;
    }

    const { data: notification } = await supabase
      .from("notifications")
      .insert({
        type: "exit_survey_pending",
        title: `Exit survey overdue — ${meeting.title}`,
        body: "Please fill out your exit survey when you get a chance.",
        meeting_id: meeting.id,
        exit_survey_id: row.id,
        scheduled_for: now,
      })
      .select("id")
      .single();

    if (notification) {
      await supabase
        .from("user_notifications")
        .insert({ notification_id: notification.id, user_id: row.user_id, status: "pending" });
      results.overdueExitSurveys++;
    }
  }

  // ---- 3. Stale resources ----
  const { data: ongoingResources } = await supabase
    .from("resources_and_courses")
    .select("id, title, assigned_to")
    .eq("status", "ongoing")
    .is("deleted_at", null)
    .not("assigned_to", "is", null);

  const staleCutoff = daysAgoIso(RESOURCE_STALE_DAYS);

  for (const resource of ongoingResources ?? []) {
    const { count: recentUpdateCount } = await supabase
      .from("resource_updates")
      .select("id", { count: "exact", head: true })
      .eq("resource_id", resource.id)
      .is("deleted_at", null)
      .gt("created_at", staleCutoff);

    if ((recentUpdateCount ?? 0) > 0) continue;

    const { count: recentReminderCount } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("resource_id", resource.id)
      .eq("type", "reminder")
      .gt("created_at", staleCutoff);

    if ((recentReminderCount ?? 0) > 0) continue;

    const { data: notification } = await supabase
      .from("notifications")
      .insert({
        type: "reminder",
        title: `${resource.title} — weekly check-in`,
        body: "Add a progress update so your mentor can see where things stand.",
        resource_id: resource.id,
        scheduled_for: now,
      })
      .select("id")
      .single();

    if (notification) {
      await supabase
        .from("user_notifications")
        .insert({ notification_id: notification.id, user_id: resource.assigned_to, status: "pending" });
      results.staleResources++;
    }
  }

  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
});