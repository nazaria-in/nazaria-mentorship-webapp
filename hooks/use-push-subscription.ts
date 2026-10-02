// /hooks/use-push-subscription.ts

"use client";

console.log("[push:hook] mounted, posthog ready:", posthog.__loaded);

import { useEffect, useState } from "react";
import posthog from "posthog-js";

export interface UsePushSubscriptionReturn {
  /** False when the browser has no push API at all — hide the toggle entirely. */
  isSupported: boolean;
  /** Whether this browser/device is currently subscribed. */
  isSubscribed: boolean;
  /** Waiting for the initial subscription state check, or mid-subscribe/unsubscribe. */
  isLoading: boolean;
  /** Current browser notification permission. 'denied' means the toggle should
   *  show a "blocked in browser settings" message instead of a working control. */
  permissionState: NotificationPermission;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(isSupported);
  const [permissionState, setPermissionState] = useState<NotificationPermission>(() => {
    return isSupported ? Notification.permission : "default";
  });

  useEffect(() => {
    if (!isSupported) {
      posthog.capture("push_not_supported", {
        userAgent: navigator.userAgent,
      });
      return;
    }

    posthog.capture("push_hook_init", {
      permissionState: Notification.permission,
      userAgent: navigator.userAgent,
    });

    let cancelled = false;

    navigator.serviceWorker.ready
      .then((registration) => {
        posthog.capture("push_sw_ready", { scope: registration.scope });
        return registration.pushManager.getSubscription();
      })
      .then((subscription) => {
        if (cancelled) return;
        const hasSubscription = subscription !== null;
        posthog.capture("push_subscription_check", {
          hasSubscription,
          endpoint: subscription?.endpoint ?? null,
        });
        setIsSubscribed(hasSubscription);
      })
      .catch((err: unknown) => {
        posthog.capture("push_subscription_check_failed", { error: String(err) });
        console.warn("[usePushSubscription] Failed to read subscription state:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSupported]);

  async function subscribe(): Promise<void> {
    if (!isSupported) return;
    setIsLoading(true);

    try {
      posthog.capture("push_subscribe_started");

      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      posthog.capture("push_permission_result", { permission });

      if (permission !== "granted") {
        posthog.capture("push_subscribe_aborted", { reason: "permission_not_granted", permission });
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        posthog.capture("push_subscribe_failed", { reason: "vapid_key_missing" });
        console.error("[usePushSubscription] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });

      posthog.capture("push_browser_subscribed", { endpoint: subscription.endpoint });

      const subJson = subscription.toJSON();

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh ?? "",
            auth: subJson.keys?.auth ?? "",
          },
        }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        posthog.capture("push_subscribe_api_failed", {
          status: response.status,
          responseText,
        });
        console.error("[usePushSubscription] /api/push/subscribe failed", responseText);
        await subscription.unsubscribe();
        return;
      }

      posthog.capture("push_subscribe_success", { endpoint: subscription.endpoint });
      setIsSubscribed(true);
    } catch (err: unknown) {
      posthog.capture("push_subscribe_error", { error: String(err) });
      console.error("[usePushSubscription] subscribe() failed:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribe(): Promise<void> {
    if (!isSupported) return;
    setIsLoading(true);

    try {
      posthog.capture("push_unsubscribe_started");

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        posthog.capture("push_unsubscribe_no_subscription");
        setIsSubscribed(false);
        return;
      }

      const response = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        posthog.capture("push_unsubscribe_api_failed", {
          status: response.status,
          responseText,
        });
        console.error("[usePushSubscription] /api/push/unsubscribe failed", responseText);
        return;
      }

      await subscription.unsubscribe();
      posthog.capture("push_unsubscribe_success");
      setIsSubscribed(false);
    } catch (err: unknown) {
      posthog.capture("push_unsubscribe_error", { error: String(err) });
      console.error("[usePushSubscription] unsubscribe() failed:", err);
    } finally {
      setIsLoading(false);
    }
  }

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permissionState,
    subscribe,
    unsubscribe,
  };
}