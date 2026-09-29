// /providers/session-provider.tsx

"use client";

import * as React from "react";
import posthog from "posthog-js";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useSessionStore } from "@/store/session-store";
import type { Role } from "@/providers/role-provider";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const setSession = useSessionStore((s) => s.setSession);
  const clearSession = useSessionStore((s) => s.clearSession);

  React.useEffect(() => {
    const supabase = createClient();
    let identifiedUserId: string | null = null;

    function identifyUser(user: User) {
      if (identifiedUserId && identifiedUserId !== user.id) {
        posthog.reset();
      }

      posthog.identify(user.id, {
        email: user.email,
        name:
          typeof user.user_metadata.full_name === "string"
            ? user.user_metadata.full_name
            : undefined,
      });
      identifiedUserId = user.id;
    }

    async function hydrateFromUser(user: User) {
      identifyUser(user);

      const { data: profile } = await supabase
        .from("users")
        .select("id, role, full_name, approval_status")
        .eq("id", user.id)
        .single();

      if (profile) {
        setSession({
          userId: profile.id,
          fullName: profile.full_name ?? "Anonymous User",
          role: profile.role as Role,
          approvalStatus: profile.approval_status,
        });
      } else {
        clearSession();
      }
    }

    // Identify the persisted session once on page refresh.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        void hydrateFromUser(data.user);
      } else {
        clearSession();
      }
    });

    // Identify after sign-in/sign-up and reset when that session ends.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && event === "SIGNED_IN") {
        void hydrateFromUser(session.user);
      } else if (event === "SIGNED_OUT") {
        posthog.reset();
        identifiedUserId = null;
        clearSession();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession, clearSession]);

  return <>{children}</>;
}