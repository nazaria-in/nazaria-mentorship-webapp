// components/admin/dashboard/ExitSurveyCompletionSection.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFilterState } from "@/hooks/use-filter-state";
import { SmartFilterBar } from "@/components/filters/SmartFilterBar";
import { fetchCohortOptions } from "@/lib/api/admin-users";
import type { PendingExitSurveySummaryRow } from "@/types/admin";
import type { FilterFieldDef } from "@/lib/filtering/types";

export function ExitSurveyCompletionSection({
  data,
  isLoading,
}: {
  data: PendingExitSurveySummaryRow[];
  isLoading: boolean;
}) {
  const { data: cohortOptions } = useQuery({ queryKey: ["cohort-options"], queryFn: fetchCohortOptions });

  const fieldDefs: FilterFieldDef[] = useMemo(
    () => [
      { key: "search", kind: "text", columns: ["fullName"], searchable: true },
      { key: "cohort", kind: "entity", label: "Cohort", column: "cohortId", options: cohortOptions ?? [] },
    ],
    [cohortOptions]
  );

  const filterState = useFilterState(fieldDefs, "dashboard-exit-survey-completion");

  // This list is a client-held, grouped/derived summary (not a single
  // table/view SmartFilterBar can query directly) — so filtering is done
  // by hand here, same approach PodCompletionSection/MentorCompletionSection
  // already take for their prefetched `data` prop.
  const rows = useMemo(() => {
    const search = filterState.filterState.search?.trim().toLowerCase();
    const cohortId = filterState.filterState.values.cohort as string | undefined;

    return data
      .filter((r) => (search ? (r.fullName ?? "").toLowerCase().includes(search) : true))
      .filter((r) => (cohortId ? r.cohortId === cohortId : true))
      .sort((a, b) => b.pendingCount - a.pendingCount || (a.oldestCreatedAt < b.oldestCreatedAt ? -1 : 1));
  }, [data, filterState.filterState]);

  return (
    <div className="flex flex-col gap-3">
      <SmartFilterBar fieldDefs={fieldDefs} state={filterState} />
      {isLoading && <p className="text-sm text-text-muted dark:text-text-muted">Loading…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-text-muted dark:text-text-muted">No one has an unfilled exit survey right now.</p>
      )}
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <Link
            key={row.userId}
            href={`/admin?id=${row.userId}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-card-alt dark:border-border dark:bg-card"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary dark:text-text-primary">
                {row.fullName ?? "Unknown"}{" "}
                <span className="font-normal capitalize text-text-muted dark:text-text-muted">({row.role})</span>
              </p>
              <p className="text-xs text-text-muted dark:text-text-muted">
                {row.podName ?? "No pod"} · oldest {formatRelativeAge(row.oldestCreatedAt)}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">
              {row.pendingCount} unfilled
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function formatRelativeAge(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDay < 1) return "today";
  if (diffDay === 1) return "1 day ago";
  return `${diffDay} days ago`;
}