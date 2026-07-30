// components/admin/dashboard/PodCompletionSection.tsx
"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CompletionRow } from "@/components/admin/dashboard/CompletionRow";
import { useFilterState } from "@/hooks/use-filter-state";
import { SmartFilterBar } from "@/components/filters/SmartFilterBar";
import { fetchCohortOptions, fetchPodFirstMentors } from "@/lib/api/admin-users";
import type { PodStats } from "@/types/admin";
import type { FilterFieldDef } from "@/lib/filtering/types";

export function PodCompletionSection({ data, isLoading }: { data: PodStats[]; isLoading: boolean }) {
  const { data: cohortOptions } = useQuery({ queryKey: ["cohort-options"], queryFn: fetchCohortOptions });
  const { data: firstMentors } = useQuery({ queryKey: ["pod-first-mentors"], queryFn: fetchPodFirstMentors });

  const mentorByPod = useMemo(() => {
    const map = new Map<string, string>();
    (firstMentors ?? []).forEach((r) => map.set(r.podId, r.mentorId));
    return map;
  }, [firstMentors]);

  const fieldDefs: FilterFieldDef[] = useMemo(
    () => [
      { key: "search", kind: "text", columns: ["pod_name"], searchable: true },
      { key: "cohort", kind: "entity", label: "Cohort", column: "cohort_id", options: cohortOptions ?? [] },
    ],
    [cohortOptions]
  );

  const filterState = useFilterState(fieldDefs, "dashboard-pod-completion");

  const rows = useMemo(() => {
    const search = filterState.filterState.search?.trim().toLowerCase();
    const cohortId = filterState.filterState.values.cohort as string | undefined;

    return data
      .filter((r) => (search ? r.pod_name.toLowerCase().includes(search) : true))
      .filter((r) => (cohortId ? r.cohort_id === cohortId : true))
      .sort((a, b) => {
        const aRatio = a.total_assignments > 0 ? a.completed_assignments / a.total_assignments : Infinity;
        const bRatio = b.total_assignments > 0 ? b.completed_assignments / b.total_assignments : Infinity;
        return aRatio - bRatio;
      });
  }, [data, filterState.filterState]);

  return (
    <div className="flex flex-col gap-3">
      <SmartFilterBar fieldDefs={fieldDefs} state={filterState} />
      {isLoading && <p className="text-sm text-text-muted dark:text-text-muted">Loading…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-text-muted dark:text-text-muted">No pods match these filters.</p>
      )}
      <div className="flex flex-col gap-2">
        {rows.map((pod) => {
          const mentorId = mentorByPod.get(pod.pod_id);
          return (
            <CompletionRow
              key={pod.pod_id}
              name={pod.pod_name}
              subtitle={`${pod.mentor_count} mentors · ${pod.mentee_count} mentees`}
              completed={pod.completed_assignments}
              total={pod.total_assignments}
              escalationCount={pod.open_escalations}
              href={mentorId ? `/admin?id=${mentorId}` : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}