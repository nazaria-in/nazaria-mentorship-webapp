// /components/notifications/NotificationPermissionPrompt.tsx

"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { usePushSubscription } from "@/hooks/use-push-subscription";

const DONT_ASK_AGAIN_KEY = "nazaria_push_dont_ask";
const PROMPT_DELAY_MS = 4000;

// Shown once per session (or never again if the user clicked "Don't ask again").
// Mounts inside AppShell, renders nothing until the delay has passed and
// conditions are met. Never shows if:
//   - browser doesn't support push (isSupported = false)
//   - permission is already granted
//   - permission is already denied (user must go to browser settings — we can't re-prompt)
//   - user previously clicked "Don't ask again" (localStorage flag)
//   - user already has an active subscription
export function NotificationPermissionPrompt(): React.JSX.Element | null {
  const { isSupported, isSubscribed, isLoading, permissionState, subscribe } =
    usePushSubscription();

  const [visible, setVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    // Wait for the hook to finish its initial load before evaluating
    if (isLoading) return;
    if (!isSupported) return;
    if (isSubscribed) return;
    if (permissionState === "granted") return;
    if (permissionState === "denied") return;

    // Check the "don't ask again" flag
    try {
      if (localStorage.getItem(DONT_ASK_AGAIN_KEY) === "true") return;
    } catch {
      // localStorage unavailable — proceed normally
    }

    const timer = setTimeout(() => {
      setVisible(true);
    }, PROMPT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isLoading, isSupported, isSubscribed, permissionState]);

  function handleDismiss() {
    setIsDismissed(true);
    setVisible(false);
  }

  function handleDontAskAgain() {
    try {
      localStorage.setItem(DONT_ASK_AGAIN_KEY, "true");
    } catch {
      // ignore
    }
    setIsDismissed(true);
    setVisible(false);
  }

  async function handleAllow() {
    setIsSubscribing(true);
    try {
      await subscribe();
    } finally {
      setIsSubscribing(false);
      setVisible(false);
    }
  }

  if (!visible || isDismissed) return null;

  return (
    <>
      {/* Backdrop — tap outside to dismiss */}
      <div
        className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50"
        aria-hidden="true"
        onClick={handleDismiss}
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Enable notifications"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-2xl border border-border bg-surface p-6 shadow-2xl dark:border-white/10 dark:bg-card md:bottom-6 md:rounded-2xl"
      >
        {/* Dismiss X */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-card-alt dark:text-text-muted dark:hover:bg-white/10"
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/20">
          <BellRing size={24} className="text-primary dark:text-primary" />
        </div>

        <h2 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary">
          Stay in the loop
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted dark:text-text-muted">
          Get notified about upcoming meetings, assignment deadlines, and messages — even when the app is closed.
        </p>

        {/* Primary action */}
        <button
          type="button"
          onClick={() => void handleAllow()}
          disabled={isSubscribing}
          className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 dark:bg-primary dark:text-primary-foreground"
        >
          {isSubscribing ? "Enabling…" : "Allow notifications"}
        </button>

        {/* Secondary actions */}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-text-primary hover:bg-card-alt dark:border-white/10 dark:text-text-primary dark:hover:bg-white/5"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleDontAskAgain}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-text-muted hover:bg-card-alt dark:border-white/10 dark:text-text-muted dark:hover:bg-white/5"
          >
            Don&apos;t ask again
          </button>
        </div>
      </div>
    </>
  );
}