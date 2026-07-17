// /components/messages/ConversationsListPanel.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useConversations } from "@/hooks/use-conversations";
import { ConversationListItem } from "./ConversationListItem";
import { EmptyState } from "@/components/shared/EmptyState";
import type { ConversationListFilter, ConversationSummary } from "@/types/messages";
import { cn } from "@/lib/utils";

const FILTERS: { key: ConversationListFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "pods", label: "Pods" },
  { key: "broadcasts", label: "Broadcasts" },
  { key: "direct", label: "Direct" },
];

interface ConversationsListPanelProps {
  activeConversationId?: string;
  /** Picker mode is used inside ForwardMessageModal — clicking selects instead of navigating. */
  pickerMode?: boolean;
  onSelectForForward?: (conversationId: string) => void;
}

function matchesFilter(conversation: ConversationSummary, filter: ConversationListFilter): boolean {
  switch (filter) {
    case "unread":
      return conversation.unread_count > 0;
    case "pods":
      return conversation.kind === "pod";
    case "broadcasts":
      return conversation.kind === "broadcast";
    case "direct":
      return conversation.kind === "direct";
    default:
      return true;
  }
}

export function ConversationsListPanel({
  activeConversationId,
  pickerMode = false,
  onSelectForForward,
}: ConversationsListPanelProps) {
  const router = useRouter();
  const { data: conversations, isLoading } = useConversations();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ConversationListFilter>("all");

  const filtered = useMemo(() => {
    if (!conversations) return [];
    const lowerSearch = search.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (!matchesFilter(conversation, filter)) return false;
      if (!lowerSearch) return true;
      const nameMatch = conversation.resolved_name?.toLowerCase().includes(lowerSearch);
      const bodyMatch = conversation.last_message_body?.toLowerCase().includes(lowerSearch);
      return Boolean(nameMatch || bodyMatch);
    });
  }, [conversations, search, filter]);

  function handleSelect(conversationId: string) {
    if (pickerMode && onSelectForForward) {
      onSelectForForward(conversationId);
      return;
    }
    router.push(`/messages/${conversationId}`);
  }

  return (
    <div className="flex h-full flex-col bg-surface dark:bg-surface">
      <div className="p-3 border-b border-border dark:border-border space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations"
          className={cn(
            "w-full rounded-lg border border-border dark:border-border bg-card dark:bg-card",
            "text-text-primary dark:text-text-primary placeholder:text-text-muted dark:placeholder:text-text-muted",
            "px-3 py-2 text-sm outline-none focus:border-border-strong dark:focus:border-border-strong"
          )}
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary dark:bg-primary dark:text-primary-foreground dark:border-primary"
                  : "bg-transparent text-text-muted dark:text-text-muted border-border dark:border-border hover:bg-card-alt dark:hover:bg-card-alt"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && (
          <p className="p-4 text-sm text-text-muted dark:text-text-muted">Loading conversations…</p>
        )}
        {!isLoading && filtered.length === 0 && (
          <EmptyState
            title="No conversations found"
            description={search ? "Try a different search term." : "Nothing here yet."}
          />
        )}
        {filtered.map((conversation) => (
          <ConversationListItem
            key={conversation.conversation_id}
            conversation={conversation}
            isActive={conversation.conversation_id === activeConversationId}
            onClick={() => handleSelect(conversation.conversation_id)}
          />
        ))}
      </div>
    </div>
  );
}