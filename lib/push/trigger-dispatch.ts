// /lib/push/trigger-dispatch.ts

// Calls the dispatch-notifications edge function immediately after a
// notification is created, so pushes go out right away instead of waiting
// for the next pg_cron tick (up to 5 minutes).
//
// This is fire-and-forget on purpose — if the edge function call fails,
// the cron will still pick it up on the next tick. We never want a failed
// dispatch trigger to bubble up and break the operation that created the
// notification (meeting creation, message send, etc.).

export async function triggerDispatch(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("[trigger-dispatch] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — skipping immediate dispatch");
    return;
  }

  const url = `${supabaseUrl}/functions/v1/dispatch-notifications`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[trigger-dispatch] Edge function returned non-OK status", {
        status: response.status,
        body: text,
      });
      return;
    }

    const result = await response.json() as Record<string, number>;
    console.log("[trigger-dispatch] dispatch-notifications completed", result);
  } catch (err: unknown) {
    // Network error, edge function cold start timeout, etc. — cron catches it.
    console.error("[trigger-dispatch] Failed to call dispatch-notifications", err);
  }
}