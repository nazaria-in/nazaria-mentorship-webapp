// /app/assignments_and_courses/dispatch/[dispatchId]/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Notifications only ever carry a content_dispatch_id (see the real
 * notifications table + types/notifications.ts) — they never carry a
 * content_item_id directly, and the merged detail page lives at
 * /assignments_and_courses/[id] keyed by content_item_id, not dispatch id.
 * Rather than adding a redundant content_item_id column to `notifications`
 * (a schema change, avoided per your explicit caution about those) or
 * making lib/notifications/card-actions.ts's pure getNotificationAction
 * function async (which would ripple into whatever renders NotificationCard),
 * this is a tiny server-side resolver: notification hrefs point here, this
 * does one lookup, then redirects to the real page. Zero schema change,
 * zero change to card-actions.ts's synchronous contract.
 *
 * ASSUMPTION FLAGGED: lib/supabase/server.ts is assumed to export a
 * `createClient()` function mirroring lib/supabase/client.ts's pattern
 * (per the file tree listing it exists, but its actual contents weren't
 * shared) — confirm the import shape matches before relying on this.
 */
export async function GET(_request: Request, { params }: { params: { dispatchId: string } }) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("content_dispatches")
    .select("content_item_id")
    .eq("id", params.dispatchId)
    .maybeSingle();

  const origin = new URL(_request.url).origin;

  if (error || !data) {
    // Dispatch was removed or the id is stale (e.g. an old notification
    // pointing at something since deleted) — fall back to the list page
    // rather than a broken 404.
    return NextResponse.redirect(new URL("/assignments_and_courses", origin));
  }

  return NextResponse.redirect(new URL(`/assignments_and_courses/${data.content_item_id}`, origin));
}