// /components/notifications/EnableNotificationsButton.tsx

"use client";

import { usePushSubscription } from "@/hooks/use-push-subscription";

export function EnableNotificationsButton(): React.JSX.Element | null {
  const { permission, isSubscribed, isLoading, subscribe, unsubscribe } = usePushSubscription();

  if (permission === "unsupported" || isLoading) return null;

  if (permission === "denied") {
    return (
      <p className="text-sm text-text-muted">
        Notifications are blocked in your browser settings. Enable them for this site to get reminders on your device.
      </p>
    );
  }

  if (isSubscribed) {
    return (
      <button
        type="button"
        onClick={() => void unsubscribe()}
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-card-alt"
      >
        Turn off notifications
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void subscribe()}
      className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
    >
      Turn on notifications
    </button>
  );
}