// /components/resources/ResourceCard.tsx

"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Compass, ExternalLink, FileText, Pencil, Trash2, Video, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { WarningModal } from "@/components/shared/WarningModal";
import type { Resource, ResourceCourseType, ResourceStatus } from "@/types/resources";

export interface ResourceCardProps {
  resource: Resource;
  href: string;
  /** Shown when a mentor/staff viewer sees resources across multiple mentees. */
  assigneeName?: string | null;
  onViewDetails?: () => void;
  onEdit?: () => void;
  onDelete?: () => Promise<void> | void;
  className?: string;
}

const TYPE_ICON: Record<ResourceCourseType, React.ComponentType<{ className?: string }>> = {
  handbook: BookOpen,
  toolkit: Wrench,
  template: FileText,
  video: Video,
  guide: Compass,
  external_course: ExternalLink,
};

const TYPE_LABEL: Record<ResourceCourseType, string> = {
  handbook: "Handbook",
  toolkit: "Toolkit",
  template: "Template",
  video: "Video",
  guide: "Guide",
  external_course: "External course",
};

const STATUS_ACCENT: Record<ResourceStatus, string> = {
  ongoing: "border-l-primary",
  paused: "border-l-yellow-500",
  completed: "border-l-secondary",
  abandoned: "border-l-destructive/60",
};

const STATUS_DOT: Record<ResourceStatus, string> = {
  ongoing: "bg-primary",
  paused: "bg-yellow-500",
  completed: "bg-secondary-foreground/50",
  abandoned: "bg-destructive/60",
};

const STATUS_LABEL: Record<ResourceStatus, string> = {
  ongoing: "Ongoing",
  paused: "Paused",
  completed: "Completed",
  abandoned: "Abandoned",
};

export function ResourceCard({ resource, href, assigneeName, onViewDetails, onEdit, onDelete, className }: ResourceCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const type = resource.type ?? "guide";
  const TypeIcon = TYPE_ICON[type];

  async function handleConfirmDelete() {
    if (!onDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDelete();
      setShowDeleteConfirm(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete this resource. Try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2.5 rounded-2xl border border-border border-l-[3px] bg-surface p-4 transition-colors",
        STATUS_ACCENT[resource.status],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-primary/50">
          <TypeIcon className="h-3.5 w-3.5" />
          {TYPE_LABEL[type]}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-text-primary/50">
          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[resource.status])} />
          {STATUS_LABEL[resource.status]}
        </span>
      </div>

      <h3 className="font-heading text-sm font-semibold leading-snug text-text-primary">{resource.title}</h3>
      <p className="line-clamp-2 min-h-[2.25rem] text-xs leading-[1.125rem] text-text-primary/60">{resource.description}</p>

      <div className="flex items-center gap-2 text-[11px] text-text-primary/50">
        {resource.week_number !== null && <span>Week {resource.week_number}</span>}
        {assigneeName && (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">{assigneeName}</span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        <span />
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit resource"
              className="rounded-full p-1.5 text-text-primary/50 transition-colors hover:bg-surface-muted hover:text-text-primary dark:hover:bg-white/10"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Delete resource"
              className="rounded-full p-1.5 text-text-primary/50 transition-colors hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          {onViewDetails ? (
            <button
              type="button"
              onClick={onViewDetails}
              className="group inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[14px] font-medium text-text-accent transition-colors hover:bg-cyan-200 dark:hover:bg-cyan-900/30"
            >
              View details
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <Link
              href={href}
              className="group inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[14px] font-medium text-text-accent transition-colors hover:bg-cyan-200 dark:hover:bg-cyan-900/30"
            >
              View details
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>

      <WarningModal
        open={showDeleteConfirm}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteConfirm(false);
            setDeleteError(null);
          }
        }}
        title="Delete this resource?"
        description={`"${resource.title}" will be hidden immediately (soft delete). Its progress updates stay in the database.`}
        variant="danger"
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        isLoading={isDeleting}
        errorMessage={deleteError}
      />
    </div>
  );
}