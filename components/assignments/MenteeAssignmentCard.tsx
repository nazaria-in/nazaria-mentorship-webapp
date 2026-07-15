// /components/assignments/MenteeAssignmentCard.tsx

"use client";

import { AssignmentCard } from "@/components/assignments/AssignmentCard";
import { cn } from "@/lib/utils";
import type { Assignment } from "@/types/assignments";

export interface MenteeAssignmentCardMentee {
  id: string;
  full_name: string;
  pod_name?: string;
}

export interface MenteeAssignmentCardProgress {
  totalSlots: number;
  submittedSlots: number;
  pendingReviewCount: number;
  revisionRequestedCount: number;
}

export interface MenteeAssignmentCardProps {
  assignment: Assignment;
  mentee: MenteeAssignmentCardMentee;
  progress: MenteeAssignmentCardProgress;
  /** Default: navigates to `href`, same as a plain AssignmentCard.
   *  Pass a function to drive a local view instead (e.g. an in-page
   *  mentee drill-down) — this is forwarded straight to AssignmentCard,
   *  which is the thing that actually renders the assignment. */
  href?: string;
  onViewDetails?: () => void;
  className?: string;
}

/**
 * Wraps AssignmentCard for staff-facing "mentees for this assignment"
 * grids. AssignmentCard itself still owns the assignment title, dates,
 * status, and description — this component adds what's specific to "this
 * mentee's copy of the assignment": their name/pod and a pending-review
 * indicator.
 *
 * The outer div carries its own border + card-alt background so the
 * mentee-name header and the assignment card read as one unit instead of
 * a floating label sitting above an unrelated box. card-alt (one step up
 * from the AssignmentCard's own bg-surface) keeps the nesting visible —
 * see the tonal-ladder note in globals.css.
 */
export function MenteeAssignmentCard({
  assignment,
  mentee,
  progress,
  href,
  onViewDetails,
  className,
}: MenteeAssignmentCardProps) {
  const pendingCount = progress.pendingReviewCount;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-border bg-card-alt p-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
            {initials(mentee.full_name)}
          </span>
          <span className="truncate text-sm font-medium text-text-primary">{mentee.full_name}</span>
          {mentee.pod_name && (
            <span className="shrink-0 truncate text-[11px] text-text-primary/50">· {mentee.pod_name}</span>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
            pendingCount > 0 ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"
          )}
        >
          {pendingCount > 0 ? `${pendingCount} to review` : "All reviewed"}
        </span>
      </div>

      <AssignmentCard
        assignment={assignment}
        href={href ?? `/assignments/${assignment.id}`}
        onViewDetails={onViewDetails}
        menteeProgress={{
          totalSlots: progress.totalSlots,
          submittedSlots: progress.submittedSlots,
          pendingReviewCount: progress.pendingReviewCount,
          revisionRequestedCount: progress.revisionRequestedCount,
        }}      />
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}