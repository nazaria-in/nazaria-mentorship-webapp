// /components/messages/MessageBubble.tsx
"use client";

import { useState } from "react";
import { MoreVertical, Forward, Trash2 } from "lucide-react";
import type { Message } from "@/types/messages";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  /** True for PM/associate viewers — they see the real body of deleted messages, styled red (audit trail). */
  isStaffViewer: boolean;
  seenLabel?: string;
  onForward: (message: Message) => void;
  onDelete: (messageId: string) => void;
}

export function MessageBubble({
  message,
  isOwn,
  isStaffViewer,
  seenLabel,
  onForward,
  onDelete,
}: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isForwarded = message.body.startsWith("Forwarded from ");
  const isDeleted = Boolean(message.deleted_at);

  const showRealBody = !isDeleted || isStaffViewer;

  return (
    <div className={cn("flex flex-col gap-1", isOwn ? "items-end" : "items-start")}>
      <div className="group relative flex items-end gap-1 max-w-[80%]">
        {isOwn && !isDeleted && (
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-card-alt dark:hover:bg-card-alt"
            aria-label="Message options"
          >
            <MoreVertical className="h-4 w-4 text-text-muted dark:text-text-muted" />
          </button>
        )}
        {!isOwn && !isDeleted && (
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-card-alt dark:hover:bg-card-alt order-2"
            aria-label="Message options"
          >
            <MoreVertical className="h-4 w-4 text-text-muted dark:text-text-muted" />
          </button>
        )}

        <div
          className={cn(
            "rounded-2xl px-4 py-2 text-sm",
            isDeleted && !isStaffViewer && "italic",
            isDeleted && isStaffViewer && "border border-destructive text-destructive dark:text-destructive",
            !isDeleted && isOwn && "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground",
            !isDeleted && !isOwn && "bg-card-alt text-text-primary dark:bg-card-alt dark:text-text-primary"
          )}
        >
          {isForwarded && showRealBody && (
            <p className="text-xs opacity-75 mb-1">Forwarded</p>
          )}
          <p className="whitespace-pre-wrap break-words">
            {!showRealBody ? "This message was deleted" : message.body}
          </p>
        </div>

        {menuOpen && (
          <div className="absolute top-full mt-1 z-10 rounded-lg border border-border dark:border-border bg-card dark:bg-card shadow-sm py-1 min-w-[140px]">
            <button
              type="button"
              onClick={() => {
                onForward(message);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary dark:text-text-primary hover:bg-card-alt dark:hover:bg-card-alt"
            >
              <Forward className="h-4 w-4" /> Forward
            </button>
            {isOwn && (
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
        )}
      </div>

      {seenLabel && (
        <span className="text-xs text-text-muted dark:text-text-muted px-1">{seenLabel}</span>
      )}
    </div>
  );
}