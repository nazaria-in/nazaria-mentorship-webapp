// /components/messages/ConversationListItem.tsx
"use client";

import { Megaphone, Users, UsersRound, User } from "lucide-react";
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
  if (kind === "group") return <UsersRound className={className} />;
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

  const hasUnread = conversation.unread_count > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full text-left flex items-start gap-3 rounded-lg p-3 pl-4 transition-colors",
        "hover:bg-card-alt dark:hover:bg-card-alt",
        isActive
          ? "bg-card-alt dark:bg-card-alt ring-1 ring-inset ring-border-strong dark:ring-border-strong"
          : "bg-transparent"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary dark:bg-primary" />
      )}

      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card dark:bg-card border border-border-strong dark:border-border-strong">
        <KindIcon kind={conversation.kind} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm",
              hasUnread
                ? "font-semibold text-text-primary dark:text-text-primary"
                : "font-medium text-text-primary dark:text-text-primary"
            )}
          >
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
                : hasUnread
                ? "text-text-primary/80 dark:text-text-primary/80"
                : "text-text-muted dark:text-text-muted"
            )}
          >
            {previewBody}
          </span>
          {hasUnread && (
            <span className="shrink-0 rounded-full bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground text-xs font-medium px-2 py-0.5 min-w-[1.25rem] text-center">
              {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}