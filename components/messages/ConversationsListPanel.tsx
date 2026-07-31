// /components/messages/ConversationsListPanel.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useConversations } from "@/hooks/use-conversations";
import { ConversationListItem } from "./ConversationListItem";
import { StaffConversationDirectory } from "./StaffConversationDirectory";
import { NewConversationModal } from "./NewConversationModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { useRole } from "@/providers/role-provider";
import type { ConversationListFilter, ConversationSummary } from "@/types/messages";
import { cn } from "@/lib/utils";

const FILTERS: { key: ConversationListFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "pods", label: "Pods" },
  { key: "broadcasts", label: "Broadcasts" },
  { key: "direct", label: "Direct" },
];

type StaffTab = "mine" | "all";

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
  const { role } = useRole();
  const { data: conversations, isLoading } = useConversations();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ConversationListFilter>("all");
  const [staffTab, setStaffTab] = useState<StaffTab>("mine");
  const [showNewModal, setShowNewModal] = useState(false);

  const isStaff = role === "pm" || role === "associate";
  const canCreate = role === "mentor" || isStaff;

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
    router.push(`/chat/${conversationId}`);
  }

  const showStaffAllTab = isStaff && !pickerMode;
  const showDirectory = showStaffAllTab && staffTab === "all";

  return (
    <div className="flex h-full flex-col bg-surface dark:bg-surface">
      <div className="p-3 border-b border-border dark:border-border space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            className={cn(
              "flex-1 rounded-lg border border-border dark:border-border bg-card dark:bg-card",
              "text-text-primary dark:text-text-primary placeholder:text-text-muted dark:placeholder:text-text-muted",
              "px-3 py-2 text-sm outline-none focus:border-border-strong dark:focus:border-border-strong"
            )}
          />
          {canCreate && !pickerMode && (
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="shrink-0 flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          )}
        </div>

        {showStaffAllTab && (
          <div className="inline-flex rounded-full border border-border dark:border-border p-0.5">
            <button
              type="button"
              onClick={() => setStaffTab("mine")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                staffTab === "mine"
                  ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
                  : "text-text-muted dark:text-text-muted"
              )}
            >
              My conversations
            </button>
            <button
              type="button"
              onClick={() => setStaffTab("all")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                staffTab === "all"
                  ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
                  : "text-text-muted dark:text-text-muted"
              )}
            >
              All conversations
            </button>
          </div>
        )}

        {!showDirectory && (
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
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {showDirectory ? (
          <StaffConversationDirectory />
        ) : (
          <div className="p-2 space-y-1">
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
        )}
      </div>

      {canCreate && !pickerMode && (
        <NewConversationModal isOpen={showNewModal} onClose={() => setShowNewModal(false)} />
      )}
    </div>
  );
}