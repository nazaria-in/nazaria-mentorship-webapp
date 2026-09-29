// /lib/push/web-push.ts

import webpush from "web-push";
import { PostHog } from "posthog-node";
import { createAdminClient } from "@/lib/supabase/admin";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (!publicKey || !privateKey) {
  throw new Error("[push] VAPID keys are not set — check NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY");
}

webpush.setVapidDetails("mailto:us@nazariacollective.in", publicKey, privateKey);

// Server-side PostHog client — separate from the browser SDK
// Uses a distinct anonymous ID so server events are grouped under "server"
// rather than mixed with individual user sessions
const serverPosthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "", {
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
});

function trackServer(event: string, properties: Record<string, unknown>): void {
  serverPosthog.capture({
    distinctId: "server",
    event,
    properties: { ...properties, source: "server" },
  });
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function dispatchToUser(userId: string, payload: PushPayload): Promise<void> {
  trackServer("push_dispatch_called", { userId, title: payload.title });

  const supabase = createAdminClient();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (error) {
    trackServer("push_dispatch_db_error", { userId, error: error.message });
    return;
  }

  const subCount = subs?.length ?? 0;
  trackServer("push_dispatch_subscriptions_found", { userId, count: subCount });

  if (!subCount) {
    trackServer("push_dispatch_no_subscriptions", { userId });
    return;
  }

  await Promise.all(
    subs.map(async (sub) => {
      trackServer("push_send_attempt", { userId, subId: sub.id, endpoint: sub.endpoint });

      try {
        const result = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );

        trackServer("push_send_success", {
          userId,
          subId: sub.id,
          statusCode: result.statusCode,
        });
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        const body = (err as { body?: string }).body;

        trackServer("push_send_failed", {
          userId,
          subId: sub.id,
          statusCode: status,
          errorBody: body,
        });

        if (status === 404 || status === 410) {
          trackServer("push_stale_subscription_deleted", { userId, subId: sub.id });
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );

  // Flush immediately — server functions (especially edge/serverless) may not
  // stay alive long enough for PostHog's default batch flush interval
  await serverPosthog.flush();
}