// /app/exit-survey/meeting/[meetingId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { ExitSurveyReportView } from "@/components/exit-survey/ExitSurveyReportView";
import { getExitSurveysForMeetingDetailed, type ExitSurveyDetail } from "@/lib/api/exit-surveys";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * "At a glance" comparison for one meeting — every mentor/mentee survey
 * tied to it, submitted or pending, side by side. Staff only.
 */
export default function ExitSurveyMeetingComparisonPage() {
  const params = useParams<{ meetingId: string }>();
  const { permissionLevel } = useRole();
  const isStaff = permissionLevel === "staff";

  const [rows, setRows] = useState<ExitSurveyDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If not staff, just bail out. No need to update state since 
    // the UI will early-return the "Staff only" view anyway.
    if (!isStaff) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await getExitSurveysForMeetingDetailed(params.meetingId);
        if (!cancelled) {
          setRows(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load.");
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [params.meetingId, isStaff]);

  if (!isStaff) {
    return (
        <div className="p-4">
          <EmptyState title="Staff only" description="This page is only available to associates and program managers." />
        </div>
    );
  }

  return (
      <div className="p-4 md:p-6">
        {isLoading ? (
          <p className="text-sm text-text-muted dark:text-text-muted">Loading...</p>
        ) : error ? (
          <p className="text-sm text-destructive dark:text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No exit surveys"
            description="This meeting has no exit survey rows — it may have been created before an active template existed. Use the backfill endpoint to create them retroactively."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {rows.map((row) =>
              row.submittedAt ? (
                <ExitSurveyReportView key={row.id} detail={row} redacted={false} />
              ) : (
                <div key={row.id} className="surface-card dark:surface-card">
                  <p className="text-sm font-medium text-text-primary dark:text-text-primary">
                    {row.userRole}
                    {row.subjectFullName ? ` — about ${row.subjectFullName}` : ""} — not yet submitted
                  </p>
                  <p className="mt-1 text-xs text-text-muted dark:text-text-muted">
                    Waiting on {row.submitterFullName ?? "the submitter"}
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </div>
  );
}