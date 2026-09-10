// /components/shell/ServiceWorkerRegistrar.tsx

"use client";

import { useEffect } from "react";

// Registers /public/sw.js once at the root layout level. Rendered as a
// child of the root layout body — it produces no DOM output. Must be a
// separate "use client" component because app/layout.tsx is a Server
// Component and cannot call useEffect directly.
//
// Registration is intentionally silent on failure — if the browser doesn't
// support service workers (very old browsers, some private browsing modes)
// the app continues to work normally; push notifications simply won't be
// available, and PushNotificationToggle handles that case by hiding itself.
export function ServiceWorkerRegistrar(): null {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[sw] registered, scope:", registration.scope);
      })
      .catch((err) => {
        console.warn("[sw] registration failed:", err);
      });
  }, []);

  return null;
}