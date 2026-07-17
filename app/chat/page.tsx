// /app/chat/page.tsx
"use client";

import { MessageSquare } from "lucide-react";

export default function MessagesPage() {
  return (
    <div className="hidden md:flex h-full flex-col items-center justify-center gap-2 bg-surface dark:bg-surface">
      <MessageSquare className="h-10 w-10 text-text-muted dark:text-text-muted" />
      <p className="text-text-muted dark:text-text-muted text-sm">
        Select a conversation to start chatting.
      </p>
    </div>
  );
}