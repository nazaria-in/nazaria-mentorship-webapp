// /hooks/use-push-subscription.ts

"use client";

import { useEffect, useState } from "react";

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

  // On mount, check the real current subscription state.
  useEffect(() => {
    if (!isSupported) return;

    let cancelled = false;

    navigator.serviceWorker.ready
      .then((registration) => {
        return registration.pushManager.getSubscription();
      })
      .then((subscription) => {
        if (cancelled) return;
        setIsSubscribed(subscription !== null);
      })
      .catch((err) => {
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
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission !== "granted") {
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error("[usePushSubscription] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });

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
        console.error("[usePushSubscription] /api/push/subscribe failed", await response.text());
        await subscription.unsubscribe();
        return;
      }

      setIsSubscribed(true);
    } catch (err) {
      console.error("[usePushSubscription] subscribe() failed:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribe(): Promise<void> {
    if (!isSupported) return;
    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsSubscribed(false);
        return;
      }

      const response = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      if (!response.ok) {
        console.error("[usePushSubscription] /api/push/unsubscribe failed", await response.text());
        return;
      }

      await subscription.unsubscribe();
      setIsSubscribed(false);
    } catch (err) {
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