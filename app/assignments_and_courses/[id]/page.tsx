// /app/assignments_and_courses/[id]/page.tsx

"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileBox,
  Link2,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";
import { EmptyState } from "@/components/shared/EmptyState";
import { fetchContentItem } from "@/lib/api/content-items";
import {
  fetchDispatchesForContentItem,
  markDispatchComplete,
  unmarkDispatchComplete,
  type DispatchRosterRow,
} from "@/lib/api/content-dispatches";
import { fetchLatestSubmission, reviewSubmission } from "@/lib/api/content-submissions";
import type { CompletionStatus, ContentItemWithMeta, ContentSubmission } from "@/types/content";

const TYPE_ICON = { assignment: ClipboardList, course: BookOpen, resource: FileBox } as const;

const STATUS_META: Record<CompletionStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  completed: { label: "Completed", icon: CheckCircle2, className: "bg-primary/10 text-text-accent dark:bg-primary/15 dark:text-text-accent" },
  approved_awaiting_completion: { label: "Approved", icon: CheckCircle2, className: "bg-primary/10 text-text-accent dark:bg-primary/15 dark:text-text-accent" },
  pending_review: { label: "Waiting on review", icon: Clock, className: "bg-card-alt text-text-muted dark:bg-card-alt dark:text-text-muted" },
  needs_revision: { label: "Needs revision", icon: RotateCcw, className: "bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive" },
  not_started: { label: "Not started", icon: Clock, className: "bg-card-alt text-text-muted dark:bg-card-alt dark:text-text-muted" },
};

export default function ContentItemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { permissionLevel } = useRole();
  const userId = useSessionStore((s) => s.userId);
  const queryClient = useQueryClient();

  const contentItemId = params.id;
  const canReview = permissionLevel === "mentor" || permissionLevel === "staff";

  const { data: item, isLoading: loadingItem } = useQuery({
    queryKey: ["content-item", contentItemId],
    queryFn: () => fetchContentItem(contentItemId),
  });

  const { data: roster, isLoading: loadingRoster } = useQuery({
    queryKey: ["content-item-roster-status", contentItemId],
    queryFn: () => fetchDispatchesForContentItem(contentItemId, item!.content_type),
    enabled: !!item,
  });

  const completeMutation = useMutation({
    mutationFn: ({ dispatchId, complete }: { dispatchId: string; complete: boolean }) =>
      complete ? markDispatchComplete(dispatchId, userId!) : unmarkDispatchComplete(dispatchId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["content-item-roster-status", contentItemId] }),
  });

  if (loadingItem || !item) {
    return <p className="p-4 text-sm text-text-muted dark:text-text-muted">Loading…</p>;
  }

  const Icon = TYPE_ICON[item.content_type];
  const template = item.submission_template;
  const requirement = template.metadata.is_not_required
    ? "disabled"
    : template.metadata.is_required
    ? "required"
    : "optional";

  return (
    <div className="flex flex-col gap-4 p-4">
      <button
        type="button"
        onClick={() => router.push("/assignments_and_courses")}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text-primary dark:text-text-muted dark:hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      {/* --- Details --- */}
      <section className="surface-card flex flex-col gap-3 dark:surface-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground">
              <Icon className="h-4.5 w-4.5" />
            </span>
            <div className="flex flex-col">
              <h1 className="font-heading text-lg font-medium text-text-primary dark:text-text-primary">{item.title}</h1>
              {item.week && <span className="text-xs text-text-muted dark:text-text-muted">{item.week.name}</span>}
            </div>
          </div>
          <RequirementBadge requirement={requirement} />
        </div>

        {item.description && <p className="text-sm text-text-primary dark:text-text-primary">{item.description}</p>}
        {item.instructions && (
          <div className="surface-card-alt dark:surface-card-alt">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">
              Instructions for mentees
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary dark:text-text-primary">{item.instructions}</p>
          </div>
        )}

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span key={tag.id} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted dark:border-border dark:text-text-muted">
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* --- Type-specific meta --- */}
      <TypeSpecificMeta item={item} />

      {/* --- Resource links --- */}
      {template.resource_links.length > 0 && (
        <section className="surface-card flex flex-col gap-2 dark:surface-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">External links</h2>
          <div className="flex flex-col gap-2">
            {template.resource_links.map((link, i) => (
              <a
                key={i}
                href={link.link}
                target="_blank"
                rel="noreferrer"
                className="surface-card-alt flex items-center gap-2 dark:surface-card-alt"
              >
                <Link2 className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted" />
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-text-primary dark:text-text-primary">{link.title || link.link}</span>
                  {link.description && <span className="text-xs text-text-muted dark:text-text-muted">{link.description}</span>}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* --- Roster / per-mentee review --- */}
      <section className="surface-card flex flex-col gap-3 dark:surface-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">
            Roster
          </h2>
          <span className="text-xs text-text-muted dark:text-text-muted">{roster?.length ?? 0} mentees</span>
        </div>

        {loadingRoster ? (
          <p className="text-xs text-text-muted dark:text-text-muted">Loading roster…</p>
        ) : !roster || roster.length === 0 ? (
          <EmptyState title="No mentees assigned yet" description="Edit this item to assign it to mentees." />
        ) : (
          <div className="flex flex-col gap-2">
            {roster.map((row) => (
              <RosterRow
                key={row.id}
                row={row}
                canReview={canReview}
                requirement={requirement}
                currentUserId={userId ?? ""}
                onToggleComplete={(complete) => completeMutation.mutate({ dispatchId: row.id, complete })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RequirementBadge({ requirement }: { requirement: "required" | "optional" | "disabled" }) {
  const label = requirement === "required" ? "Required" : requirement === "optional" ? "Optional" : "No submission";
  return (
    <span className="w-fit shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-text-muted dark:border-border dark:text-text-muted">
      {label}
    </span>
  );
}

function TypeSpecificMeta({ item }: { item: ContentItemWithMeta }) {
  const template = item.submission_template;
  if (item.content_type === "assignment") {
    return (
      <section className="surface-card flex flex-col gap-2 dark:surface-card">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">Assignment settings</h2>
        <p className="text-sm text-text-primary dark:text-text-primary">
          Max revisions: {template.type_specific.assignment.submission_links.max_revisions}
        </p>
      </section>
    );
  }
  if (item.content_type === "course") {
    return (
      <section className="surface-card flex flex-col gap-2 dark:surface-card">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">Course settings</h2>
        <p className="text-sm text-text-primary dark:text-text-primary">
          Total modules: {template.type_specific.course.modules_total ?? "Not set"}
        </p>
      </section>
    );
  }
  return null;
}

function RosterRow({
  row,
  canReview,
  requirement,
  currentUserId,
  onToggleComplete,
}: {
  row: DispatchRosterRow;
  canReview: boolean;
  requirement: "required" | "optional" | "disabled";
  currentUserId: string;
  onToggleComplete: (complete: boolean) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const status = STATUS_META[row.completion_status];
  const StatusIcon = status.icon;
  const isComplete = !!row.completed_at;
  // Only assignments/courses/resources with a real submission flow have
  // anything to review — "No submission" items just get the roster row +
  // Mark Complete, no expand affordance.
  const canExpandReview = requirement !== "disabled";

  return (
    <div className="surface-card-alt flex flex-col gap-2 dark:surface-card-alt">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text-primary dark:text-text-primary">{row.mentee_name}</span>
          {row.due_at && <span className="text-xs text-text-muted dark:text-text-muted">Due {new Date(row.due_at).toLocaleDateString()}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
          {canReview && canExpandReview && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-text-primary hover:bg-card dark:border-border dark:text-text-primary dark:hover:bg-card"
            >
              {expanded ? "Hide" : "Review"}
            </button>
          )}
          {canReview && (
            <button
              type="button"
              onClick={() => onToggleComplete(!isComplete)}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                isComplete
                  ? "border border-border text-text-muted hover:text-text-primary dark:border-border dark:text-text-muted dark:hover:text-text-primary"
                  : "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
              }`}
            >
              {isComplete ? <Undo2 className="h-3 w-3" /> : <Check className="h-3 w-3" />}
              {isComplete ? "Unmark" : "Mark complete"}
            </button>
          )}
        </div>
      </div>

      {expanded && canExpandReview && (
        <SubmissionReviewPanel dispatchId={row.id} currentUserId={currentUserId} />
      )}
    </div>
  );
}

function SubmissionReviewPanel({ dispatchId, currentUserId }: { dispatchId: string; currentUserId: string }) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState("");

  const { data: submission, isLoading } = useQuery({
    queryKey: ["submission-latest", dispatchId],
    queryFn: () => fetchLatestSubmission(dispatchId),
  });

  const reviewMutation = useMutation({
    mutationFn: (status: "approved" | "revision_requested") =>
      reviewSubmission({ submissionId: submission!.id, status, reviewedBy: currentUserId, feedback: feedback || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission-latest", dispatchId] });
      queryClient.invalidateQueries({ queryKey: ["content-item-roster-status"] });
    },
  });

  if (isLoading) return <p className="text-xs text-text-muted dark:text-text-muted">Loading submission…</p>;
  if (!submission) return <p className="text-xs text-text-muted dark:text-text-muted">No submission yet.</p>;

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3 dark:border-border">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-primary dark:text-text-primary">
          Version {submission.version_number}
        </span>
        <span className="text-[11px] text-text-muted dark:text-text-muted">
          Submitted {new Date(submission.submitted_at).toLocaleString()}
        </span>
      </div>

      <SubmissionAnswersReadout submission={submission} />

      {submission.status === "pending_review" ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Feedback (optional)"
            rows={2}
            className="resize-none rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-text-primary dark:border-border dark:bg-card dark:text-text-primary"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate("approved")}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate("revision_requested")}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-primary disabled:opacity-50 dark:border-border dark:text-text-primary"
            >
              Request revision
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-text-muted dark:text-text-muted">
          Already {submission.status === "approved" ? "approved" : "sent back for revision"}
          {submission.feedback ? ` — "${submission.feedback}"` : ""}.
        </p>
      )}
    </div>
  );
}

function SubmissionAnswersReadout({ submission }: { submission: ContentSubmission }) {
  const answers = submission.answers;
  return (
    <div className="flex flex-col gap-1.5 text-xs text-text-primary dark:text-text-primary">
      {answers.type_specific?.assignment && (
        <>
          <p>
            Submission link:{" "}
            <a href={answers.type_specific.assignment.submission_link} target="_blank" rel="noreferrer" className="text-text-accent underline dark:text-text-accent">
              {answers.type_specific.assignment.submission_link}
            </a>
          </p>
          {answers.type_specific.assignment.difficulty_level !== null && (
            <p>Difficulty: {answers.type_specific.assignment.difficulty_level}</p>
          )}
        </>
      )}
      {answers.type_specific?.course && (
        <>
          <p>Modules completed: {answers.type_specific.course.modules_completed ?? "—"}</p>
          {answers.type_specific.course.difficulty_level !== null && (
            <p>Difficulty: {answers.type_specific.course.difficulty_level}</p>
          )}
        </>
      )}
      {Object.entries(answers.additional_questions).map(([questionId, value]) => (
        <p key={questionId} className="text-text-muted dark:text-text-muted">
          {questionId}: {Array.isArray(value) ? value.join(", ") : String(value)}
        </p>
      ))}
    </div>
  );
}