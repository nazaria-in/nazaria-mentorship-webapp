// /components/assignments/SubmissionSlot.tsx

"use client";

import * as React from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddSubmissionForm } from "@/components/assignments/AddSubmissionForm";
import { SubmissionReviewForm } from "@/components/assignments/SubmissionReviewForm";
import type {
  AssignmentDetailsMode,
  AssignmentSubmissionSlot,
  SlotWithSubmissions,
  SubmissionStatus,
} from "@/types/assignments";

export interface SubmissionSlotProps {
  slot: AssignmentSubmissionSlot;
  versions: SlotWithSubmissions["versions"];
  mode: AssignmentDetailsMode;
  menteeAssignmentId: string;
  reviewerId?: string;
  onChanged: () => void;
}

const SUBMISSION_STATUS_STYLE: Record<SubmissionStatus, string> = {
  pending_review: "bg-primary/10 text-text-accent",
  revision_requested: "bg-destructive/10 text-destructive",
  approved: "bg-secondary text-secondary-foreground",
};

const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending_review: "Pending review",
  revision_requested: "Revision requested",
  approved: "Approved",
};

export function SubmissionSlot({ slot, versions, mode, menteeAssignmentId, reviewerId, onChanged }: SubmissionSlotProps) {
  const atMaxVersions = versions.length >= slot.max_versions;
  const hasPending = versions.some((v) => v.status === "pending_review");

  // Mentees always land with their own submit panel open. Reviewers get
  // slots with something pending review pre-opened; everything else starts
  // collapsed — this is what stops the review page turning into one long
  // vertical scroll on wide/laptop screens.
  const [open, setOpen] = React.useState(mode === "submit" || hasPending);

  return (
    <div className="flex h-fit flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-text-primary">{slot.title}</h3>
          {hasPending && (
            <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
              Pending
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-text-primary/50">
            {versions.length} / {slot.max_versions} versions
          </span>
          <ChevronDown className={cn("h-4 w-4 text-text-primary/50 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-border/60 px-4 pb-4 pt-3">
          {versions.length === 0 ? (
            <p className="text-xs text-text-primary/50">No submissions yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {versions.map((v) => (
                <li key={v.id} className="rounded-xl border border-border bg-card-alt p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-text-primary">v{v.version_number}</span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", SUBMISSION_STATUS_STYLE[v.status])}>
                      {SUBMISSION_STATUS_LABEL[v.status]}
                    </span>
                  </div>

                  {v.file?.url && (
                    <a
                      href={v.file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-accent transition-colors hover:bg-surface-muted"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{v.file.title ?? v.file.url}</span>
                    </a>
                  )}

                  {v.feedback && (
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface p-2 text-xs text-text-primary/80">{v.feedback}</p>
                  )}

                  {/* Renders whenever this slot was given a reviewerId and the
                      latest version is still awaiting a decision. MenteeAssignmentGrid
                      only passes reviewerId when canReview is true, so associates/PMs
                      see this section read-only while mentors get the form. */}
                  {mode === "review" && v.status === "pending_review" && reviewerId && (
                    <SubmissionReviewForm submissionId={v.id} reviewerId={reviewerId} onReviewed={onChanged} />
                  )}
                </li>
              ))}
            </ul>
          )}

          {mode === "submit" &&
            (atMaxVersions ? (
              <p className="text-xs text-text-primary/50">Maximum versions reached for this slot.</p>
            ) : (
              <AddSubmissionForm
                slotId={slot.id}
                menteeAssignmentId={menteeAssignmentId}
                nextVersionNumber={versions.length + 1}
                onSubmitted={onChanged}
              />
            ))}
        </div>
      )}
    </div>
  );
}