// /components/assignments/MenteeAssignmentGrid.tsx

"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMenteeAssignmentSummaries } from "@/lib/api/mentee-assignments";
import { FilterBar, type FilterDef, type FilterValue } from "@/components/filters/FilterBar";
import { SlotSubmissionsPanel } from "@/components/assignments/SlotSubmissionsPanel";
import { MenteeAssignmentCard } from "@/components/assignments/MenteeAssignmentCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import type { AssignmentWithSlots, MenteeAssignmentSummary } from "@/types/assignments";

export interface MenteeAssignmentGridProps {
  assignment: AssignmentWithSlots;
  viewerId: string;
  /** Only mentors get the review form. Associates/PMs (permissionLevel
   *  "staff" but role !== "mentor") see the same submissions read-only —
   *  enforced by only handing reviewerId to SlotSubmissionsPanel when true. */
  canReview: boolean;
}

const FILTER_DEFS: FilterDef[] = [
  {
    key: "status",
    label: "Status",
    type: "enum",
    options: [{ value: "unreviewed", label: "Has unreviewed" }],
  },
];

export function MenteeAssignmentGrid({ assignment, viewerId, canReview }: MenteeAssignmentGridProps) {
  const [values, setValues] = React.useState<Record<string, FilterValue>>({});
  const [selectedSummary, setSelectedSummary] = React.useState<MenteeAssignmentSummary | null>(null);

  const onlyUnreviewed = (values.status as Record<string, string>)?.unreviewed === "selected";

  const { data: summaries, isLoading } = useQuery({
    queryKey: ["mentee-assignment-summaries", assignment.id, onlyUnreviewed],
    queryFn: () => fetchMenteeAssignmentSummaries(assignment.id, { onlyUnreviewed }),
  });

  if (selectedSummary) {
    return (
      // max-w wrapper keeps the two-column slot grid (see SlotSubmissionsPanel)
      // from stretching edge-to-edge and looking sparse/ugly on laptop-width screens.
      <div className="mx-auto flex w-full  flex-col gap-4">
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
                ? "bg-destructive/10 text-destructive"
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
      <FilterBar
        defs={FILTER_DEFS}
        values={values}
        onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
        onClearAll={() => setValues({})}
      />

      {isLoading ? (
        <div className="text-sm text-text-primary/50">Loading mentees…</div>
      ) : !summaries || summaries.length === 0 ? (
        <EmptyState title="No mentees match" description="Try clearing filters." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {summaries.map((s) => (
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