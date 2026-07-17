// /components/messages/MessageList.tsx
"use client";

import { Fragment, useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { ConversationParticipant, Message } from "@/types/messages";

interface ParticipantWithName extends ConversationParticipant {
  full_name: string | null;
  school_or_org: string | null;
}

interface MessageListProps {
  messages: Message[];
  participants: ParticipantWithName[];
  currentUserId: string;
  isStaffViewer: boolean;
  conversationKind: "direct" | "pod" | "broadcast";
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onForward: (message: Message) => void;
  onDelete: (messageId: string) => void;
}

function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function displayName(p: ParticipantWithName): string {
  return p.full_name ?? p.school_or_org ?? "Unnamed member";
}

/** Read receipts, not presence — there's no last_seen_at anywhere. Label it that way. */
function resolveSeenLabel(
  message: Message,
  isOwn: boolean,
  isLastOwnMessage: boolean,
  participants: ParticipantWithName[],
  currentUserId: string,
  kind: "direct" | "pod" | "broadcast"
): string | undefined {
  if (!isOwn || !isLastOwnMessage) return undefined;

  const others = participants.filter((p) => p.user_id !== currentUserId);
  const seenBy = others.filter(
    (p) => p.last_read_at && new Date(p.last_read_at) >= new Date(message.created_at)
  );

  if (kind === "direct" && others.length === 1) {
    return seenBy.length > 0
      ? `Seen ${new Date(seenBy[0].last_read_at as string).toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        })}`
      : undefined;
  }

  if (seenBy.length === 0) return undefined;
  if (kind === "broadcast") {
    return `Seen by ${seenBy.length} of ${others.length}`;
  }
  const names = seenBy.slice(0, 2).map(displayName);
  const suffix = seenBy.length > 2 ? ` +${seenBy.length - 2}` : "";
  return `Seen by ${names.join(", ")}${suffix}`;
}

export function MessageList({
  messages,
  participants,
  currentUserId,
  isStaffViewer,
  conversationKind,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onForward,
  onDelete,
}: MessageListProps) {
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      { threshold: 1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  const participantsWithNames: ParticipantWithName[] = participants;
  const lastOwnMessageId = [...messages].reverse().find((m) => m.sender_id === currentUserId)?.id;

const items = messages.map((message, index) => {
  const previous = messages[index - 1];

  return {
    message,
    showDaySeparator:
      !previous ||
      new Date(previous.created_at).toDateString() !==
        new Date(message.created_at).toDateString(),
  };
});

return (
  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-surface dark:bg-surface">
    <div ref={topSentinelRef} />

    {isFetchingNextPage && (
      <p className="text-center text-xs text-text-muted dark:text-text-muted">
        Loading earlier messages…
      </p>
    )}

    {items.map(({ message, showDaySeparator }) => {
      const isOwn = message.sender_id === currentUserId;

      const participantMap = new Map(
        participantsWithNames.map((participant) => [participant.user_id, participant] as const)
     );

      const sender = participantMap.get(message.sender_id);

      return (
        <Fragment key={message.id}>
          {showDaySeparator && (
            <div className="flex items-center justify-center py-2">
              <span className="text-xs text-text-muted dark:text-text-muted bg-card dark:bg-card px-3 py-1 rounded-full border border-border dark:border-border">
                {formatDayLabel(message.created_at)}
              </span>
            </div>
          )}

          <MessageBubble
            message={{
              ...message,
              senderName: sender ? displayName(sender) : undefined,
            }}
            isOwn={isOwn}
            isStaffViewer={isStaffViewer}
            seenLabel={resolveSeenLabel(
              message,
              isOwn,
              message.id === lastOwnMessageId,
              participantsWithNames,
              currentUserId,
              conversationKind
            )}
            onForward={onForward}
            onDelete={onDelete}
          />
        </Fragment>
      );
    })}

    <div ref={bottomRef} />
  </div>
);
}