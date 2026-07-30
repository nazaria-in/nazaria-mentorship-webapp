// components/admin/dashboard/ExitSurveySignalsSection.tsx
"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
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
  scopePodId?: string | null;
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
    const scoped = scopeSubjectUserId ? all.filter((r) => r.subjectUserId === scopeSubjectUserId) : all;
    // Red-signal rows surface first — "anything red needs attention".
    return [...scoped].sort((a, b) => {
      const rank = (s: string | null) => (s === "red" ? 0 : s === "yellow" ? 1 : 2);
      return rank(a.signal) - rank(b.signal);
    });
  }, [data, scopeSubjectUserId]);

  return (
    <div className="flex flex-col gap-3">
      <SmartFilterBar fieldDefs={EXIT_SURVEY_STAFF_FIELD_DEFS} state={filterState} />

      {isLoading && <p className="text-sm text-text-muted dark:text-text-muted">Loading…</p>}
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
  const needsAttention = row.signal === "red";

  return (
    <Link
      href={`/exit-survey/${row.id}`}
      className={`flex flex-col gap-1.5 rounded-xl border p-3 transition-colors hover:border-border-strong dark:hover:border-border-strong ${
        needsAttention
          ? "border-text-accent/40 bg-card-strong dark:border-text-accent/40 dark:bg-card-strong"
          : "border-border bg-card dark:border-border dark:bg-card"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.signal ? SIGNAL_DOT[row.signal] : "bg-text-muted"}`} />
        <span className="truncate text-sm font-medium text-text-primary dark:text-text-primary">
          {row.subjectFullName ?? "Unknown"}
        </span>
        <span className="ml-auto shrink-0 text-xs capitalize text-text-muted dark:text-text-muted">{row.userRole}</span>
      </div>
      {needsAttention && (
        <span className="w-fit rounded-full bg-text-accent/15 px-2 py-0.5 text-[10px] font-semibold text-text-accent dark:bg-text-accent/20 dark:text-text-accent">
          Needs attention
        </span>
      )}
      {row.aiHeadline && <p className="line-clamp-2 text-xs text-text-muted dark:text-text-muted">{row.aiHeadline}</p>}
      <p className="text-[11px] text-text-muted dark:text-text-muted">
        {row.podName ? `${row.podName} · ` : ""}
        {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : "—"}
      </p>
    </Link>
  );
}