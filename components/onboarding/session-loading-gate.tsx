// /components/onboarding/session-loading-gate.tsx

"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import { RoleChoice } from "@/components/onboarding/role-choice";

const SESSION_WAIT_TIMEOUT_MS = 4000;
const RELOAD_DELAY_MS = 3000;
const RELOAD_GUARD_KEY = "nazaria:onboarding-role:reload-attempted";

/**
 * Wraps RoleChoice with a session-loading state.
 *
 * - While the session store hasn't hydrated yet: show a loading indicator
 *   and pass disabled=true down so the role cards are visibly inert.
 * - If it hydrates within SESSION_WAIT_TIMEOUT_MS: just render normally.
 * - If it's still not hydrated after the timeout: assume the session
 *   fetch got stuck, wait RELOAD_DELAY_MS more, then reload once.
 * - The "once" is enforced via sessionStorage, not a ref/state flag —
 *   a ref wouldn't survive the reload it's meant to guard against.
 *   The flag clears itself as soon as a real session is found, so a
 *   later genuine session drop can still trigger one more reload later.
 */
export function SessionLoadingGate(): React.JSX.Element {
  const hydrated = useSessionStore((s) => s.hydrated);
  const [timedOut, setTimedOut] = React.useState(false);

  // Wait for hydration; if it never comes, flip timedOut.
  React.useEffect(() => {
    if (hydrated) return;
    const timer = window.setTimeout(() => setTimedOut(true), SESSION_WAIT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [hydrated]);

  // Once timed out (and still not hydrated), schedule a single guarded
  // reload. If we've already tried once this browser session, don't try
  // again automatically — avoids an infinite reload loop if Supabase is
  // genuinely unreachable.
  React.useEffect(() => {
    if (!timedOut || hydrated) return;

    const alreadyAttempted = window.sessionStorage.getItem(RELOAD_GUARD_KEY) === "1";
    if (alreadyAttempted) return;

    window.sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
    const reloadTimer = window.setTimeout(() => {
      window.location.reload();
    }, RELOAD_DELAY_MS);

    return () => window.clearTimeout(reloadTimer);
  }, [timedOut, hydrated]);

  // Session recovered — clear the guard so a future genuine stall can
  // still trigger one reload of its own, rather than being permanently
  // silenced by this session's earlier attempt.
  React.useEffect(() => {
    if (hydrated) {
      window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
    }
  }, [hydrated]);

  const stuck = timedOut && !hydrated;
  const alreadyReloadedOnce = stuck && window.sessionStorage.getItem(RELOAD_GUARD_KEY) === "1";

  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-4">
      {!hydrated && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-text-muted dark:border-border dark:bg-card dark:text-text-muted"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {stuck
            ? alreadyReloadedOnce
              ? "Still having trouble loading your session. Try refreshing manually."
              : "This is taking longer than expected — reloading shortly…"
            : "Checking your session…"}
        </div>
      )}

      <RoleChoice disabled={!hydrated} />
    </div>
  );
}