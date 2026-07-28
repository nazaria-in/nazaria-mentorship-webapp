// /components/assignments/AssignmentCompletionStatus.tsx

"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchMenteeAssignmentStatus } from "@/lib/api/assignment-status";
import type { MenteeAssignmentCompletionStatus } from "@/lib/api/assignment-status";

export interface AssignmentCompletionStatusProps {
  menteeAssignmentId: string;
  className?: string;
}

const STATUS_CONFIG: Record<
  MenteeAssignmentCompletionStatus,
  { label: string; icon: typeof CheckCircle2; classes: string }
> = {
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    classes:
      "border-border-strong bg-card-strong text-text-primary dark:border-border-strong dark:bg-card-strong dark:text-text-primary",
  },
  pending_review: {
    label: "Pending review",
    icon: Clock,
    classes:
      "border-border bg-card-alt text-text-accent dark:border-border dark:bg-card-alt dark:text-text-accent",
  },
  not_started: {
    label: "Not started",
    icon: Circle,
    classes:
      "border-border bg-card text-text-primary/60 dark:border-border dark:bg-card dark:text-text-primary/60",
  },
};

/**
 * Read-only. Completion is derived entirely from v_mentee_assignment_status
 * (every slot's latest submission is approved) — there is no button here on
 * purpose. A mentor reviewing the last pending slot and marking it approved
 * *is* the completion action; adding a second manual step just creates a
 * second, disagreeable source of truth.
 */
export function AssignmentCompletionStatus({
  menteeAssignmentId,
  className,
}: AssignmentCompletionStatusProps): React.JSX.Element | null {
  const { data: status, isLoading } = useQuery({
    queryKey: ["mentee-assignment-status", menteeAssignmentId],
    queryFn: () => fetchMenteeAssignmentStatus(menteeAssignmentId),
    enabled: !!menteeAssignmentId,
  });

  if (isLoading || !status) return null;

  const config = STATUS_CONFIG[status.completionStatus];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium",
        config.classes,
        className
      )}
    >
      <Icon size={16} />
      {config.label}
      {status.completionStatus !== "not_started" && status.totalSlots > 0 && (
        <span className="text-xs font-normal text-text-primary/50 dark:text-text-primary/40">
          {status.approvedSlots}/{status.totalSlots}
        </span>
      )}
    </span>
  );
}