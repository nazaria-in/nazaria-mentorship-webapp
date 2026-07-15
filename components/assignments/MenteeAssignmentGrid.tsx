// /components/assignments/MenteeAssignmentGrid.tsx

"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMenteeAssignmentSummaries } from "@/lib/api/mentee-assignments";
import { SmartFilterBar } from "@/components/filters/SmartFilterBar";
import { useFilterState } from "@/hooks/use-filter-state";
import { applyComputedFilters } from "@/lib/filtering/apply-filters";
import { SlotSubmissionsPanel } from "@/components/assignments/SlotSubmissionsPanel";
import { MenteeAssignmentCard } from "@/components/assignments/MenteeAssignmentCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import type { FilterFieldDef, DateRangeValue } from "@/lib/filtering/types";
import type { AssignmentWithSlots, MenteeAssignmentSummary } from "@/types/assignments";

export interface MenteeAssignmentGridProps {
  assignment: AssignmentWithSlots;
  viewerId: string;
  canReview: boolean;
}

/**
 * fetchMenteeAssignmentSummaries returns a hand-aggregated array (three
 * parallel queries grouped in JS, see lib/api/mentee-assignments.ts) — not
 * a live Supabase query builder — so applyFilters() (which emits .eq()/
 * .in()/.gte() etc.) cannot run against it. Everything here is therefore
 * either `computed` (resolver runs on the fetched array) or matched
 * manually in `visibleSummaries` below. If this list ever needs
 * server-side pagination, back it with a view (like v_mentee_assignment_status)
 * and switch these to real enum/dateRange fields queried against that view.
 */

const FIELD_DEFS: FilterFieldDef[] = [
  {
    key: "search",
    kind: "text",
    columns: [], // unused — search matches mentee.full_name manually below, not via .ilike()
    searchable: true,
  },
  {
    key: "status",
    kind: "computed",
    label: "Status",
    options: [
      { value: "needs_review", label: "Needs review" }, // covers both pending_review AND revision_requested — mentor needs to look at it either way
      { value: "not_submitted", label: "Not submitted" },
      { value: "fully_submitted", label: "Fully submitted" },
    ],
    resolver: (rows, selected, excluded) => {
      const typed = rows as MenteeAssignmentSummary[];

      const statusesFor = (s: MenteeAssignmentSummary): string[] => {
        const out: string[] = [];
        if (s.pendingReviewCount > 0 || s.revisionRequestedCount > 0) out.push("needs_review");
        if (s.submittedCount === 0) out.push("not_submitted");
        if (s.totalSlots > 0 && s.submittedCount === s.totalSlots) out.push("fully_submitted");
        return out;
      };

      return typed.filter((s) => {
        const statuses = statusesFor(s);
        if (excluded.length > 0 && statuses.some((st) => excluded.includes(st))) return false;
        if (selected.length > 0 && !statuses.some((st) => selected.includes(st))) return false;
        return true;
      });
    },
  },
  {
    key: "dueAt",
    kind: "dateRange",
    label: "Due date",
    column: "due_at", // not queried directly — read manually below; kept so DateRangePicker/SortDropdown render
    sortable: true,
    defaultSort: "asc",
  },
];

export function MenteeAssignmentGrid({ assignment, viewerId, canReview }: MenteeAssignmentGridProps) {
  const filterBarState = useFilterState(FIELD_DEFS, "mentee-assignment-grid");
  const { filterState, sortState } = filterBarState;
  const [selectedSummary, setSelectedSummary] = React.useState<MenteeAssignmentSummary | null>(null);

  const { data: summaries, isLoading } = useQuery({
    queryKey: ["mentee-assignment-summaries", assignment.id],
    queryFn: () => fetchMenteeAssignmentSummaries(assignment.id),
  });

  const visibleSummaries = React.useMemo(() => {
    if (!summaries) return [];

    let result = summaries;

    const term = filterState.search.trim().toLowerCase();
    if (term) {
      result = result.filter((s) => s.mentee.full_name.toLowerCase().includes(term));
    }

    result = applyComputedFilters(result, FIELD_DEFS, filterState);

    const dueRange = filterState.values.dueAt as DateRangeValue | undefined;
    if (dueRange?.from) {
      const from = dueRange.from;
      result = result.filter((s) => s.dueAt.slice(0, 10) >= from);
    }
    if (dueRange?.to) {
      const to = dueRange.to;
      result = result.filter((s) => s.dueAt.slice(0, 10) <= to);
    }

    if (sortState.key === "dueAt") {
      const dir = sortState.direction === "asc" ? 1 : -1;
      result = [...result].sort((a, b) => (a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0) * dir);
    }

    return result;
  }, [summaries, filterState, sortState]);

  if (selectedSummary) {
    return (
      <div className="mx-auto flex w-full flex-col gap-4">
        <button
          type="button"
          onClick={() => setSelectedSummary(null)}
          className="self-start text-xs font-medium text-text-accent hover:underline"
        >
          ← Back to all mentees
        </button>

        <div className="surface-card-strong flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-text-primary">{selectedSummary.mentee.full_name}</span>
            {selectedSummary.mentee.pod_name && (
              <span className="text-xs text-text-primary/50">{selectedSummary.mentee.pod_name}</span>
            )}
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
              selectedSummary.pendingReviewCount > 0
                ? "bg-destructive/10 text-destructive dark:bg-destructive/20"
                : "bg-secondary text-secondary-foreground"
            )}
          >
            {selectedSummary.pendingReviewCount > 0
              ? `${selectedSummary.pendingReviewCount} to review`
              : "All reviewed"}
          </span>
        </div>

        <SlotSubmissionsPanel
          assignmentId={assignment.id}
          menteeAssignmentId={selectedSummary.menteeAssignmentId}
          mode="review"
          reviewerId={canReview ? viewerId : undefined}
          slotsFromParent={assignment.slots}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SmartFilterBar fieldDefs={FIELD_DEFS} state={filterBarState} />

      {isLoading ? (
        <div className="text-sm text-text-primary/50">Loading mentees…</div>
      ) : visibleSummaries.length === 0 ? (
        <EmptyState title="No Mentee's Assignments Match" description="Try clearing filters." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visibleSummaries.map((s) => (
            <MenteeAssignmentCard
              key={s.menteeAssignmentId}
              assignment={assignment}
              mentee={s.mentee}
              progress={{
                totalSlots: s.totalSlots,
                submittedSlots: s.submittedCount,
                pendingReviewCount: s.pendingReviewCount,
                revisionRequestedCount: s.revisionRequestedCount,
              }}
              onViewDetails={() => setSelectedSummary(s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}