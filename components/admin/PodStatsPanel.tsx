// components/admin/PodStatsPanel.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { getPodStats } from "@/lib/api/org-stats";
import type { PodStats } from "@/types/admin";

function completionPct(row: PodStats): string {
  if (row.total_assignments === 0) return "—";
  return `${Math.round((row.completed_assignments / row.total_assignments) * 100)}%`;
}

export function PodStatsPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["pod-stats"],
    queryFn: getPodStats,
  });

  if (isLoading) {
    return <p className="text-sm text-text-muted dark:text-text-muted">Loading pod stats…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-destructive dark:text-destructive">
        Couldn&apos;t load pod stats.
      </p>
    );
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-text-muted dark:text-text-muted">No pods yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-text-muted dark:text-text-muted border-b border-border dark:border-border">
            <th className="py-2 pr-4 font-medium">Pod</th>
            <th className="py-2 pr-4 font-medium">Roster</th>
            <th className="py-2 pr-4 font-medium">Assignment completion</th>
            <th className="py-2 pr-4 font-medium">Open escalations</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const hasEscalations = row.open_escalations > 0;
            return (
              <tr
                key={row.pod_id}
                className={
                  hasEscalations
                    ? "bg-card-strong border-b border-border-strong dark:bg-card-strong dark:border-border-strong"
                    : "bg-card border-b border-border dark:bg-card dark:border-border"
                }
              >
                <td className="py-2 pr-4 font-medium text-text-primary dark:text-text-primary">
                  {row.pod_name}
                </td>
                <td className="py-2 pr-4 text-text-primary dark:text-text-primary">
                  {row.mentor_count} mentors · {row.mentee_count} mentees
                </td>
                <td className="py-2 pr-4 text-text-primary dark:text-text-primary">
                  {completionPct(row)}
                  {row.total_assignments === 0 && (
                    <span className="text-text-muted dark:text-text-muted"> (none yet)</span>
                  )}
                </td>
                <td
                  className={
                    hasEscalations
                      ? "py-2 pr-4 font-semibold text-text-accent dark:text-text-accent"
                      : "py-2 pr-4 text-text-primary dark:text-text-primary"
                  }
                >
                  {row.open_escalations}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}