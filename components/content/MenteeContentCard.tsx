// /components/content/MenteeContentCard.tsx

"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, ClipboardList, Clock, FileBox, RotateCcw } from "lucide-react";
import type { CompletionStatus, MenteeContentDispatch } from "@/types/content";

const TYPE_ICON = { assignment: ClipboardList, course: BookOpen, resource: FileBox } as const;

const STATUS_META: Record<CompletionStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-primary/10 text-text-accent dark:bg-primary/15 dark:text-text-accent",
  },
  approved_awaiting_completion: {
    label: "Approved",
    icon: CheckCircle2,
    className: "bg-primary/10 text-text-accent dark:bg-primary/15 dark:text-text-accent",
  },
  pending_review: {
    label: "Waiting on review",
    icon: Clock,
    className: "bg-card-alt text-text-muted dark:bg-card-alt dark:text-text-muted",
  },
  needs_revision: {
    label: "Needs revision",
    icon: RotateCcw,
    className: "bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive",
  },
  not_started: {
    label: "To do",
    icon: Clock,
    className: "bg-card-alt text-text-muted dark:bg-card-alt dark:text-text-muted",
  },
};

interface MenteeContentCardProps {
  dispatch: MenteeContentDispatch;
  href: string;
}

export function MenteeContentCard({ dispatch, href }: MenteeContentCardProps) {
  const item = dispatch.content_item;
  const Icon = TYPE_ICON[item.content_type];
  const status = STATUS_META[dispatch.completion_status];
  const StatusIcon = status.icon;

  return (
    <Link href={href} className="surface-card flex flex-col gap-3 dark:surface-card">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-base font-medium leading-snug text-text-primary dark:text-text-primary">
          {item.title}
        </h3>
        {item.week && (
          <p className="text-xs text-text-muted dark:text-text-muted">{item.week.name}</p>
        )}
      </div>

      {dispatch.due_at && dispatch.completion_status !== "completed" && (
        <p className="text-xs text-text-muted dark:text-text-muted">
          Due {new Date(dispatch.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
      )}
    </Link>
  );
}