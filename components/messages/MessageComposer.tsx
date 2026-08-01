// /components/messages/MessageComposer.tsx
"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Send, Smile, X } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import type { Message } from "@/types/messages";
import { cn } from "@/lib/utils";

interface MessageComposerProps {
  disabled: boolean;
  disabledReason: string | null;
  replyingTo: Message | null;
  onCancelReply: () => void;
  onSend: (body: string) => Promise<void>;
}

export function MessageComposer({ disabled, disabledReason, replyingTo, onCancelReply, onSend }: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reacting to an external trigger (Reply selected elsewhere) by moving
  // focus is a genuine side effect on a DOM node — not derived render state —
  // so this is an appropriate, minimal use of useEffect.
  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

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

  function handleEmojiSelect(emoji: string) {
    setBody((prev) => prev + emoji);
  }

  if (disabled) {
    return (
      <div className="border-t border-border-strong dark:border-border-strong bg-card dark:bg-card px-4 py-3">
        <p className="text-sm text-text-muted dark:text-text-muted text-center">{disabledReason}</p>
      </div>
    );
  }

  return (
    <div className="border-t border-border-strong dark:border-border-strong bg-card dark:bg-card">
      {replyingTo && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border dark:border-border bg-surface dark:bg-surface">
          <div className="min-w-0 flex-1 border-l-2 border-primary dark:border-primary pl-2">
            <p className="text-xs font-medium text-primary dark:text-primary">
              {replyingTo.senderName ?? "Replying"}
            </p>
            <p className="truncate text-xs text-text-muted dark:text-text-muted">
              {replyingTo.deleted_at ? "This message was deleted" : replyingTo.body}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 rounded-full p-1 hover:bg-card-alt dark:hover:bg-card-alt"
            aria-label="Cancel reply"
          >
            <X className="h-4 w-4 text-text-muted dark:text-text-muted" />
          </button>
        </div>
      )}

      <div className="px-3 py-3 flex items-end gap-2 relative">
        <div className="flex flex-1 items-end gap-1 rounded-lg border border-border-strong dark:border-border-strong bg-surface dark:bg-surface px-2 py-1.5">
          <button
            type="button"
            onClick={() => setEmojiOpen((open) => !open)}
            className="shrink-0 rounded-full p-1.5 hover:bg-card-alt dark:hover:bg-card-alt"
            aria-label="Add emoji"
          >
            <Smile className="h-5 w-5 text-text-muted dark:text-text-muted" />
          </button>

          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message"
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent text-text-primary dark:text-text-primary",
              "placeholder:text-text-muted dark:placeholder:text-text-muted",
              "px-1.5 py-1 text-sm outline-none max-h-32"
            )}
          />
        </div>

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!body.trim() || sending}
          className={cn(
            "shrink-0 rounded-full p-2.5 transition-colors",
            "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>

        {emojiOpen && (
          <EmojiPicker
            onSelect={handleEmojiSelect}
            onClose={() => setEmojiOpen(false)}
          />
        )}
      </div>
    </div>
  );
}