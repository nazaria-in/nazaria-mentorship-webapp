// /components/assignments/AssignmentCard.tsx

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/providers/role-provider";
import { WarningModal } from "@/components/shared/WarningModal";
import type { Assignment } from "@/types/assignments";

export interface AssignmentCardProps {
  assignment: Assignment;
  href: string;
  menteeProgress?: {
    totalSlots: number;
    submittedSlots: number;
    pendingReviewCount: number;
    revisionRequestedCount: number;
  };
  onViewDetails?: () => void;
  /** Opens the edit form (AssignmentFormModal, mode="edit"). Only rendered for mentor/staff when provided. */
  onEdit?: () => void;
  /** Performs the actual delete + refetch, called after the in-card warning is confirmed. Only rendered for mentor/staff when provided. */
  onDelete?: () => Promise<void> | void;
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

export function AssignmentCard({ assignment, href, menteeProgress, onViewDetails, onEdit, onDelete, className }: AssignmentCardProps) {
  const status = getStatus(assignment);
  const dueLabel = getDueLabel(assignment, status);
  const { role, permissionLevel } = useRole();
  const isMentor = role === "mentor";
  const isMentee = role === "mentee";
  const canManage = (permissionLevel === "mentor" || permissionLevel === "staff") && (!!onEdit || !!onDelete);

  const pathname = usePathname();
  const showBadge = isMentee || !pathname.endsWith("/assignments");

  const today = new Date().toISOString().slice(0, 10);
  const hasStarted = assignment.start_date <= today;

  const [showEditLockedNotice, setShowEditLockedNotice] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  function handleEditClick() {
    if (hasStarted) {
      setShowEditLockedNotice(true);
      return;
    }
    onEdit?.();
  }

  async function handleConfirmDelete() {
    if (!onDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDelete();
      setShowDeleteConfirm(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete this assignment. Try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  let badge = "Not submitted";
  if (menteeProgress) {
    if (menteeProgress.pendingReviewCount > 0) badge = "Awaiting review";
    else if (menteeProgress.revisionRequestedCount > 0) badge = "Revision requested";
    else if (menteeProgress.submittedSlots > 0) badge = "Reviewed";
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2.5 rounded-2xl border border-border border-l-[3px] bg-surface p-4 transition-colors",
        STATUS_ACCENT[status],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-sm font-semibold leading-snug text-text-primary">{assignment.title}</h3>
        <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-text-primary/50">
          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
          {STATUS_LABEL[status]}
        </span>
      </div>

      <p className="line-clamp-2 min-h-[2.25rem] text-xs leading-[1.125rem] text-text-primary/60">{assignment.description}</p>
      <span className={cn("text-xs font-medium", status === "overdue" ? "text-destructive" : "text-text-primary")}>{dueLabel}</span>

      <div className="mt-1 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        {showBadge ? (
          <span
            className={cn(
              "rounded-sm px-2 py-1",
              badge === "Awaiting review" && "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200",
              badge === "Revision requested" && "bg-yellow-200 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200",
              badge === "Reviewed" && "bg-green-200 text-green-900 dark:bg-green-900/40 dark:text-green-200",
              badge === "Not submitted" && "bg-gray-200 text-gray-900 dark:bg-white/10 dark:text-text-primary/70"
            )}
          >
            {badge}
          </span>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-1">
          {canManage && onEdit && (
            <button
              type="button"
              onClick={handleEditClick}
              aria-label="Edit assignment"
              className="rounded-full p-1.5 text-text-primary/50 transition-colors hover:bg-surface-muted hover:text-text-primary dark:hover:bg-white/10"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {canManage && onDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Delete assignment"
              className="rounded-full p-1.5 text-text-primary/50 transition-colors hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <ViewDetailsCta href={href} onViewDetails={onViewDetails} status={status} isMentor={isMentor} menteeProgress={menteeProgress} />
        </div>
      </div>

      <WarningModal
        open={showEditLockedNotice}
        onClose={() => setShowEditLockedNotice(false)}
        title="This assignment has already started"
        description="The title, dates, and submission slots are locked once an assignment starts. You'll still be able to add or remove mentees."
        variant="warning"
        onConfirm={() => {
          setShowEditLockedNotice(false);
          onEdit?.();
        }}
        confirmLabel="Continue to edit"
      />

      <WarningModal
        open={showDeleteConfirm}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteConfirm(false);
            setDeleteError(null);
          }
        }}
        title="Delete this assignment?"
        description={`"${assignment.title}" will be hidden from everyone immediately (soft delete). Its submission slots and mentee assignment records stay in the database rather than being removed.`}
        variant="danger"
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        isLoading={isDeleting}
        errorMessage={deleteError}
      />
    </div>
  );
}

function ViewDetailsCta({
  href,
  onViewDetails,
  status,
  isMentor,
  menteeProgress,
}: {
  href: string;
  onViewDetails?: () => void;
  status: AssignmentStatus;
  isMentor: boolean;
  menteeProgress?: AssignmentCardProps["menteeProgress"];
}) {
  const label = ctaLabel(status, isMentor, menteeProgress);
  const classes = "group inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[14px] font-medium text-text-accent transition-colors hover:bg-cyan-200 dark:hover:bg-cyan-900/30";

  if (!onViewDetails) {
    return (
      <Link href={href} className={classes}>
        {label}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onViewDetails} className={classes}>
      {label}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
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
  if (!menteeProgress || isMentor) return "View details";
  if (menteeProgress.submittedSlots < menteeProgress.totalSlots) return "Submit work";
  return "View details";
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}