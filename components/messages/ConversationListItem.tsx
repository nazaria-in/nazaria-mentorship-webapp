// /components/messages/ConversationListItem.tsx
"use client";

import { Megaphone, Users, User } from "lucide-react";
import type { ConversationSummary, ConversationKind } from "@/types/messages";
import { cn } from "@/lib/utils";

interface ConversationListItemProps {
  conversation: ConversationSummary;
  isActive: boolean;
  onClick: () => void;
}

function KindIcon({ kind }: { kind: ConversationKind }) {
  const className = "h-4 w-4 shrink-0 text-text-muted dark:text-text-muted";
  if (kind === "broadcast") return <Megaphone className={className} />;
  if (kind === "pod") return <Users className={className} />;
  return <User className={className} />;
}

function formatPreviewTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ConversationListItem({ conversation, isActive, onClick }: ConversationListItemProps) {
  const previewBody = conversation.last_message_deleted_at
    ? "This message was deleted"
    : conversation.last_message_body ?? "No messages yet";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-start gap-3 rounded-lg p-3 transition-colors",
        "hover:bg-card-alt dark:hover:bg-card-alt",
        isActive ? "bg-card-alt dark:bg-card-alt" : "bg-transparent"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card dark:bg-card border border-border dark:border-border">
        <KindIcon kind={conversation.kind} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-text-primary dark:text-text-primary">
            {conversation.resolved_name}
          </span>
          <span className="shrink-0 text-xs text-text-muted dark:text-text-muted">
            {formatPreviewTime(conversation.last_message_created_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span
            className={cn(
              "truncate text-sm",
              conversation.last_message_deleted_at
                ? "italic text-text-muted dark:text-text-muted"
                : "text-text-muted dark:text-text-muted"
            )}
          >
            {previewBody}
          </span>
          {conversation.unread_count > 0 && (
            <span className="shrink-0 rounded-full bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground text-xs px-2 py-0.5 min-w-[1.25rem] text-center">
              {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}