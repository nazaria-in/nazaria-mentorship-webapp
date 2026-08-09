// /providers/session-provider.tsx

"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useSessionStore } from "@/store/session-store";
import type { Role } from "@/providers/role-provider";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const setSession = useSessionStore((s) => s.setSession);
  const clearSession = useSessionStore((s) => s.clearSession);

  React.useEffect(() => {
    const supabase = createClient();

    async function hydrateFromUserId(userId: string) {
      const { data: profile } = await supabase
        .from("users")
        .select("id, role, full_name, approval_status")
        .eq("id", userId)
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

    // Initial load
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        hydrateFromUserId(data.user.id);
      } else {
        clearSession();
      }
    });

    // Re-hydrate whenever auth state actually changes
    // (sign in, sign up, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        hydrateFromUserId(session.user.id);
      } else if (event === "SIGNED_OUT") {
        clearSession();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession, clearSession]);

  return <>{children}</>;
}