// /components/notifications/NotificationsPrompt.tsx

"use client";

import { useState } from "react";
import { BellRing, X } from "lucide-react";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { EnableNotificationsButton } from "@/components/notifications/EnableNotificationsButton";

export interface NotificationsPromptProps {
  userId: string;
}

function dismissedKey(userId: string): string {
  return `nazaria:notif-prompt-dismissed:${userId}`;
}

function readDismissed(userId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(dismissedKey(userId)) === "1";
  } catch {
    return false;
  }
}

/**
 * Sits in AppShell, above the page content, on every route. There's no
 * settings page yet and most users need to actively turn this on, so this
 * banner is the primary entry point rather than something tucked away.
 * Disappears once subscribed, or once dismissed (remembered per-user so it
 * doesn't reappear on every visit).
 */
export function NotificationsPrompt({ userId }: NotificationsPromptProps): React.JSX.Element | null {
  const { permission, isSubscribed, isLoading } = usePushSubscription();
  // Lazy-init from localStorage directly — no effect needed, this is just
  // derived initial state for the component instance.
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed(userId));

  if (isLoading || isSubscribed || dismissed || permission === "unsupported" || permission === "denied") {
    return null;
  }

  function handleDismiss(): void {
    setDismissed(true);
    try {
      window.localStorage.setItem(dismissedKey(userId), "1");
    } catch {
      // localStorage unavailable (private browsing, etc.) — dismissal just
      // won't persist across reloads, which is an acceptable fallback.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-card-alt px-4 py-2.5 dark:border-white/10 dark:bg-card-alt">
      <div className="flex min-w-0 items-center gap-2.5">
        <BellRing className="h-4 w-4 shrink-0 text-text-accent" />
        <p className="truncate text-sm text-text-primary">
          Turn on notifications to get pinged when your mentor reviews your work or a meeting is coming up.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <EnableNotificationsButton />
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="flex h-7 w-7 items-center justify-center rounded-full text-text-primary/50 hover:bg-card-strong hover:text-text-primary dark:text-text-primary/40 dark:hover:bg-card-strong dark:hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}