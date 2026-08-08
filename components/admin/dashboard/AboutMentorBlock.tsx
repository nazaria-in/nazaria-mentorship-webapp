// components/admin/dashboard/AboutMentorBlock.tsx
"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchMentorOverview } from "@/lib/api/admin-scope-details";
import { fetchPendingExitSurveysForUser } from "@/lib/api/exit-surveys";
import { PeopleGrid } from "@/components/shared/PeopleGrid";
import type { AdminScope } from "@/lib/api/admin-scope";
import type { FilterFieldDef } from "@/lib/filtering/types";

const FIELD_DEFS: FilterFieldDef[] = [
  { key: "search", kind: "text", columns: ["full_name"], searchable: true },
];

export function AboutMentorBlock({ scope }: { scope: AdminScope }) {
  const { data, isLoading } = useQuery({
    queryKey: ["mentor-overview", scope.userId],
    queryFn: () => fetchMentorOverview(scope),
  });

  const { data: pendingSurveys, isLoading: pendingSurveysLoading } = useQuery({
    queryKey: ["exit-surveys", "pending", scope.userId],
    queryFn: () => fetchPendingExitSurveysForUser(scope.userId),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-text-muted dark:text-text-muted">Loading…</p>;
  }

  const pct = data.totalAssignments > 0 ? Math.round((data.completedAssignments / data.totalAssignments) * 100) : null;

  return (
    <div className="flex bg-gray-100 p-4 rounded-xl  flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 dark:border-border dark:bg-card">
          <p className="text-xs text-text-muted dark:text-text-muted">Team</p>
          <p className="text-sm font-medium text-text-primary dark:text-text-primary">{data.podName ?? "No Team"}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 dark:border-border dark:bg-card">
          <p className="text-xs text-text-muted dark:text-text-muted">Mentees&apos; completion</p>
          <p className="text-sm font-medium text-text-primary dark:text-text-primary">
            {pct !== null ? `${pct}%` : "No assignments yet"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 dark:border-border dark:bg-card">
          <p className="text-xs text-text-muted dark:text-text-muted">Open escalations</p>
          <p className={`text-sm font-medium ${data.openEscalations > 0 ? "text-text-accent dark:text-text-accent" : "text-text-primary dark:text-text-primary"}`}>
            {data.openEscalations}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 dark:border-border dark:bg-card">
        <p className="text-xs text-text-muted dark:text-text-muted">Unfilled exit surveys (this mentor&apos;s own)</p>
        {pendingSurveysLoading ? (
          <p className="mt-1 text-sm text-text-muted dark:text-text-muted">Loading…</p>
        ) : !pendingSurveys || pendingSurveys.length === 0 ? (
          <p className="mt-1 text-sm text-text-primary dark:text-text-primary">None — all caught up.</p>
        ) : (
          <div className="mt-1.5 flex flex-col gap-1.5">
            {pendingSurveys.map((survey) => (
              <Link
                key={survey.exitSurveyId}
                href={`/exit-survey/${survey.exitSurveyId}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-card-alt px-2.5 py-1.5 text-xs hover:opacity-90 dark:bg-card-alt"
              >
                <span className="truncate text-text-primary dark:text-text-primary">{survey.title}</span>
                <span className="shrink-0 text-text-muted dark:text-text-muted">
                  {new Date(survey.createdAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">
          Mentees ({data.mentees.length})
        </h4>
        <PeopleGrid
          fieldDefs={FIELD_DEFS}
          viewKey={`mentor-mentees-${scope.userId}`}
          queryKey={["mentor-mentees-static", scope.userId]}
          queryFn={async (filterState) => {
            const term = filterState.search?.trim().toLowerCase();
            return term ? data.mentees.filter((m) => (m.fullName ?? "").toLowerCase().includes(term)) : data.mentees;
          }}
          computeClickable={() => true}
          emptyMessage="No mentees in this Team."
        />
      </div>
    </div>
  );
}