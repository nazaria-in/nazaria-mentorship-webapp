// components/assignments/SlotSubmissionsPanel.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSlotSubmissions } from "@/lib/api/mentee-assignments";
import { SubmissionSlot } from "@/components/assignments/SubmissionSlot";
import type { AssignmentDetailsMode, AssignmentSubmissionSlot } from "@/types/assignments";

export interface SlotSubmissionsPanelProps {
  assignmentId: string;
  menteeAssignmentId: string;
  mode: AssignmentDetailsMode; // "submit" = mentee's own view, "review" = mentor/staff view
  reviewerId?: string; // required when mode === "review"
  slotsFromParent?: AssignmentSubmissionSlot[]; // avoids refetching slots if the caller already has them
}

export function SlotSubmissionsPanel({
  assignmentId,
  menteeAssignmentId,
  mode,
  reviewerId,
  slotsFromParent,
}: SlotSubmissionsPanelProps) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["slot-submissions", assignmentId, menteeAssignmentId],
    queryFn: () => fetchSlotSubmissions(assignmentId, menteeAssignmentId),
  });

  if (isLoading) {
    return <div className="text-sm text-text-primary/50">Loading submissions…</div>;
  }

  const slotEntries = data ?? (slotsFromParent ?? []).map((slot) => ({ slot, versions: [] }));

  // Each slot is independently collapsible (see SubmissionSlot), and on wide
  // screens this now lays out as two columns instead of one long vertical
  // stack — that vertical stack was the "way too long on laptops" complaint.
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      {slotEntries.map(({ slot, versions }) => (
        <SubmissionSlot
          key={slot.id}
          slot={slot}
          versions={versions}
          mode={mode}
          menteeAssignmentId={menteeAssignmentId}
          reviewerId={reviewerId}
          onChanged={refetch}
        />
      ))}
    </div>
  );
}