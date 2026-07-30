// components/admin/MentorStatsPanel.tsx
"use client";

import Link from "next/link";
import type { MentorStats } from "@/types/admin";

function completionPct(row: MentorStats): string {
  if (row.total_assignments === 0) return "—";
  return `${Math.round((row.completed_assignments / row.total_assignments) * 100)}%`;
}

export interface MentorStatsPanelProps {
  data: MentorStats[];
  isLoading: boolean;
  error: boolean;
}

export function MentorStatsPanel({ data, isLoading, error }: MentorStatsPanelProps) {
  if (isLoading) {
    return <p className="text-sm text-text-muted dark:text-text-muted">Loading mentor stats…</p>;
  }
  if (error) {
    return <p className="text-sm text-destructive dark:text-destructive">Couldn&apos;t load mentor stats.</p>;
  }
  if (data.length === 0) {
    return <p className="text-sm text-text-muted dark:text-text-muted">No mentors to show.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-text-muted dark:text-text-muted border-b border-border dark:border-border">
            <th className="py-2 pr-4 font-medium">Mentor</th>
            <th className="py-2 pr-4 font-medium">Mentees</th>
            <th className="py-2 pr-4 font-medium">Their completion rate</th>
            <th className="py-2 pr-4 font-medium">Open escalations</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const hasEscalations = row.open_escalations_among_mentees > 0;
            return (
              <tr
                key={row.mentor_id}
                className={
                  hasEscalations
                    ? "bg-card-strong border-b border-border-strong dark:bg-card-strong dark:border-border-strong"
                    : "bg-card border-b border-border dark:bg-card dark:border-border"
                }
              >
                <td className="py-2 pr-4 font-medium">
                  <Link
                    href={`/admin?id=${row.mentor_id}`}
                    className="text-text-primary hover:text-text-accent hover:underline dark:text-text-primary dark:hover:text-text-accent"
                  >
                    {row.mentor_name ?? "Unknown"}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-text-primary dark:text-text-primary">{row.mentee_count}</td>
                <td className="py-2 pr-4 text-text-primary dark:text-text-primary">
                  {completionPct(row)}
                  {row.total_assignments === 0 && <span className="text-text-muted dark:text-text-muted"> (none yet)</span>}
                </td>
                <td className={hasEscalations ? "py-2 pr-4 font-semibold text-text-accent dark:text-text-accent" : "py-2 pr-4 text-text-primary dark:text-text-primary"}>
                  {row.open_escalations_among_mentees}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}