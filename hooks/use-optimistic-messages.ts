// /hooks/use-optimistic-messages.ts
"use client";

import { useCallback, useMemo, useState } from "react";
import type { Message, PendingMessage } from "@/types/messages";

/**
 * Tracks in-flight sends locally, keyed by client_generated_id. Merges them
 * with the server-confirmed message list for render, without persisting
 * "sending"/"failed" anywhere — those states never touch the DB (see
 * migration notes on client_generated_id).
 *
 * Per React 18 "You Might Not Need an Effect": the merged render list is
 * derived during render (useMemo), not synced via an effect.
 */
export function useOptimisticMessages(confirmedMessages: Message[]) {
  const [pending, setPending] = useState<Map<string, PendingMessage>>(new Map());

  const addPending = useCallback((message: PendingMessage) => {
    setPending((prev) => {
      const next = new Map(prev);
      next.set(message.client_generated_id as string, message);
      return next;
    });
  }, []);

  // Deliberately does NOT delete the pending entry. Deleting here creates a
  // gap: the insert has succeeded but the confirmedMessages query hasn't
  // refetched yet, so the message would vanish from the render list until
  // the next refetch — the "disappears then reappears" bug. Instead, flip
  // status to "sent" and keep rendering; confirmedClientIds (below) drops
  // it automatically the moment the real row shows up in confirmedMessages.
  const markSent = useCallback((clientGeneratedId: string) => {
    setPending((prev) => {
      const existing = prev.get(clientGeneratedId);
      if (!existing) return prev;
      const next = new Map(prev);
      next.set(clientGeneratedId, { ...existing, status: "sent" });
      return next;
    });
  }, []);

  const markFailed = useCallback((clientGeneratedId: string) => {
    setPending((prev) => {
      const existing = prev.get(clientGeneratedId);
      if (!existing) return prev;
      const next = new Map(prev);
      next.set(clientGeneratedId, { ...existing, status: "failed" });
      return next;
    });
  }, []);

  const removePending = useCallback((clientGeneratedId: string) => {
    setPending((prev) => {
      if (!prev.has(clientGeneratedId)) return prev;
      const next = new Map(prev);
      next.delete(clientGeneratedId);
      return next;
    });
  }, []);

  // Once a confirmed message with a matching client_generated_id arrives
  // (via insert response or realtime), it naturally supersedes the pending
  // one here — computed at render time, no effect needed.
  const confirmedClientIds = useMemo(
    () => new Set(confirmedMessages.map((m) => m.client_generated_id).filter(Boolean)),
    [confirmedMessages]
  );

  const mergedMessages = useMemo<(Message | PendingMessage)[]>(() => {
    const stillPending = Array.from(pending.values()).filter(
      (p) => !confirmedClientIds.has(p.client_generated_id)
    );
    return [...confirmedMessages, ...stillPending].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [confirmedMessages, pending, confirmedClientIds]);

  return { mergedMessages, addPending, markSent, markFailed, removePending };
}