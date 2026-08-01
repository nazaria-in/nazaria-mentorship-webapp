// /hooks/use-realtime-conversation-list.ts
"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * No per-user server-side filter is possible here (Postgres Realtime
 * filters are simple column=value comparisons, and "conversations I'm a
 * participant of" isn't expressible that way). Two consequences:
 *
 * 1. Every connected client currently receives every conversations/
 *    conversation_participants change, regardless of membership. This is
 *    fine for now with RLS off, but once RLS is added (per your plan),
 *    Realtime re-checks each row against the SELECT policy before
 *    delivering it — so this automatically narrows to "conversations I
 *    can see" with zero code changes here. Until then, treat this as
 *    "invalidate on any change" rather than "trust the payload contents."
 * 2. Because of (1), the simplest and safest callback is invalidateQueries
 *    (refetch through the normal RLS'd query), not writing the raw payload
 *    into cache directly — don't be tempted to skip the refetch once RLS
 *    lands, since an unfiltered payload could otherwise leak into state
 *    for a conversation the RLS'd fetch would have excluded.
 */
export function useRealtimeConversationList(onChange: () => void) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("conversation-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants" }, onChange)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, onChange)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [onChange]);
}