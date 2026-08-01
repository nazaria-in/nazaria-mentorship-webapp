// /hooks/use-realtime-thread.ts
"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types/messages";

/**
 * Subscribes to INSERT/UPDATE on messages for one conversation. Postgres
 * Realtime filters server-side via the `filter` string below (not client
 * side), so this doesn't require RLS to be correct — but once you add RLS
 * (per your migration note), Realtime will also double-check each row
 * against policy before delivering it, which is what you want long-term.
 *
 * Call the passed callbacks to update react-query cache directly (cheapest)
 * or call invalidateQueries (simplest, slightly slower — one extra fetch).
 */
export function useRealtimeThread(
  conversationId: string | undefined,
  onInsert: (message: Message) => void,
  onUpdate: (message: Message) => void
) {
  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`thread:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => onInsert(payload.new as Message)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => onUpdate(payload.new as Message)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, onInsert, onUpdate]);
}