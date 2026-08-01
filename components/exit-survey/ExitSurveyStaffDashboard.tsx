// /components/exit-survey/ExitSurveyStaffDashboard.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useFilterState } from "@/hooks/use-filter-state";
import { SmartFilterBar } from "@/components/filters/SmartFilterBar";
import { EXIT_SURVEY_STAFF_FIELD_DEFS } from "@/lib/filtering/exit-survey-fields";
import { fetchExitSurveysForStaff, fetchExitSurveyEscalations } from "@/lib/api/exit-surveys";
import { fetchPodOptions } from "@/lib/api/admin-users";
import type { ExitSurveyDetail } from "@/lib/api/exit-surveys";

const SIGNAL_DOT: Record<string, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
};

const SENTIMENT_STYLE: Record<string, string> = {
  positive: "bg-green-500/15 text-green-700 dark:text-green-300",
  neutral: "bg-border text-text-muted dark:text-text-muted",
  negative: "bg-red-500/15 text-red-700 dark:text-red-300",
};

export function ExitSurveyStaffDashboard() {
  const filterState = useFilterState(EXIT_SURVEY_STAFF_FIELD_DEFS, "exit-surveys-staff");
  const [podFilter, setPodFilter] = useState<string>("");

  const { data: podOptions } = useQuery({ queryKey: ["pod-options"], queryFn: fetchPodOptions });

  const { data: escalations, isLoading: escalationsLoading } = useQuery({
    queryKey: ["exit-survey-escalations"],
    queryFn: fetchExitSurveyEscalations,
  });

  const { data: rows, isLoading: rowsLoading } = useQuery({
    queryKey: ["exit-surveys-staff", filterState.filterState, filterState.sortState, podFilter],
    queryFn: () => fetchExitSurveysForStaff(filterState.filterState, filterState.sortState, podFilter || null),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-text-muted dark:text-text-muted">
            All submitted surveys
          </h2>
          <Link
            href="/admin/exit-survey-templates"
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Edit/Create Exit Survey
          </Link>
        </div>
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

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <SmartFilterBar fieldDefs={EXIT_SURVEY_STAFF_FIELD_DEFS} state={filterState} />
          {/* Pod filter lives outside SmartFilterBar — pod comes from a
              separate view join (v_exit_survey_context), not a column on
              exit_surveys, so it can't use applyFilters directly. */}
          <select
            value={podFilter}
            onChange={(e) => setPodFilter(e.target.value)}
            className="rounded-lg border border-border bg-card-alt px-3 py-1.5 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
          >
            <option value="">All pods</option>
            {(podOptions ?? []).map((pod) => (
              <option key={pod.value} value={pod.value}>
                {pod.label}
              </option>
            ))}
          </select>
        </div>

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
        {(row.podName || row.mentorNames.length > 0) && (
          <p className="text-xs text-text-muted dark:text-text-muted">
            {row.podName ? `Pod: ${row.podName}` : ""}
            {row.podName && row.mentorNames.length > 0 ? " · " : ""}
            {row.mentorNames.length > 0 ? `Mentor(s): ${row.mentorNames.join(", ")}` : ""}
          </p>
        )}
        {row.aiHeadline && (
          <p className="mt-1 text-xs text-text-primary dark:text-text-primary">{row.aiHeadline}</p>
        )}
        {row.concernTags.length > 0 && (
          <p className="mt-1 text-xs text-text-muted dark:text-text-muted">
            Flagged: {row.concernTags.join(", ")}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {row.sentiment && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SENTIMENT_STYLE[row.sentiment]}`}>
            {row.sentiment}
          </span>
        )}
        <span className={`h-3 w-3 rounded-full ${row.signal ? SIGNAL_DOT[row.signal] : "bg-border"}`} />
      </div>
    </Link>
  );
}