// /components/messages/StaffConversationDirectory.tsx
"use client";

import { useRouter } from "next/navigation";
import { Megaphone, Users, UsersRound, User, LogIn, Eye } from "lucide-react";
import { useOversightConversations } from "@/hooks/use-conversations";
import { EmptyState } from "@/components/shared/EmptyState";
import { enterConversationAsStaff } from "@/lib/api/messages";
import type { ConversationKind } from "@/types/messages";
import { cn } from "@/lib/utils";

function KindIcon({ kind }: { kind: ConversationKind }) {
  const className = "h-4 w-4 text-text-muted dark:text-text-muted";
  if (kind === "broadcast") return <Megaphone className={className} />;
  if (kind === "pod") return <Users className={className} />;
  if (kind === "group") return <UsersRound className={className} />;
  return <User className={className} />;
}

export function StaffConversationDirectory() {
  const router = useRouter();
  const { data: conversations, isLoading, refetch } = useOversightConversations();

  async function handleEnter(conversationId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await enterConversationAsStaff(conversationId);
    await refetch();
    router.push(`/chat/${conversationId}`);
  }

  if (isLoading) {
    return <p className="p-4 text-sm text-text-muted dark:text-text-muted">Loading all conversations…</p>;
  }

  if (!conversations || conversations.length === 0) {
    return <EmptyState title="No conversations yet" description="Nothing has been created across the platform." />;
  }

  return (
    <div className="space-y-1 p-2">
      {conversations.map((conversation) => (
        <div
          key={conversation.conversation_id}
          onClick={() => router.push(`/chat/${conversation.conversation_id}`)}
          className={cn(
            "flex items-center gap-3 rounded-lg p-3 cursor-pointer transition-colors",
            "hover:bg-card-alt dark:hover:bg-card-alt bg-card dark:bg-card border border-border-strong dark:border-border-strong"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface dark:bg-surface border border-border-strong dark:border-border-strong">
            <KindIcon kind={conversation.kind} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-text-primary dark:text-text-primary">
              {conversation.resolved_name}
            </p>
            <p className="truncate text-sm text-text-muted dark:text-text-muted">
              {conversation.last_message_deleted_at
                ? "This message was deleted"
                : conversation.last_message_body ?? "No messages yet"}
            </p>
          </div>

          {conversation.i_am_active_participant ? (
            <span className="shrink-0 flex items-center gap-1 text-xs text-text-muted dark:text-text-muted">
              <Eye className="h-3.5 w-3.5" /> Open
            </span>
          ) : (
            <button
              type="button"
              onClick={(e) => void handleEnter(conversation.conversation_id, e)}
              className={cn(
                "shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium",
                "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
              )}
            >
              <LogIn className="h-3.5 w-3.5" /> Enter
            </button>
          )}
        </div>
      ))}
    </div>
  );
}