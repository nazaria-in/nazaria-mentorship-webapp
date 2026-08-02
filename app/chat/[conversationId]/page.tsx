// /app/chat/[conversationId]/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import { ConversationHeader } from "@/components/messages/ConversationHeader";
import { ConversationInfoPanel } from "@/components/messages/ConversationInfoPanel";
import { MessageList } from "@/components/messages/MessageList";
import { MessageComposer } from "@/components/messages/MessageComposer";
import { MessageSearchBar } from "@/components/messages/MessageSearchBar";
import { EnterConversationBanner } from "@/components/messages/EnterConversationBanner";
import { ForwardMessageModal } from "@/components/messages/ForwardMessageModal";
import { useConversationThread } from "@/hooks/use-conversation-thread";
import { useOversightConversations } from "@/hooks/use-conversations";
import { useOptimisticMessages } from "@/hooks/use-optimistic-messages";
import { useRealtimeThread } from "@/hooks/use-realtime-thread";
import {
  sendMessage,
  sendMessageAsNewStaffParticipant,
  deleteMessage,
  markConversationRead,
  resolveConversationName,
  getComposerDisabledState,
} from "@/lib/api/messages";
import type { Message, PendingMessage } from "@/types/messages";
import { useSessionStore } from "@/store/session-store";
import { useRole } from "@/providers/role-provider";

export default function ConversationThreadPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const queryClient = useQueryClient();

  const currentUser = useSessionStore((state) => state.userId);
  const { role } = useRole();
  const isStaff = role === "pm" || role === "associate";

  const { messages, participants, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useConversationThread(conversationId);
  const { data: oversightConversations } = useOversightConversations();

  const { mergedMessages, addPending, markSent, markFailed, removePending } = useOptimisticMessages(messages);

  const handleRealtimeInsert = useCallback(() => {
    // Refetch through the normal query rather than splicing the raw payload
    // into cache — keeps redaction/RLS as the single source of truth once
    // RLS is enabled (see hooks/use-realtime-thread.ts for why).
    queryClient.invalidateQueries({ queryKey: ["conversation-thread", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["conversations", "summary"] });
  }, [queryClient, conversationId]);

  const handleRealtimeUpdate = useCallback(() => {
    // Covers soft-deletes (deleted_at/deleted_by) showing up live for
    // everyone else in the conversation.
    queryClient.invalidateQueries({ queryKey: ["conversation-thread", conversationId] });
  }, [queryClient, conversationId]);

  useRealtimeThread(conversationId, handleRealtimeInsert, handleRealtimeUpdate);

  // Syncing to the server when the thread opens (and again as new messages
  // arrive while it stays open) is a genuine side effect — not something
  // computable during render — so this is an appropriate use of useEffect.
  useEffect(() => {
    if (!conversationId || !currentUser) return;
    void markConversationRead(conversationId).then(() => {
      queryClient.invalidateQueries({ queryKey: ["conversations", "summary"] });
    });
  }, [conversationId, currentUser, mergedMessages.length, queryClient]);

  const [forwardTarget, setForwardTarget] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Captured once so the unread divider doesn't shift as the user reads — see MessageList.
  const [initialLastReadAt] = useState<string | null>(() => {
    const me = participants.find((p) => p.user_id === currentUser);
    return me?.last_read_at ?? null;
  });

  const conversationMeta = oversightConversations?.find((c) => c.conversation_id === conversationId);

  const currentParticipant = participants.find((p) => p.user_id === currentUser);
  const isActiveParticipant = isStaff
    ? Boolean(conversationMeta?.i_am_active_participant)
    : Boolean(currentParticipant && !currentParticipant.left_at);

  const composerState = getComposerDisabledState({
    canMessage: currentParticipant?.can_message ?? false,
    kind: conversationMeta?.kind ?? "direct",
    leftAt: currentParticipant?.left_at ?? null,
    isStaff,
    isActiveParticipant,
  });

  const resolvedName = conversationMeta
    ? resolveConversationName({
        name: conversationMeta.name,
        kind: conversationMeta.kind,
        otherParticipantNames: participants.filter((p) => p.user_id !== currentUser).map((p) => p.full_name ?? p.school_or_org ?? "Unnamed member"),
      })
    : "Conversation";

  async function handleSend(body: string) {
    if (!currentUser) return;
    const clientGeneratedId = uuidv4();
    const optimistic: PendingMessage = {
      id: clientGeneratedId,
      conversation_id: conversationId,
      sender_id: currentUser,
      body,
      client_generated_id: clientGeneratedId,
      reply_to_message_id: replyingTo?.id ?? null,
      forwarded_from_message_id: null,
      created_at: new Date().toISOString(),
      deleted_at: null,
      deleted_by: null,
      status: "sending",
    };
    addPending(optimistic);
    setReplyingTo(null);

    try {
      if (isStaff && !isActiveParticipant) {
        await sendMessageAsNewStaffParticipant(conversationId, body, clientGeneratedId);
        queryClient.invalidateQueries({ queryKey: ["conversations", "oversight"] });
        queryClient.invalidateQueries({ queryKey: ["conversation-participants", conversationId] });
      } else {
        await sendMessage({
          conversationId,
          body,
          clientGeneratedId,
          replyToMessageId: replyingTo?.id ?? optimistic.reply_to_message_id,
        });
      }
      markSent(clientGeneratedId);
      queryClient.invalidateQueries({ queryKey: ["conversations", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["conversation-thread", conversationId] });
    } catch (err) {
      console.error("[chat] send failed", err);
      markFailed(clientGeneratedId);
    }
  }

  async function handleRetry(message: PendingMessage) {
    removePending(message.client_generated_id as string);
    await handleSend(message.body);
  }

  async function handleDelete(messageId: string) {
    await deleteMessage(messageId);
    queryClient.invalidateQueries({ queryKey: ["conversation-thread", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["conversations", "summary"] });
  }

  function handleJumpToMessage(messageId: string) {
    setSearchOpen(false);
    const target = document.querySelector(`[data-message-id="${messageId}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handleEntered() {
    queryClient.invalidateQueries({ queryKey: ["conversations", "oversight"] });
    queryClient.invalidateQueries({ queryKey: ["conversations", "summary"] });
    queryClient.invalidateQueries({ queryKey: ["conversation-participants", conversationId] });
  }

  function canDeleteMessage(message: Message | PendingMessage): boolean {
    if ("status" in message) return false; // pending/failed messages aren't persisted yet
    if (message.deleted_at) return false;
    return message.sender_id === currentUser || isStaff;
  }

  if (isLoading || !currentUser) {
    return (
      <div className="flex h-full items-center justify-center bg-surface dark:bg-surface">
        <p className="text-sm text-text-muted dark:text-text-muted">Loading conversation…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-surface dark:bg-surface">
      <div className="flex h-full flex-1 min-w-0 flex-col">
        <ConversationHeader
          name={resolvedName}
          description={conversationMeta?.description}
          kind={conversationMeta?.kind ?? "direct"}
          onOpenInfo={() => setInfoPanelOpen(true)}
          onToggleSearch={() => setSearchOpen((open) => !open)}
        />

        {searchOpen && (
          <MessageSearchBar
            conversationId={conversationId}
            onJumpToMessage={handleJumpToMessage}
            onClose={() => setSearchOpen(false)}
          />
        )}

        <MessageList
          messages={mergedMessages}
          participants={participants}
          currentUserId={currentUser}
          isStaffViewer={isStaff}
          conversationKind={conversationMeta?.kind ?? "direct"}
          initialLastReadAt={initialLastReadAt}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => void fetchNextPage()}
          onReply={setReplyingTo}
          onDelete={(id) => void handleDelete(id)}
          onRetry={(m) => void handleRetry(m)}
          canDeleteMessage={canDeleteMessage}
        />

        {isStaff && !isActiveParticipant ? (
          <EnterConversationBanner conversationId={conversationId} onEntered={handleEntered} />
        ) : (
          <MessageComposer
            disabled={composerState.disabled}
            disabledReason={composerState.reason}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            onSend={handleSend}
          />
        )}
      </div>

      {infoPanelOpen && conversationMeta && (
        <>
          {/* Mobile: full-screen overlay. Desktop: fixed-width sidebar, non-blocking. */}
          <div className="fixed inset-0 z-30 md:static md:z-auto md:w-96 md:shrink-0">
            <ConversationInfoPanel
              conversationId={conversationId}
              name={resolvedName}
              description={conversationMeta.description}
              kind={conversationMeta.kind}
              podId={conversationMeta.pod_id}
              participants={participants.map((p) => ({
                user_id: p.user_id,
                full_name: p.full_name ?? p.school_or_org,
                role: (p as unknown as { role?: "mentee" | "mentor" | "associate" | "pm" }).role ?? null,
              }))}
              canLeave={!isStaff || isActiveParticipant}
              onClose={() => setInfoPanelOpen(false)}
            />
          </div>
        </>
      )}

      {forwardTarget && (
        <ForwardMessageModal message={forwardTarget} isOpen={Boolean(forwardTarget)} onClose={() => setForwardTarget(null)} />
      )}
    </div>
  );
}