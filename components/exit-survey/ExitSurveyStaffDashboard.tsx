// /components/exit-survey/ExitSurveyStaffDashboard.tsx
"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useFilterState } from "@/hooks/use-filter-state";
import { SmartFilterBar } from "@/components/filters/SmartFilterBar";
import { EXIT_SURVEY_STAFF_FIELD_DEFS } from "@/lib/filtering/exit-survey-fields";
import { fetchExitSurveysForStaff, fetchExitSurveyEscalations } from "@/lib/api/exit-surveys";
import type { ExitSurveyDetail } from "@/lib/api/exit-surveys";

const SIGNAL_DOT: Record<string, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
};

export function ExitSurveyStaffDashboard() {
  const filterState = useFilterState(EXIT_SURVEY_STAFF_FIELD_DEFS, "exit-surveys-staff");

  const { data: escalations, isLoading: escalationsLoading } = useQuery({
    queryKey: ["exit-survey-escalations"],
    queryFn: fetchExitSurveyEscalations,
  });

  const { data: rows, isLoading: rowsLoading } = useQuery({
    queryKey: ["exit-surveys-staff", filterState.filterState, filterState.sortState],
    queryFn: () => fetchExitSurveysForStaff(filterState.filterState, filterState.sortState),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-text-muted dark:text-text-muted">
          Needs attention
        </h2>
        {escalationsLoading && <p className="text-sm text-text-muted dark:text-text-muted">Loading...</p>}
        {!escalationsLoading && (escalations ?? []).length === 0 && (
          <p className="text-sm text-text-muted dark:text-text-muted">No open escalations right now.</p>
        )}
        <div className="flex flex-col gap-2">
          {(escalations ?? []).map((row) => (
            <ExitSurveyRowCard key={row.id} row={row} highlighted />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-text-muted dark:text-text-muted">
          All submitted surveys
        </h2>
        <SmartFilterBar fieldDefs={EXIT_SURVEY_STAFF_FIELD_DEFS} state={filterState} />

        {rowsLoading && <p className="mt-2 text-sm text-text-muted dark:text-text-muted">Loading...</p>}

        <div className="mt-2 flex flex-col gap-2">
          {(rows ?? []).map((row) => (
            <ExitSurveyRowCard key={row.id} row={row} highlighted={false} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ExitSurveyRowCard({ row, highlighted }: { row: ExitSurveyDetail; highlighted: boolean }) {
  return (
    <Link
      href={`/exit-survey/${row.id}`}
      className={`flex items-center justify-between rounded-xl border p-4 dark:border-border ${
        highlighted
          ? "border-border-strong bg-card-alt dark:bg-card-alt"
          : "border-border bg-card dark:bg-card"
      }`}
    >
      <div>
        <p className="text-sm font-medium text-text-primary dark:text-text-primary">
          {row.meetingTitle} · {row.userRole}
          {row.userRole === "mentor" && row.subjectFullName ? ` — about ${row.subjectFullName}` : ""}
        </p>
        <p className="text-xs text-text-muted dark:text-text-muted">
          {row.submitterFullName ?? "Unknown"} ·{" "}
          {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "not submitted"}
        </p>
        {row.concernTags.length > 0 && (
          <p className="mt-1 text-xs text-text-muted dark:text-text-muted">
            Flagged: {row.concernTags.join(", ")}
          </p>
        )}
      </div>
      <span className={`h-3 w-3 shrink-0 rounded-full ${row.signal ? SIGNAL_DOT[row.signal] : "bg-border"}`} />
    </Link>
  );
}