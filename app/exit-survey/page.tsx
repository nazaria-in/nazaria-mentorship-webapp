// /app/exit-survey/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { ExitSurveyPendingList } from "@/components/exit-survey/ExitSurveyPendingList";
import { ExitSurveyStaffDashboard } from "@/components/exit-survey/ExitSurveyStaffDashboard";
import type { ExitSurveyRole } from "@/types/exit-survey";

export default function ExitSurveyLandingPage() {
  const { permissionLevel } = useRole();
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<ExitSurveyRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isStaff = permissionLevel === "staff";

  useEffect(() => {
    // If staff, just return early. The UI renders the staff dashboard
    // immediately, so updating isLoading here is unnecessary and causes
    // cascading renders.
    if (isStaff) {
      return;
    }

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
          if (!cancelled) {
            setError("Not logged in.");
            setIsLoading(false);
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("role")
          .eq("id", authUser.id)
          .single();

        if (profileError || !profile) {
          if (!cancelled) {
            setError("Couldn't load your profile.");
            setIsLoading(false);
          }
          return;
        }

        const userRole = profile.role as string;
        if (userRole !== "mentor" && userRole !== "mentee") {
          if (!cancelled) {
            setError("Exit surveys only apply to mentor/mentee accounts.");
            setIsLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setUserId(authUser.id);
          setRole(userRole as ExitSurveyRole);
          // Cleanup moved here to avoid React Compiler 'finally' errors
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load.");
          // Cleanup moved here to avoid React Compiler 'finally' errors
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isStaff]);

  return (
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
  );
}