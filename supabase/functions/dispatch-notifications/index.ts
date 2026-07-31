// /supabase/functions/dispatch-notifications/index.ts

// Deno edge function — not part of the Next.js build, uses npm: specifiers
// directly. Invoked on a schedule by pg_cron (see the migration alongside
// this file). Finds every user_notifications row that's still `pending`
// and whose parent notification's scheduled_for has passed, sends a Chrome
// push to each of that user's subscriptions, and marks the row `sent`.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") as string;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") as string;
const VAPID_CONTACT_EMAIL = Deno.env.get("VAPID_CONTACT_EMAIL") ?? "mailto:us@nazariacollective.in";

webpush.setVapidDetails(VAPID_CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface DueRow {
  notification_id: string;
  user_id: string;
  notifications: {
    title: string;
    body: string | null;
    type: string;
    meeting_id: string | null;
    mentee_assignment_id: string | null;
    exit_survey_id: string | null;
    message_id: string | null;
    resource_id: string | null;
  };
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}
const expected = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "";
console.log("expected length:", expected.length, "| got length:", authHeader?.length ?? -1);
console.log("expected last 6:", expected.slice(-6), "| got last 6:", authHeader?.slice(-6));
Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SECRET_KEYS")}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: due, error: dueError } = await supabase
    .from("user_notifications")
    .select(
      "notification_id, user_id, notifications!inner(title, body, type, meeting_id, mentee_assignment_id, exit_survey_id, message_id, resource_id, scheduled_for)"
    )
    .eq("status", "pending")
    .is("deleted_at", null)
    .lte("notifications.scheduled_for", new Date().toISOString())
    .limit(500);

  if (dueError) {
    return new Response(JSON.stringify({ error: dueError.message }), { status: 500 });
  }

  const rows = (due ?? []) as unknown as DueRow[];
  let sentCount = 0;
  let failedCount = 0;

  for (const row of rows) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", row.user_id)
      .is("deleted_at", null);

    const subscriptions = (subs ?? []) as SubscriptionRow[];

    const payload = JSON.stringify({
      title: row.notifications.title,
      body: row.notifications.body ?? "",
      data: {
        notificationId: row.notification_id,
        type: row.notifications.type,
        meetingId: row.notifications.meeting_id,
        menteeAssignmentId: row.notifications.mentee_assignment_id,
        exitSurveyId: row.notifications.exit_survey_id,
        messageId: row.notifications.message_id,
        resourceId: row.notifications.resource_id,
      },
    });

    let deliveredToAtLeastOne = subscriptions.length === 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        deliveredToAtLeastOne = true;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").update({ deleted_at: new Date().toISOString() }).eq("id", sub.id);
        }
      }
    }

    await supabase
      .from("user_notifications")
      .update({
        status: deliveredToAtLeastOne ? "sent" : "failed",
        sent_at: deliveredToAtLeastOne ? new Date().toISOString() : null,
      })
      .eq("notification_id", row.notification_id)
      .eq("user_id", row.user_id);

    if (deliveredToAtLeastOne) sentCount++;
    else failedCount++;
  }

  return new Response(JSON.stringify({ processed: rows.length, sent: sentCount, failed: failedCount }), {
    headers: { "Content-Type": "application/json" },
  });
});