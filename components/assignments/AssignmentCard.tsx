// /components/assignments/AssignmentCard.tsx

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Assignment } from "@/types/assignments";
import { useRole } from "@/providers/role-provider";
import { usePathname } from "next/navigation";

export interface AssignmentCardProps {
  assignment: Assignment;
  href: string; // /cohorts/[cohortId]/assignments/[assignmentId]
  /** Mentee-only: drives the "X to review" / "Not started" framing.
   * Omit for mentor/staff cards, which don't have a single personal state. */
  menteeProgress?: {
    totalSlots: number;
    submittedSlots: number;
    pendingReviewCount: number;
    revisionRequestedCount: number;
  };
  /** Optional callback to intercept and override default link navigation
   * and drive inline/local UI logic instead (e.g. drilling down in-page). */
  onViewDetails?: () => void;
  className?: string;

}

type AssignmentStatus = "upcoming" | "ongoing" | "overdue" | "completed";

function getStatus(a: Assignment): AssignmentStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (a.start_date > today) return "upcoming";
  if (a.end_date && a.end_date < today) return "overdue";
  if (a.end_date && !a.is_active) return "completed";
  return "ongoing";
}

const STATUS_ACCENT: Record<AssignmentStatus, string> = {
  upcoming: "border-l-text-primary/25",
  ongoing: "border-l-primary",
  overdue: "border-l-destructive",
  completed: "border-l-secondary",
};

const STATUS_DOT: Record<AssignmentStatus, string> = {
  upcoming: "bg-text-primary/30",
  ongoing: "bg-primary",
  overdue: "bg-destructive",
  completed: "bg-secondary-foreground/50",
};

const STATUS_LABEL: Record<AssignmentStatus, string> = {
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  overdue: "Overdue",
  completed: "Completed",
};

export function AssignmentCard({
  assignment,
  href,
  menteeProgress,
  onViewDetails,
  className
}: AssignmentCardProps) {
  const status = getStatus(assignment);
  const dueLabel = getDueLabel(assignment, status);
  const rolecontext = useRole();
  const isMentor = rolecontext.role === "mentor";
  const isMentee = rolecontext.role === "mentee";



  const pathname = usePathname();

  const showBadge =
    isMentee || !pathname.endsWith("/assignments")


  let badge = "Not submitted";

  if (menteeProgress) {
    if (menteeProgress.pendingReviewCount > 0) {
      badge = "Awaiting review";
    } else if (menteeProgress.revisionRequestedCount > 0) {
      badge = "Revision requested";
    } else if (menteeProgress.submittedSlots > 0) {
      badge = "Reviewed";
    }
  }

  // Common CSS styling applied regardless of wrapper type
  const sharedClasses = cn(
    "group flex w-full text-left flex-col gap-2.5 rounded-2xl border border-border border-l-[3px] bg-surface p-4 transition-colors",
    "hover:bg-surface-muted/60 dark:hover:bg-white/5",
    STATUS_ACCENT[status],
    className
  );

  const innerContent = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-sm font-semibold leading-snug text-text-primary">{assignment.title}</h3>
        <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-text-primary/50">
          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
          {STATUS_LABEL[status]}
        </span>
      </div>

      {/* min-h reserves 2 lines of space regardless of actual line count */}
      <p className="line-clamp-2 min-h-[2.25rem] text-xs leading-[1.125rem] text-text-primary/60">
        {assignment.description}
      </p>
          <span className={cn("text-xs font-medium", status === "overdue" ? "text-destructive" : "text-text-primary")}>
            {dueLabel}
          </span>

      <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2.5">

      {showBadge && (
        <div className="flex flex-col gap-0.5">
          <span
            className={cn(
              "rounded-sm py-1 px-2",
              badge === "Awaiting review" && "bg-red-200 text-red-900",
              badge === "Revision requested" && "bg-yellow-200 text-yellow-900",
              badge === "Reviewed" && "bg-green-200 text-green-900",
              badge === "Not submitted" && "bg-gray-200 text-gray-900",
            )}
          >
            {badge}
          </span>
        </div>
      )}

        

        {/* Uses text-accent/surface-muted (brand tokens) instead of hardcoded
            cyan, and drops the nonexistent text-text-black class — that class
            has no matching CSS var, so it was rendering with no color at all. */}
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-sm py-1 px-2 text-sm font-medium",
            "text-text-accent text-[14px] text-black opacity-0 transition-all duration-200",
            "group-hover:opacity-100 group-hover:bg-cyan-200",
            "hover:bg-cyan-300"
          )}
        >
          {ctaLabel(status, isMentor, menteeProgress)}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </>
  );

  // Default: Use Link if there's no custom local click event handler
  if (!onViewDetails) {
    return (
      <Link href={href} className={sharedClasses}>
        {innerContent}
      </Link>
    );
  }

  // Override: Use interactive button if onViewDetails is passed
  return (
    <button type="button" onClick={onViewDetails} className={sharedClasses}>
      {innerContent}
    </button>
  );
}

function getDueLabel(a: Assignment, status: AssignmentStatus): string {
  if (status === "upcoming") return `Starts ${formatDate(a.start_date)}`;
  if (!a.end_date) return "No due date";

  const daysLeft = Math.ceil((new Date(a.end_date).getTime() - Date.now()) / 86_400_000);
  if (status === "overdue") return `Overdue by ${Math.abs(daysLeft)}d`;
  if (daysLeft === 0) return "Due today";
  if (daysLeft === 1) return "Due tomorrow";
  return `Due in ${daysLeft} days`;
}

function ctaLabel(status: AssignmentStatus, isMentor: boolean, menteeProgress?: AssignmentCardProps["menteeProgress"]): string {
  // If there is no mentee progress tracker (i.e., staff/mentor view), always say "View details"
  if (!menteeProgress || isMentor) {
    return "View details";
  }

  // If it is a mentee, show "Submit work" only if they have slots remaining to submit
  if (menteeProgress.submittedSlots < menteeProgress.totalSlots) {
    return "Submit work";
  }

  return "View details";
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}