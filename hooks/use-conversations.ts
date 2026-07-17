// /hooks/use-conversations.ts

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchConversations, fetchOversightConversations } from "@/lib/api/messages";
import { resolveConversationName } from "@/lib/api/messages";
import type { ConversationSummary, ConversationOversight } from "@/types/messages";

const supabase = createClient();

export function useConversations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["conversations", "summary"],
    queryFn: async () => {
      const rows = await fetchConversations();
      return rows.map((row): ConversationSummary => ({
        ...row,
        resolved_name: resolveConversationName({
          name: row.name,
          kind: row.kind,
          otherParticipantNames: row.other_participant_names,
        }),
      }));
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversations", "summary"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useOversightConversations() {
  return useQuery({
    queryKey: ["conversations", "oversight"],
    queryFn: async () => {
      const rows = await fetchOversightConversations();
      return rows.map((row): ConversationOversight => ({
        ...row,
        resolved_name: resolveConversationName({
          name: row.name,
          kind: row.kind,
          otherParticipantNames: null,
        }),
      }));
    },
  });
}