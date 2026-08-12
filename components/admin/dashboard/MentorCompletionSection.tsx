// components/admin/dashboard/MentorCompletionSection.tsx
"use client";

import { useMemo } from "react";
import { CompletionRow } from "@/components/admin/dashboard/CompletionRow";
import { useFilterState } from "@/hooks/use-filter-state";
import { SmartFilterBar } from "@/components/filters/SmartFilterBar";
import type { MentorStats } from "@/types/admin";
import type { FilterFieldDef } from "@/lib/filtering/types";

// Search-only — MentorStats carries no cohort_id (no join in v_mentor_stats),
// so a cohort filter isn't possible without extending that view. Flagging
// rather than adding a filter that would silently do nothing.
const FIELD_DEFS: FilterFieldDef[] = [
  { key: "search", kind: "text", columns: ["mentor_name"], searchable: true },
];

export function MentorCompletionSection({ data, isLoading }: { data: MentorStats[]; isLoading: boolean }) {
  const filterState = useFilterState(FIELD_DEFS, "dashboard-mentor-completion");

  const rows = useMemo(() => {
    const search = filterState.filterState.search?.trim().toLowerCase();
    return data
      .filter((r) => (search ? (r.mentor_name ?? "").toLowerCase().includes(search) : true))
      .sort((a, b) =>
        (a.mentor_name ?? "").localeCompare(b.mentor_name ?? "", undefined, { numeric: true, sensitivity: "base" })
      );
  }, [data, filterState.filterState]);

  return (
    <div className="flex flex-col gap-3">
      <SmartFilterBar fieldDefs={FIELD_DEFS} state={filterState} />
      {isLoading && <p className="text-sm bg-gray-100 rounded-xl p-4 text-text-muted dark:text-text-muted">Loading…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-text-muted dark:text-text-muted">No mentors match this search.</p>
      )}
      <div className="flex flex-col gap-2">
        {rows.map((mentor) => (
          <CompletionRow
            key={mentor.mentor_id}
            name={mentor.mentor_name ?? "Unknown"}
            subtitle={`${mentor.mentee_count} mentees`}
            completed={mentor.completed_assignments}
            total={mentor.total_assignments}
            escalationCount={mentor.open_escalations_among_mentees}
            href={`/admin?id=${mentor.mentor_id}`}
          />
        ))}
      </div>
    </div>
  );
}