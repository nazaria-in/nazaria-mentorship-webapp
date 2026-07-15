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

    async function hydrate() {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData.user;
      if (!authUser) {
        clearSession();
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("id, role, full_name") // fetched directly from unified table now
        .eq("id", authUser.id)
        .single();

      if (profile) {
        setSession({
          userId: profile.id,
          fullName: profile.full_name ?? "Anonymous User",
          role: profile.role as Role,
        });
      }
    }

    hydrate();
  }, [setSession, clearSession]);

  return <>{children}</>;
}