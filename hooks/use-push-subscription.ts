// /hooks/use-push-subscription.ts

"use client";

import { useEffect, useState } from "react";

export type PushPermissionState = "unsupported" | "default" | "granted" | "denied";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface UsePushSubscriptionResult {
  permission: PushPermissionState;
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

/**
 * Chrome-first Web Push. "unsupported" covers Safari on older versions and
 * any browser without Notification/PushManager — callers should hide the
 * "enable notifications" UI entirely in that case rather than showing a
 * button that fails.
 */
export function usePushSubscription(): UsePushSubscriptionResult {
  const [permission, setPermission] = useState<PushPermissionState>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function initializePush() {
      const supported =
        typeof window !== "undefined" &&
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;

      if (!supported) {
        if (!ignore) {
          setPermission("unsupported");
          setIsLoading(false);
        }
        return;
      }

      const currentPermission = Notification.permission as PushPermissionState;

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const existing = await registration.pushManager.getSubscription();

        if (!ignore) {
          setPermission(currentPermission);
          setIsSubscribed(existing !== null);
        }
      } catch (error) {
        console.error("Failed to register ServiceWorker:", error);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void initializePush();

    return () => {
      ignore = true;
    };
  }, []);

  async function subscribe(): Promise<void> {
    const permissionResult = await Notification.requestPermission();
    setPermission(permissionResult as PushPermissionState);

    if (permissionResult !== "granted") return;

    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set.");
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

    const json = subscription.toJSON();
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });

    if (!response.ok) {
      throw new Error("Failed to save push subscription.");
    }

    setIsSubscribed(true);
  }

  async function unsubscribe(): Promise<void> {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      setIsSubscribed(false);
      return;
    }

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });

    setIsSubscribed(false);
  }

  return { permission, isSubscribed, isLoading, subscribe, unsubscribe };
}