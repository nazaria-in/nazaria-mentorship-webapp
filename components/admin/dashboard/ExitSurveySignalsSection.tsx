// components/admin/dashboard/ExitSurveySignalsSection.tsx
"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFilterState } from "@/hooks/use-filter-state";
import { SmartFilterBar } from "@/components/filters/SmartFilterBar";
import { fetchExitSurveysForStaff, type ExitSurveyDetail } from "@/lib/api/exit-surveys";
import { EXIT_SURVEY_STAFF_FIELD_DEFS } from "@/lib/filtering/exit-survey-fields";

const SIGNAL_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-text-accent",
};

export interface ExitSurveySignalsSectionProps {
  /** Scope to a single pod (mentor view). Passed straight to the fetcher's
   *  own podId param — no extra client filtering needed for this case. */
  scopePodId?: string | null;
  /** Scope to a single subject (mentee view). Not supported by the
   *  fetcher directly, so applied as a client-side filter on the result. */
  scopeSubjectUserId?: string | null;
}

export function ExitSurveySignalsSection({ scopePodId, scopeSubjectUserId }: ExitSurveySignalsSectionProps) {
  const filterState = useFilterState(EXIT_SURVEY_STAFF_FIELD_DEFS, "dashboard-exit-signals");

  const { data, isLoading, error } = useQuery({
    queryKey: ["exit-survey-signals", scopePodId ?? null, scopeSubjectUserId ?? null, filterState.filterState, filterState.sortState],
    queryFn: () => fetchExitSurveysForStaff(filterState.filterState, filterState.sortState, scopePodId ?? null),
  });

  const rows = useMemo(() => {
    const all = data ?? [];
    return scopeSubjectUserId ? all.filter((r) => r.subjectUserId === scopeSubjectUserId) : all;
  }, [data, scopeSubjectUserId]);

  return (
    <div className="flex flex-col gap-3">
      <SmartFilterBar fieldDefs={EXIT_SURVEY_STAFF_FIELD_DEFS} state={filterState} />

      {isLoading && <p className="text-sm bg-gray-100 rounded-xl p-4 text-text-muted dark:text-text-muted">Loading…</p>}
      {error && <p className="text-sm text-destructive dark:text-destructive">Couldn&apos;t load exit surveys.</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-text-muted dark:text-text-muted">No submitted exit surveys match these filters.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <ExitSurveySignalCard key={row.id} row={row} />
        ))}
      </div>
    </div>
  );
}

function ExitSurveySignalCard({ row }: { row: ExitSurveyDetail }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 dark:border-border dark:bg-card">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.signal ? SIGNAL_DOT[row.signal] : "bg-text-muted"}`} />
        <span className="truncate text-sm font-medium text-text-primary dark:text-text-primary">
          {row.subjectFullName ?? "Unknown"}
        </span>
        <span className="ml-auto shrink-0 text-xs capitalize text-text-muted dark:text-text-muted">{row.userRole}</span>
      </div>
      {row.aiHeadline && (
        <p className="line-clamp-2 text-xs text-text-muted dark:text-text-muted">{row.aiHeadline}</p>
      )}
      <p className="text-[11px] text-text-muted dark:text-text-muted">
        {row.podName ? `${row.podName} · ` : ""}
        {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : "—"}
      </p>
    </div>
  );
}