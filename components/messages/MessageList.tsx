// /components/messages/MessageList.tsx
"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";
import { UnreadDivider } from "./UnreadDivider";
import { ScrollToBottomButton } from "./ScrollToBottomButton";
import type { ConversationParticipant, Message, PendingMessage } from "@/types/messages";

interface ParticipantWithName extends ConversationParticipant {
  full_name: string | null;
  school_or_org: string | null;
}

interface MessageListProps {
  messages: (Message | PendingMessage)[];
  participants: ParticipantWithName[];
  currentUserId: string;
  isStaffViewer: boolean;
  /** Direct 1:1s never need sender labels; anything with more than 2 people does. */
  conversationKind: "direct" | "team" | "group" | "broadcast";
  /** last_read_at captured once on mount — the unread divider position must not shift as you read further. */
  initialLastReadAt: string | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onReply: (message: Message) => void;
  onDelete: (messageId: string) => void;
  onRetry: (message: PendingMessage) => void;
  canDeleteMessage: (message: Message | PendingMessage) => boolean;
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

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard permissions can be denied silently in some embedded contexts —
    // no further UI feedback loop needed here, this is a best-effort convenience action.
  }
}

export function MessageList({
  messages,
  participants,
  currentUserId,
  isStaffViewer,
  conversationKind,
  initialLastReadAt,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onReply,
  onDelete,
  onRetry,
  canDeleteMessage,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unseenSinceScroll, setUnseenSinceScroll] = useState(0);

  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.user_id, p] as const)),
    [participants]
  );

  const messageById = useMemo(() => new Map(messages.map((m) => [m.id, m] as const)), [messages]);

  // Direct 1:1s are unambiguous (it's always "them"); anything with more
  // than 2 participants needs the name so people know who's speaking.
  const showSenderName = conversationKind !== "direct" || participants.length > 2;

  // Unread divider position, computed once from the captured initial last_read_at —
  // derived at render time, no effect needed to "lock" it (React 18 guidance).
  const firstUnreadId = useMemo(() => {
    if (!initialLastReadAt) return null;
    const cutoff = new Date(initialLastReadAt).getTime();
    const firstUnread = messages.find(
      (m) => m.sender_id !== currentUserId && new Date(m.created_at).getTime() > cutoff
    );
    return firstUnread?.id ?? null;
  }, [messages, initialLastReadAt, currentUserId]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 200;
    setShowScrollButton(!isNearBottom);
    if (isNearBottom) setUnseenSinceScroll(0);

    if (el.scrollTop < 100 && hasNextPage && !isFetchingNextPage) {
      onLoadMore();
    }
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setUnseenSinceScroll(0);
  }

  function jumpToMessage(messageId: string) {
    const target = messageRefs.current.get(messageId);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.classList.add("ring-2", "ring-primary");
    window.setTimeout(() => target?.classList.remove("ring-2", "ring-primary"), 1200);
  }

  const items = messages.map((message, index) => {
    const previous = messages[index - 1];
    return {
      message,
      showDaySeparator:
        !previous || new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString(),
    };
  });

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-3 space-y-3 bg-surface dark:bg-surface"
      >
        <div ref={topSentinelRef} />

        {isFetchingNextPage && (
          <p className="text-center text-xs text-text-muted dark:text-text-muted">Loading earlier messages…</p>
        )}

        {items.map(({ message, showDaySeparator }) => {
          const isOwn = message.sender_id === currentUserId;
          const sender = participantMap.get(message.sender_id);
          const repliedTo = message.reply_to_message_id ? messageById.get(message.reply_to_message_id) : null;
          const repliedToSender = repliedTo ? participantMap.get(repliedTo.sender_id) : null;

          return (
            <Fragment key={message.id}>
              {showDaySeparator && (
                <div className="flex items-center justify-center py-2">
                  <span className="text-xs text-text-muted dark:text-text-muted bg-card dark:bg-card px-3 py-1 rounded-full border border-border-strong dark:border-border-strong">
                    {formatDayLabel(message.created_at)}
                  </span>
                </div>
              )}

              {message.id === firstUnreadId && <UnreadDivider />}

              <div
                ref={(el) => {
                  if (el) messageRefs.current.set(message.id, el);
                  else messageRefs.current.delete(message.id);
                }}
                data-message-id={message.id}
                className="rounded-2xl transition-shadow"
              >
                <MessageBubble
                  message={{ ...message, senderName: sender ? displayName(sender) : undefined }}
                  repliedToMessage={
                    repliedTo
                      ? { ...repliedTo, senderName: repliedToSender ? displayName(repliedToSender) : undefined }
                      : null
                  }
                  isOwn={isOwn}
                  isStaffViewer={isStaffViewer}
                  showSenderName={showSenderName}
                  canDelete={canDeleteMessage(message)}
                  onReply={onReply}
                  onDelete={onDelete}
                  onCopy={(body) => void copyToClipboard(body)}
                  onJumpToMessage={jumpToMessage}
                  onRetry={onRetry}
                />
              </div>
            </Fragment>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <ScrollToBottomButton visible={showScrollButton} unseenCount={unseenSinceScroll} onClick={scrollToBottom} />
    </div>
  );
}