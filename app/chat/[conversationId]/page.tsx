// /app/messages/[conversationId]/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ConversationHeader } from "@/components/messages/ConversationHeader";
import { MessageList } from "@/components/messages/MessageList";
import { MessageComposer } from "@/components/messages/MessageComposer";
import { EnterConversationBanner } from "@/components/messages/EnterConversationBanner";
import { ForwardMessageModal } from "@/components/messages/ForwardMessageModal";
import { useConversationThread } from "@/hooks/use-conversation-thread";
import { useOversightConversations } from "@/hooks/use-conversations";
import { sendMessage, deleteMessage, resolveConversationName, getComposerDisabledState } from "@/lib/api/messages";
import type { Message } from "@/types/messages";
// NOTE: adjust these two imports to match your actual session/role hooks if named differently.
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

  const [forwardTarget, setForwardTarget] = useState<Message | null>(null);

  const conversationMeta = oversightConversations?.find(
    (c) => c.conversation_id === conversationId
  );

  const currentParticipant = participants.find((p) => p.user_id === currentUser);
  const isActiveParticipant = isStaff
    ? Boolean(conversationMeta?.i_am_active_participant)
    : Boolean(currentParticipant && !currentParticipant.left_at);

  const composerState = useMemo(() => {
    if (!conversationMeta) return { disabled: true, reason: null };
    return getComposerDisabledState({
      canMessage: currentParticipant?.can_message ?? false,
      kind: conversationMeta.kind,
      leftAt: currentParticipant?.left_at ?? null,
      isStaff,
      isActiveParticipant,
    });
  }, [conversationMeta, currentParticipant, isStaff, isActiveParticipant]);

  const resolvedName = conversationMeta
    ? resolveConversationName({
        name: conversationMeta.name,
        kind: conversationMeta.kind,
        otherParticipantNames: participants
          .filter((p) => p.user_id !== currentUser)
          .map((p) => p.full_name ?? p.school_or_org ?? "Unnamed member"),
      })
    : "Conversation";

  async function handleSend(body: string) {
    await sendMessage(conversationId, body);
    queryClient.invalidateQueries({ queryKey: ["conversations", "summary"] });
  }

  async function handleDelete(messageId: string) {
    await deleteMessage(messageId);
  }

  function handleEntered() {
    queryClient.invalidateQueries({ queryKey: ["conversations", "oversight"] });
    queryClient.invalidateQueries({ queryKey: ["conversations", "summary"] });
    queryClient.invalidateQueries({ queryKey: ["conversation-participants", conversationId] });
  }

  if (isLoading || !currentUser) {
    return (
      <div className="flex h-full items-center justify-center bg-surface dark:bg-surface">
        <p className="text-sm text-text-muted dark:text-text-muted">Loading conversation…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-surface dark:bg-surface">
      <ConversationHeader name={resolvedName} kind={conversationMeta?.kind ?? "direct"} />

      <MessageList
        messages={messages}
        participants={participants}
        currentUserId={currentUser}
        isStaffViewer={isStaff}
        conversationKind={conversationMeta?.kind ?? "direct"}
        hasNextPage={Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => void fetchNextPage()}
        onForward={setForwardTarget}
        onDelete={(id) => void handleDelete(id)}
      />

      {isStaff && !isActiveParticipant ? (
        <EnterConversationBanner conversationId={conversationId} onEntered={handleEntered} />
      ) : (
        <MessageComposer
          disabled={composerState.disabled}
          disabledReason={composerState.reason}
          onSend={handleSend}
        />
      )}

      {forwardTarget && (
        <ForwardMessageModal
          message={forwardTarget}
          isOpen={Boolean(forwardTarget)}
          onClose={() => setForwardTarget(null)}
        />
      )}
    </div>
  );
}