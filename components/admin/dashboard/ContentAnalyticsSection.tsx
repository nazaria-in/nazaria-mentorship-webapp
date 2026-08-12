// components/admin/dashboard/ContentAnalyticsSection.tsx

"use client";

import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import type { fetchAnalyticsRollup } from "@/lib/api/content-analytics";

export function ContentAnalyticsSection({
  rollup,
  isLoading,
}: {
  rollup: Awaited<ReturnType<typeof fetchAnalyticsRollup>>;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <p className="text-sm text-text-muted dark:text-text-muted">Loading…</p>;
  }

  if (rollup.length === 0) {
    return (
      <EmptyState
        title="Nothing tracked yet"
        description={'No submissions have used a "Track in analytics" question yet, or the content_analytics_answers migration hasn\'t been applied.'}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rollup.map((row) => (
        <MetricCard key={row.metricKey} row={row} />
      ))}
    </div>
  );
}

function MetricCard({ row }: { row: Awaited<ReturnType<typeof fetchAnalyticsRollup>>[number] }) {
  return (
    <section className="surface-card flex flex-col gap-3 dark:surface-card">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-sm font-semibold text-text-primary dark:text-text-primary">{row.metricKey}</h3>
        <span className="rounded-full bg-card-alt px-2 py-0.5 text-[11px] text-text-muted dark:bg-card-alt dark:text-text-muted">
          {row.totalAnswers} answer{row.totalAnswers === 1 ? "" : "s"}
        </span>
      </div>

      {row.numericStats && (
        <div className="flex gap-4 text-sm text-text-primary dark:text-text-primary">
          <span>Avg: {row.numericStats.avg.toFixed(1)}</span>
          <span>Min: {row.numericStats.min}</span>
          <span>Max: {row.numericStats.max}</span>
        </div>
      )}

      {row.valueCounts && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(row.valueCounts).map(([label, count]) => (
            <span
              key={label}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted dark:border-border dark:text-text-muted"
            >
              {label}: {count}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1 border-t border-border pt-2 dark:border-border">
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted dark:text-text-muted">
          From {row.contentItems.length} content item{row.contentItems.length === 1 ? "" : "s"}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {row.contentItems.map((item) => (
            <Link
              key={item.id}
              href={`/assignments_and_courses/${item.id}`}
              className="text-xs text-text-accent hover:underline dark:text-text-accent"
            >
              {item.title}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}