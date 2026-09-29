// /components/shell/ServiceWorkerRegistrar.tsx

"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

// Registers /public/sw.js once at the root layout level.
// Also listens for SW_LOG messages that sw.js broadcasts via postMessage
// and forwards them to PostHog, since PostHog cannot run inside a SW directly.

interface SwLogMessage {
  type: "SW_LOG";
  event: string;
  properties: Record<string, unknown>;
}

function isSwLogMessage(data: unknown): data is SwLogMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>)["type"] === "SW_LOG"
  );
}

export function ServiceWorkerRegistrar(): null {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Register the SW
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        posthog.capture("sw_registered", {
          scope: registration.scope,
          state: registration.active
            ? "active"
            : registration.waiting
            ? "waiting"
            : registration.installing
            ? "installing"
            : "unknown",
        });
      })
      .catch((err: unknown) => {
        posthog.capture("sw_registration_failed", {
          error: String(err),
        });
      });

    // Forward SW postMessage logs to PostHog
    function handleMessage(event: MessageEvent): void {
      if (!isSwLogMessage(event.data)) return;
      posthog.capture(event.data.event, {
        ...event.data.properties,
        source: "service_worker",
      });
    }

    navigator.serviceWorker.addEventListener("message", handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);

  return null;
}