// /hooks/use-conversation-thread.ts

import { useEffect } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  fetchConversationParticipants,
  fetchMessages,
  markConversationRead,
} from "@/lib/api/messages";
import type { Message } from "@/types/messages";

const supabase = createClient();
const MESSAGES_PAGE_SIZE = 40;

export function useConversationThread(conversationId: string) {
  const queryClient = useQueryClient();

  const messagesQuery = useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchMessages(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: Message[]) =>
      lastPage.length === MESSAGES_PAGE_SIZE ? lastPage[0]?.created_at : undefined,
  });

  const participantsQuery = useQuery({
    queryKey: ["conversation-participants", conversationId],
    queryFn: () => fetchConversationParticipants(conversationId),
  });

  // Realtime: new messages appended live
  useEffect(() => {
    const channel = supabase
      .channel(`thread-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          queryClient.setQueryData<{ pages: Message[][]; pageParams: unknown[] } | undefined>(
            ["messages", conversationId],
            (old) => {
              if (!old) return old;
              const pages = [...old.pages];
              const lastIndex = pages.length - 1;
              pages[lastIndex] = [...pages[lastIndex], newMessage];
              return { ...old, pages };
            }
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          queryClient.setQueryData<{ pages: Message[][]; pageParams: unknown[] } | undefined>(
            ["messages", conversationId],
            (old) => {
              if (!old) return old;
              const pages = old.pages.map((page) =>
                page.map((m) => (m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m))
              );
              return { ...old, pages };
            }
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["conversation-participants", conversationId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // Mark read on open
  useEffect(() => {
    markConversationRead(conversationId).catch(() => {
      // Non-fatal — read receipt sync will retry on next open.
    });
  }, [conversationId]);

  const messages = messagesQuery.data?.pages.flat() ?? [];

  return {
    messages,
    participants: participantsQuery.data ?? [],
    isLoading: messagesQuery.isLoading || participantsQuery.isLoading,
    fetchNextPage: messagesQuery.fetchNextPage,
    hasNextPage: messagesQuery.hasNextPage,
    isFetchingNextPage: messagesQuery.isFetchingNextPage,
  };
}