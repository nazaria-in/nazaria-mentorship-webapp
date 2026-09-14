// /supabase/functions/dispatch-notifications/index.ts

// Deno edge function — invoked every 5 minutes by pg_cron.
// Finds every user_notifications row that is still `pending` and whose
// parent notification's scheduled_for has passed, sends a browser push to
// each of that user's subscriptions, and marks the row `sent` or `failed`.
//
// BACKLOG DRAIN STRATEGY
// When this function was re-deployed after a period of being broken, there
// were thousands of pending rows from the past month. To avoid sending
// hundreds of push notifications at once to users for long-past events, we
// split processing into two groups per invocation:
//
//   Group A — rows older than BACKLOG_CUTOFF_HOURS:
//     Mark `sent` immediately. No push sent. These are stale; the user
//     already saw them in-app (or they are irrelevant). Limit: BATCH_STALE.
//
//   Group B — rows newer than BACKLOG_CUTOFF_HOURS:
//     Normal flow — attempt push, mark `sent` or `failed`. Limit: BATCH_LIVE.
//
// Both groups are processed in every invocation. Once the backlog is
// drained (typically within a few hours at 5-min intervals), Group A will
// always return 0 rows and this is purely a no-op branch.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") as string;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") as string;
const VAPID_CONTACT_EMAIL =
  Deno.env.get("VAPID_CONTACT_EMAIL") ?? "mailto:us@nazariacollective.in";

webpush.setVapidDetails(VAPID_CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Rows older than this are considered stale and are silently marked sent
// without dispatching a push. 24 hours covers everything before "today"
// for a user — meeting reminders, assignment nudges, etc. that fired
// yesterday or earlier are not worth delivering now.
const BACKLOG_CUTOFF_HOURS = 24;

// How many stale rows to drain per invocation. At 5-min intervals and
// ~3,500 backlog rows this clears in roughly 6 hours.
const BATCH_STALE = 100;

// How many live rows (recent, push-worthy) to process per invocation.
// Kept low to stay within Edge Function timeout.
const BATCH_LIVE = 50;

interface DueRow {
  notification_id: string;
  user_id: string;
  notifications: {
    title: string;
    body: string | null;
    type: string;
    meeting_id: string | null;
    content_dispatch_id: string | null;
    exit_survey_id: string | null;
    message_id: string | null;
  };
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
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
  const now = new Date();
  const staleCutoff = new Date(
    now.getTime() - BACKLOG_CUTOFF_HOURS * 60 * 60 * 1000
  ).toISOString();

  const results = {
    stale_drained: 0,
    live_sent: 0,
    live_failed: 0,
    live_no_subscription: 0,
  };

  // ── GROUP A: drain stale backlog (no push, just mark sent) ──────────────
  const { data: staleRows, error: staleError } = await supabase
    .from("user_notifications")
    .select("notification_id, user_id")
    .eq("status", "pending")
    .is("deleted_at", null)
    .lt("created_at", staleCutoff)
    .limit(BATCH_STALE);

  if (staleError) {
    console.error("[dispatch] Failed to fetch stale rows", staleError);
  } else if (staleRows && staleRows.length > 0) {
    const staleNotifIds = staleRows.map(
      (r: { notification_id: string; user_id: string }) => r.notification_id
    );
    // Bulk update — one round-trip for the whole stale batch.
    const { error: drainError } = await supabase
      .from("user_notifications")
      .update({ status: "sent", sent_at: now.toISOString() })
      .in("notification_id", staleNotifIds)
      .eq("status", "pending");

    if (drainError) {
      console.error("[dispatch] Failed to drain stale rows", drainError);
    } else {
      results.stale_drained = staleRows.length;
    }
  }

  // ── GROUP B: live rows — attempt push ───────────────────────────────────
  const { data: liveRows, error: liveError } = await supabase
    .from("user_notifications")
    .select(
      `notification_id, user_id,
        notifications!inner(
          title, body, type,
          meeting_id, content_dispatch_id,
          exit_survey_id, message_id,
          scheduled_for
        )`
    )
    .eq("status", "pending")
    .is("deleted_at", null)
    .gte("created_at", staleCutoff)
    .lte("notifications.scheduled_for", now.toISOString())
    .limit(BATCH_LIVE);

  if (liveError) {
    console.error("[dispatch] Failed to fetch live rows", liveError);
    return new Response(JSON.stringify({ error: liveError.message, ...results }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = (liveRows ?? []) as unknown as DueRow[];

  for (const row of rows) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", row.user_id)
      .is("deleted_at", null);

    const subscriptions = (subs ?? []) as SubscriptionRow[];

    // No subscriptions — user hasn't opted in. Still mark sent so this
    // row doesn't re-process on every tick. The in-app bell already showed
    // the notification.
    if (subscriptions.length === 0) {
      await supabase
        .from("user_notifications")
        .update({ status: "sent", sent_at: now.toISOString() })
        .eq("notification_id", row.notification_id)
        .eq("user_id", row.user_id);
      results.live_no_subscription++;
      continue;
    }

    const payload = JSON.stringify({
      title: row.notifications.title,
      body: row.notifications.body ?? "",
      data: {
        notificationId: row.notification_id,
        type: row.notifications.type,
        meetingId: row.notifications.meeting_id,
        contentDispatchId: row.notifications.content_dispatch_id,
        exitSurveyId: row.notifications.exit_survey_id,
        messageId: row.notifications.message_id,
      },
    });

    let atLeastOneSuccess = false;

    for (const sub of subscriptions) {
      try {
await webpush.sendNotification(
  { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
  payload,
  { TTL: 60 * 60 * 24 } // 24 hours — FCM will retry delivery for up to 24h
);
        atLeastOneSuccess = true;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 404 / 410 mean the subscription is no longer valid — clean it up
        // so we don't attempt it again on future invocations.
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .update({ deleted_at: now.toISOString() })
            .eq("id", sub.id);
        } else {
          console.error("[dispatch] webpush failed for sub", sub.id, err);
        }
      }
    }

    await supabase
      .from("user_notifications")
      .update({
        status: atLeastOneSuccess ? "sent" : "failed",
        sent_at: atLeastOneSuccess ? now.toISOString() : null,
      })
      .eq("notification_id", row.notification_id)
      .eq("user_id", row.user_id);

    if (atLeastOneSuccess) results.live_sent++;
    else results.live_failed++;
  }

  console.log("[dispatch] done", results);

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
});