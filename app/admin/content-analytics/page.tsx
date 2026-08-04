// /app/admin/content-analytics/page.tsx

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { useRole } from "@/providers/role-provider";
import { EmptyState } from "@/components/shared/EmptyState";
import { fetchAnalyticsRollup } from "@/lib/api/content-analytics";

/**
 * Phase 2 todo item: "Wire computed + asked analytics fields into
 * mentor/PM/associate views." Reads content_analytics_answers (see the
 * 20260803_content_analytics_answers.sql migration) grouped by metric_key
 * — every question across every assignment/course/resource that shares a
 * metric_key shows up as one combined row here, per the "Track in
 * analytics" convention documented in ContentSubmissionTemplateEditor.
 *
 * Gated to mentor/staff — mentees have no reason to see aggregate rollups
 * across content items.
 */
export default function ContentAnalyticsPage() {
  const { permissionLevel } = useRole();
  const canView = permissionLevel === "mentor" || permissionLevel === "staff";

  const { data: rollup, isLoading } = useQuery({
    queryKey: ["content-analytics-rollup"],
    queryFn: fetchAnalyticsRollup,
    enabled: canView,
  });

  if (!canView) {
    return (
      <div className="p-4">
        <EmptyState title="Not available" description="This view is only available to mentors and staff." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-text-accent dark:text-text-accent" />
        <h1 className="font-heading text-lg font-medium text-text-primary dark:text-text-primary">
          Content analytics
        </h1>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted dark:text-text-muted">Loading…</p>
      ) : !rollup || rollup.length === 0 ? (
        <EmptyState
          title="Nothing tracked yet"
          description={'No submissions have used a "Track in analytics" question yet, or the content_analytics_answers migration hasn\'t been applied.'}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rollup.map((row) => (
            <MetricCard key={row.metricKey} row={rollup.find((r) => r.metricKey === row.metricKey)!} />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({ row }: { row: Awaited<ReturnType<typeof fetchAnalyticsRollup>>[number] }) {
  return (
    <section className="surface-card flex flex-col gap-3 dark:surface-card">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-sm font-semibold text-text-primary dark:text-text-primary">{row.metricKey}</h2>
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