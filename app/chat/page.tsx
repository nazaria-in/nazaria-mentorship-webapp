// /app/chat/page.tsx
"use client";

import { MessageSquare } from "lucide-react";

export default function MessagesPage() {
  return (
    <div className="hidden md:flex h-full flex-col items-center justify-center gap-2 bg-surface dark:bg-surface">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card dark:bg-card border border-border-strong dark:border-border-strong mb-2">
        <MessageSquare className="h-7 w-7 text-text-muted dark:text-text-muted" />
      </div>
      <p className="text-text-primary dark:text-text-primary text-sm font-medium">Select a conversation</p>
      <p className="text-text-muted dark:text-text-muted text-xs">Pick a chat from the list to start messaging.</p>
    </div>
  );
}