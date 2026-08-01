// /components/messages/MessageSearchBar.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { searchConversationMessages } from "@/lib/api/messages";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

interface MessageSearchBarProps {
  conversationId: string;
  onJumpToMessage: (messageId: string) => void;
  onClose: () => void;
}

export function MessageSearchBar({ conversationId, onJumpToMessage, onClose }: MessageSearchBarProps) {
  const [query, setQuery] = useState("");
  const [resultIndex, setResultIndex] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 300);

  const { data: results, isFetching } = useQuery({
    queryKey: ["message-search", conversationId, debouncedQuery],
    queryFn: () => searchConversationMessages(conversationId, debouncedQuery),
    enabled: debouncedQuery.trim().length > 0,
  });

  const total = results?.length ?? 0;

  function goTo(index: number) {
    if (!results || results.length === 0) return;
    const clamped = ((index % results.length) + results.length) % results.length;
    setResultIndex(clamped);
    onJumpToMessage(results[clamped].id);
  }

  return (
    <div className="flex items-center gap-2 border-b border-border-strong dark:border-border-strong bg-card dark:bg-card px-3 py-2">
      <Search className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted" />
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setResultIndex(0);
        }}
        placeholder="Search in this conversation"
        className={cn(
          "flex-1 bg-transparent text-sm text-text-primary dark:text-text-primary",
          "placeholder:text-text-muted dark:placeholder:text-text-muted outline-none"
        )}
      />

      {debouncedQuery.trim().length > 0 && (
        <span className="shrink-0 text-xs text-text-muted dark:text-text-muted">
          {isFetching ? "Searching…" : total > 0 ? `${resultIndex + 1} of ${total}` : "No results"}
        </span>
      )}

      <button
        type="button"
        onClick={() => goTo(resultIndex - 1)}
        disabled={total === 0}
        className="shrink-0 rounded-full p-1 hover:bg-card-alt dark:hover:bg-card-alt disabled:opacity-30"
        aria-label="Previous result"
      >
        <ChevronUp className="h-4 w-4 text-text-muted dark:text-text-muted" />
      </button>
      <button
        type="button"
        onClick={() => goTo(resultIndex + 1)}
        disabled={total === 0}
        className="shrink-0 rounded-full p-1 hover:bg-card-alt dark:hover:bg-card-alt disabled:opacity-30"
        aria-label="Next result"
      >
        <ChevronDown className="h-4 w-4 text-text-muted dark:text-text-muted" />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-full p-1 hover:bg-card-alt dark:hover:bg-card-alt"
        aria-label="Close search"
      >
        <X className="h-4 w-4 text-text-muted dark:text-text-muted" />
      </button>
    </div>
  );
}