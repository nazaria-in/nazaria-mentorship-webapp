// /app/exit-survey/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/shell/AppShell";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { ExitSurveyPendingList } from "@/components/exit-survey/ExitSurveyPendingList";
import { ExitSurveyStaffDashboard } from "@/components/exit-survey/ExitSurveyStaffDashboard";
import type { ExitSurveyRole } from "@/types/exit-survey";

export default function ExitSurveyLandingPage() {
  const { permissionLevel } = useRole();
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<ExitSurveyRole | null>(null);
  const isStaff = permissionLevel === "staff";

  // Derive initial loading state from `isStaff` rather than scheduling an effect update
  const [isLoading, setIsLoading] = useState(!isStaff);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Staff members don't need to load user profile data
    if (isStaff) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
          if (!cancelled) setError("Not logged in.");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("role")
          .eq("id", authUser.id)
          .single();

        if (profileError || !profile) {
          if (!cancelled) setError("Couldn't load your profile.");
          return;
        }

        const userRole = profile.role as string;
        if (userRole !== "mentor" && userRole !== "mentee") {
          if (!cancelled) setError("Exit surveys only apply to mentor/mentee accounts.");
          return;
        }

        if (!cancelled) {
          setUserId(authUser.id);
          setRole(userRole as ExitSurveyRole);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isStaff]);

  return (
    <AppShell navItems={NAV_BY_PERMISSION[permissionLevel]} pageTitle="Exit surveys">
      <div className="p-4 md:p-6">
        {isStaff ? (
          <ExitSurveyStaffDashboard />
        ) : isLoading ? (
          <p className="text-sm text-text-muted dark:text-text-muted">Loading...</p>
        ) : error ? (
          <p className="text-sm text-destructive dark:text-destructive">{error}</p>
        ) : userId && role ? (
          <ExitSurveyPendingList userId={userId} role={role} />
        ) : null}
      </div>
    </AppShell>
  );
}