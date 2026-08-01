// /components/messages/EnterConversationBanner.tsx
"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { enterConversationAsStaff } from "@/lib/api/messages";
import { cn } from "@/lib/utils";

interface EnterConversationBannerProps {
  conversationId: string;
  onEntered: () => void;
}

export function EnterConversationBanner({ conversationId, onEntered }: EnterConversationBannerProps) {
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnter() {
    setEntering(true);
    setError(null);
    try {
      await enterConversationAsStaff(conversationId);
      onEntered();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't enter this conversation.");
    } finally {
      setEntering(false);
    }
  }

  return (
    <div className="border-t border-border-strong dark:border-border-strong bg-card dark:bg-card px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm text-text-primary dark:text-text-primary">
          You&apos;re viewing this conversation as staff.
        </p>
        <p className="text-xs text-text-muted dark:text-text-muted">
          Enter to appear as a participant, or just send a message below — you&apos;ll join automatically.
        </p>
        {error && <p className="text-xs text-destructive dark:text-destructive mt-1">{error}</p>}
      </div>
      <button
        type="button"
        onClick={() => void handleEnter()}
        disabled={entering}
        className={cn(
          "shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground",
          "disabled:opacity-60 disabled:cursor-not-allowed"
        )}
      >
        <LogIn className="h-4 w-4" />
        {entering ? "Entering…" : "Enter to chat"}
      </button>
    </div>
  );
}