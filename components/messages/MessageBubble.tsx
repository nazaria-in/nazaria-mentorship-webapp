// /components/messages/MessageBubble.tsx
"use client";

import { useState } from "react";
import { MoreVertical, Trash2, Reply, Copy, Check, Clock, RotateCw } from "lucide-react";
import type { Message, PendingMessage } from "@/types/messages";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: (Message | PendingMessage) & { senderName?: string };
  /** The message this one replies to, if already loaded in the current window. */
  repliedToMessage?: (Message & { senderName?: string }) | null;
  isOwn: boolean;
  isStaffViewer: boolean;
  canDelete: boolean;
  /** True for any conversation with more than 2 people — direct 1:1s never need this. */
  showSenderName: boolean;
  onReply: (message: Message) => void;
  onDelete: (messageId: string) => void;
  onCopy: (body: string) => void;
  onJumpToMessage: (messageId: string) => void;
  onRetry?: (message: PendingMessage) => void;
}

function isPending(message: Message | PendingMessage): message is PendingMessage {
  return "status" in message;
}

function TickMarks({ message }: { message: Message | PendingMessage }) {
  if (isPending(message)) {
    if (message.status === "sending") {
      return <Clock className="h-3 w-3 text-primary-foreground/70 dark:text-primary-foreground/70" />;
    }
    if (message.status === "failed") {
      return <span className="text-[11px] text-destructive dark:text-destructive font-medium">Failed</span>;
    }
  }
  // Sent (confirmed row, or optimistic status === "sent" in the brief window before removal).
  return (
    <span className="inline-flex -space-x-1">
      <Check className="h-3 w-3 text-primary-foreground/80 dark:text-primary-foreground/80" />
      <Check className="h-3 w-3 text-primary-foreground/80 dark:text-primary-foreground/80" />
    </span>
  );
}

export function MessageBubble({
  message,
  repliedToMessage,
  isOwn,
  isStaffViewer,
  canDelete,
  showSenderName,
  onReply,
  onDelete,
  onCopy,
  onJumpToMessage,
  onRetry,
}: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isForwarded = Boolean(message.forwarded_from_message_id);
  const isDeleted = Boolean(message.deleted_at);
  const showRealBody = !isDeleted || isStaffViewer;
  const failed = isPending(message) && message.status === "failed";

  const time = new Date(message.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div className={cn("flex flex-col gap-1", isOwn ? "items-end" : "items-start")}>
      <div className="group relative flex items-end gap-1 max-w-[80%]">
        {isOwn && !isDeleted && !failed && (
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-card-alt dark:hover:bg-card-alt"
            aria-label="Message options"
          >
            <MoreVertical className="h-4 w-4 text-text-muted dark:text-text-muted" />
          </button>
        )}

        <div className="flex flex-col">
          {failed && (
            <button
              type="button"
              onClick={() => onRetry?.(message as PendingMessage)}
              className="self-end flex items-center gap-1 text-xs text-destructive dark:text-destructive mb-1"
            >
              <RotateCw className="h-3 w-3" /> Tap to retry
            </button>
          )}

          <div
            className={cn(
              "rounded-2xl px-4 py-2 text-sm shadow-sm",
              isDeleted && !isStaffViewer && "italic bg-card-alt text-text-muted dark:bg-card-alt dark:text-text-muted",
              isDeleted &&
                isStaffViewer &&
                "border-2 border-red-500 dark:border-red-400 text-text-primary dark:text-text-primary bg-card dark:bg-card",
              !isDeleted && isOwn && "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground",
              !isDeleted &&
                !isOwn &&
                "bg-card-alt text-text-primary dark:bg-card-alt dark:text-text-primary border border-border dark:border-border",
              failed && "opacity-60"
            )}
          >
            {!isOwn && showSenderName && (
              <p className="text-xs font-semibold text-primary dark:text-primary mb-0.5">
                {message.senderName ?? "Unknown member"}
              </p>
            )}

            {isDeleted && isStaffViewer && (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-1">
                Deleted — visible to staff only
              </p>
            )}

            {isForwarded && showRealBody && (
              <p
                className={cn(
                  "text-xs italic mb-1",
                  isOwn ? "opacity-75" : "text-text-muted dark:text-text-muted"
                )}
              >
                Forwarded
              </p>
            )}

            {repliedToMessage && showRealBody && (
              <button
                type="button"
                onClick={() => onJumpToMessage(repliedToMessage.id)}
                className={cn(
                  "block w-full text-left rounded-lg px-2 py-1 mb-1.5 border-l-2 text-xs",
                  isOwn
                    ? "border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground/90"
                    : "border-border-strong dark:border-border-strong bg-surface/60 dark:bg-surface/60 text-text-muted dark:text-text-muted"
                )}
              >
                <span className="block font-medium truncate">{repliedToMessage.senderName ?? "Message"}</span>
                <span className="block truncate opacity-90">
                  {repliedToMessage.deleted_at ? "This message was deleted" : repliedToMessage.body}
                </span>
              </button>
            )}

            <p className="whitespace-pre-wrap break-words">
              {!showRealBody ? "This message was deleted" : message.body}
            </p>

            <div className={cn("flex items-center gap-1 mt-1 justify-end", isOwn ? "" : "text-text-muted dark:text-text-muted")}>
              <span className={cn("text-[11px]", isOwn ? "text-primary-foreground/70 dark:text-primary-foreground/70" : "text-text-muted dark:text-text-muted")}>
                {time}
              </span>
              {isOwn && !isDeleted && <TickMarks message={message} />}
            </div>
          </div>
        </div>

        {!isOwn && !isDeleted && (
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-card-alt dark:hover:bg-card-alt"
            aria-label="Message options"
          >
            <MoreVertical className="h-4 w-4 text-text-muted dark:text-text-muted" />
          </button>
        )}

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div
              className={cn(
                // Anchored via bottom-full instead of top-full: opens upward from the
                // bubble, which keeps it inside the scrollable message list instead of
                // rendering past the bottom of the screen for messages near the composer.
                "absolute bottom-full mb-1 z-50 rounded-lg border border-border-strong dark:border-border-strong bg-card dark:bg-card shadow-md py-1 min-w-[150px]",
                isOwn ? "right-0" : "left-0"
              )}
            >
              {showRealBody && (
                <button
                  type="button"
                  onClick={() => {
                    onReply(message);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary dark:text-text-primary hover:bg-card-alt dark:hover:bg-card-alt"
                >
                  <Reply className="h-4 w-4" /> Reply
                </button>
              )}
              {showRealBody && (
                <button
                  type="button"
                  onClick={() => {
                    onCopy(message.body);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary dark:text-text-primary hover:bg-card-alt dark:hover:bg-card-alt"
                >
                  <Copy className="h-4 w-4" /> Copy
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(message.id);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive dark:text-destructive hover:bg-card-alt dark:hover:bg-card-alt"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}