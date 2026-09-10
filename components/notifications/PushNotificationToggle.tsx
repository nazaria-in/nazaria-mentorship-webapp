// /components/notifications/PushNotificationToggle.tsx

"use client";

import { BellOff, BellRing, Loader2 } from "lucide-react";
import { usePushSubscription } from "@/hooks/use-push-subscription";

// Renders a toggle row for browser push notification opt-in/out.
// Intended for the profile settings page, below the form fields.
//
// Three visible states:
//   1. Normal — toggle switch, enabled/disabled based on isSubscribed.
//   2. Permission denied — toggle replaced with "Blocked in browser settings"
//      message. No button, no re-prompt (browsers block re-prompting anyway).
//   3. Not supported — renders null. Cleaner than a disabled row with no
//      explanation for browsers that genuinely can't do push.
export function PushNotificationToggle(): React.JSX.Element | null {
  const { isSupported, isSubscribed, isLoading, permissionState, subscribe, unsubscribe } =
    usePushSubscription();

  // Don't render anything for unsupported browsers (old browsers, some
  // private browsing modes). PushManager simply isn't present.
  if (!isSupported) return null;

  function handleToggle(): void {
    if (isLoading) return;
    if (isSubscribed) {
      void unsubscribe();
    } else {
      void subscribe();
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 dark:border-white/10 dark:bg-card">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isSubscribed ? (
            <BellRing
              size={18}
              className="shrink-0 text-text-accent dark:text-text-accent"
            />
          ) : (
            <BellOff
              size={18}
              className="shrink-0 text-text-muted dark:text-text-muted"
            />
          )}
          <div>
            <p className="text-sm font-medium text-text-primary dark:text-text-primary">
              Browser notifications
            </p>
            <p className="text-xs text-text-muted dark:text-text-muted">
              {permissionState === "denied"
                ? "Blocked — re-enable in browser settings"
                : isSubscribed
                ? "You'll get alerts even when the app is closed"
                : "Get alerts for meetings, assignments, and messages"}
            </p>
          </div>
        </div>

        {/* Right side — toggle or blocked indicator */}
        {permissionState === "denied" ? (
          // Can't re-prompt after denial — show state only.
          <span className="shrink-0 rounded-full border border-border bg-card-alt px-2.5 py-1 text-xs font-medium text-text-muted dark:border-white/10 dark:bg-card-alt dark:text-text-muted">
            Blocked
          </span>
        ) : isLoading ? (
          <Loader2
            size={18}
            className="shrink-0 animate-spin text-text-muted dark:text-text-muted"
          />
        ) : (
          // Toggle switch — accessible via keyboard (role=switch + aria-checked).
          <button
            type="button"
            role="switch"
            aria-checked={isSubscribed}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              isSubscribed
                ? "bg-primary dark:bg-primary"
                : "bg-border dark:bg-white/20"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                isSubscribed ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        )}
      </div>

      {/* How-to-unblock hint — only shown when permission was denied */}
      {permissionState === "denied" && (
        <p className="mt-3 text-xs leading-relaxed text-text-muted dark:text-text-muted">
          To re-enable: open your browser&apos;s site settings, find
          Notifications, and change Nazaria from &quot;Block&quot; to
          &quot;Allow&quot;. Then refresh this page.
        </p>
      )}
    </div>
  );
}