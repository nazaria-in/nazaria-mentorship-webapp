// /components/messages/UnreadDivider.tsx
"use client";

export function UnreadDivider() {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="h-px flex-1 bg-primary/40 dark:bg-primary/40" />
      <span className="text-xs font-medium text-primary dark:text-primary shrink-0">Unread messages</span>
      <span className="h-px flex-1 bg-primary/40 dark:bg-primary/40" />
    </div>
  );
}