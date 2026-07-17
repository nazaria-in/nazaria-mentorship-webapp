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

  async function handleEnter() {
    setEntering(true);
    try {
      await enterConversationAsStaff(conversationId);
      onEntered();
    } finally {
      setEntering(false);
    }
  }

  return (
    <div className="border-t border-border dark:border-border bg-card dark:bg-card px-4 py-3 flex items-center justify-between gap-3">
      <p className="text-sm text-text-muted dark:text-text-muted">
        You&apos;re viewing this conversation as staff. Enter to send messages and appear as a participant.
      </p>
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