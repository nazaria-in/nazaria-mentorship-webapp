// components/admin/dashboard/AboutMentorBlock.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMentorOverview } from "@/lib/api/admin-scope-details";
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

  if (isLoading || !data) {
    return <p className="text-sm text-text-muted dark:text-text-muted">Loading…</p>;
  }

  const pct = data.totalAssignments > 0 ? Math.round((data.completedAssignments / data.totalAssignments) * 100) : null;

  return (
    <div className="flex bg-gray-100 p-4 rounded-xl  flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 dark:border-border dark:bg-card">
          <p className="text-xs text-text-muted dark:text-text-muted">Pod</p>
          <p className="text-sm font-medium text-text-primary dark:text-text-primary">{data.podName ?? "No pod"}</p>
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
          emptyMessage="No mentees in this pod."
        />
      </div>
    </div>
  );
}