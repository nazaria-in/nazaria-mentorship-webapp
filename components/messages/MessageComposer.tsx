// /components/messages/MessageComposer.tsx
"use client";

import { useState, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageComposerProps {
  disabled: boolean;
  disabledReason: string | null;
  onSend: (body: string) => Promise<void>;
}

export function MessageComposer({ disabled, disabledReason, onSend }: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setBody("");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  if (disabled) {
    return (
      <div className="border-t border-border dark:border-border bg-card dark:bg-card px-4 py-3">
        <p className="text-sm text-text-muted dark:text-text-muted text-center">{disabledReason}</p>
      </div>
    );
  }

  return (
    <div className="border-t border-border dark:border-border bg-surface dark:bg-surface px-3 py-3 flex items-end gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message"
        rows={1}
        className={cn(
          "flex-1 resize-none rounded-lg border border-border dark:border-border bg-card dark:bg-card",
          "text-text-primary dark:text-text-primary placeholder:text-text-muted dark:placeholder:text-text-muted",
          "px-3 py-2 text-sm outline-none focus:border-border-strong dark:focus:border-border-strong max-h-32"
        )}
      />
      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={!body.trim() || sending}
        className={cn(
          "shrink-0 rounded-full p-2 transition-colors",
          "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}