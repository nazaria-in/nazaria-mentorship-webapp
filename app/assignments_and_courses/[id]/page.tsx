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
  ChevronDown,
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
import { supabase } from "@/lib/supabase/client";
import { fetchContentItem } from "@/lib/api/content-items";
import {
  fetchDispatchesForContentItem,
  markDispatchComplete,
  unmarkDispatchComplete,
  type DispatchRosterRow,
} from "@/lib/api/content-dispatches";
import {
  createSubmission,
  fetchLatestSubmission,
  fetchSubmissionsForDispatch,
  reviewSubmission,
} from "@/lib/api/content-submissions";
import type {
  CompletionStatus,
  ContentDispatch,
  ContentItemWithMeta,
  ContentSubmission,
  ContentSubmissionAnswers,
} from "@/types/content";
import type { ContentQuestionEntry } from "@/components/content/ContentSubmissionTemplateEditor";
import { getMentorIdsForMentee } from "@/lib/api/pods";

const TYPE_ICON = { assignment: ClipboardList, course: BookOpen, resource: FileBox } as const;

const STATUS_META: Record<CompletionStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  completed: { label: "Completed", icon: CheckCircle2, className: "bg-primary/10 text-text-accent dark:bg-primary/15 dark:text-text-accent" },
  approved_awaiting_completion: { label: "Approved", icon: CheckCircle2, className: "bg-primary/10 text-text-accent dark:bg-primary/15 dark:text-text-accent" },
  pending_review: { label: "Waiting on review", icon: Clock, className: "bg-card-alt text-text-muted dark:bg-card-alt dark:text-text-muted" },
  needs_revision: { label: "Needs revision", icon: RotateCcw, className: "bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive" },
  not_started: { label: "Not started", icon: Clock, className: "bg-card-alt text-text-muted dark:bg-card-alt dark:text-text-muted" },
};

/**
 * Ensures an external link always has a protocol, so <a href> resolves as
 * an absolute external URL instead of a relative path on this site.
 */
function normalizeExternalUrl(url?: string | null): string {
  if (!url) return "#";
  const trimmed = String(url).trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return "#";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function fetchMyDispatch(contentItemId: string, menteeId: string): Promise<ContentDispatch | null> {
  const { data, error } = await supabase
    .from("content_dispatches")
    .select("*")
    .eq("content_item_id", contentItemId)
    .eq("mentee_id", menteeId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ContentDispatch) ?? null;
}

export default function ContentItemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { permissionLevel } = useRole();
  const userId = useSessionStore((s) => s.userId);
  const queryClient = useQueryClient();

  const contentItemId = params.id;
  const canReview = permissionLevel === "mentor" || permissionLevel === "staff";
  const isMentee = permissionLevel === "mentee";

  const { data: item, isLoading: loadingItem } = useQuery({
    queryKey: ["content-item", contentItemId],
    queryFn: () => fetchContentItem(contentItemId),
  });

  const { data: roster, isLoading: loadingRoster, isError: rosterErrored } = useQuery({
    queryKey: ["content-item-roster-status", contentItemId],
    queryFn: () => fetchDispatchesForContentItem(contentItemId, item!.content_type),
    enabled: !!item && canReview,
  });

  const { data: myDispatch, isLoading: loadingMyDispatch } = useQuery({
    queryKey: ["my-dispatch", contentItemId, userId],
    queryFn: () => fetchMyDispatch(contentItemId, userId!),
    enabled: !!item && isMentee && !!userId,
  });

  const { data: mySubmissions, isLoading: loadingMySubmissions } = useQuery({
    queryKey: ["my-submissions", myDispatch?.id],
    queryFn: () => fetchSubmissionsForDispatch(myDispatch!.id),
    enabled: !!myDispatch,
  });

  // WIRED: Mark Complete now needs menteeId + contentItemTitle so
  // markDispatchComplete can fire the achievement notification and cancel
  // remaining reminders. Both come from the roster row being toggled and
  // the already-loaded item — see the call site in the roster map below.
  const completeMutation = useMutation({
    mutationFn: ({
      dispatchId,
      complete,
      menteeId,
      contentItemTitle,
    }: {
      dispatchId: string;
      complete: boolean;
      menteeId: string;
      contentItemTitle: string;
    }) =>
      complete
        ? markDispatchComplete(dispatchId, userId!, menteeId, contentItemTitle)
        : unmarkDispatchComplete(dispatchId),
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

      {/* --- Type-specific meta (creator-set values only) --- */}
      <TypeSpecificMeta item={item} />

      {/* --- Resource links --- */}
      {template.resource_links.length > 0 && (
        <section className="surface-card flex flex-col gap-2 dark:surface-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">External links</h2>
          <div className="flex flex-col gap-2">
            {template.resource_links.map((link, i) => (
              <a
                key={i}
                href={normalizeExternalUrl(link.link || "")}
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

      {/* --- Mentee: their own submission form + history --- */}
      {isMentee && (
        <MySubmissionSection
          item={item}
          requirement={requirement}
          dispatch={myDispatch ?? null}
          submissions={mySubmissions ?? []}
          isLoading={loadingMyDispatch || loadingMySubmissions}
          onSubmitted={() => {
            queryClient.invalidateQueries({ queryKey: ["my-submissions", myDispatch?.id] });
          }}
        />
      )}

      {/* --- Roster / per-mentee review (staff/mentor only) --- */}
      {canReview && (
        <section className="surface-card flex flex-col gap-3 dark:surface-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">
              Roster
            </h2>
            <span className="text-xs text-text-muted dark:text-text-muted">{roster?.length ?? 0} mentees</span>
          </div>

          {loadingRoster ? (
            <p className="text-xs text-text-muted dark:text-text-muted">Loading roster…</p>
          ) : rosterErrored ? (
            <p className="text-xs text-destructive dark:text-destructive">
              Couldn&apos;t load the roster — try refreshing.
            </p>
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
                  contentItemTitle={item.title}
                  onToggleComplete={(complete) =>
                    completeMutation.mutate({
                      dispatchId: row.id,
                      complete,
                      menteeId: row.mentee_id,
                      contentItemTitle: item.title,
                    })
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}
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
  contentItemTitle,
  onToggleComplete,
}: {
  row: DispatchRosterRow;
  canReview: boolean;
  requirement: "required" | "optional" | "disabled";
  currentUserId: string;
  contentItemTitle: string;
  onToggleComplete: (complete: boolean) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const status = STATUS_META[row.completion_status];
  const StatusIcon = status.icon;
  const isComplete = !!row.completed_at;
  const canExpandReview = requirement !== "disabled";

  const markCompleteButton = canReview && (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggleComplete(!isComplete);
      }}
      className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
        isComplete
          ? "border border-border text-text-muted hover:text-text-primary dark:border-border dark:text-text-muted"
          : "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
      }`}
    >
      {isComplete ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
      {isComplete ? "Unmark complete" : "Mark complete"}
    </button>
  );

  return (
    <div
      onClick={canExpandReview ? () => setExpanded((e) => !e) : undefined}
      role={canExpandReview ? "button" : undefined}
      tabIndex={canExpandReview ? 0 : undefined}
      aria-expanded={canExpandReview ? expanded : undefined}
      onKeyDown={
        canExpandReview
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setExpanded((ex) => !ex);
              }
            }
          : undefined
      }
      className={`surface-card-alt flex flex-col gap-2 dark:surface-card-alt ${
        canExpandReview ? "cursor-pointer transition-colors hover:bg-card dark:hover:bg-card" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text-primary dark:text-text-primary">{row.mentee_name}</span>
          {row.due_at && (
            <span className="text-xs text-text-muted dark:text-text-muted">
              Due {new Date(row.due_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
          {canExpandReview ? (
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-text-muted transition-transform dark:text-text-muted ${
                expanded ? "rotate-180" : ""
              }`}
            />
          ) : (
            markCompleteButton
          )}
        </div>
      </div>

      {expanded && canExpandReview && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex flex-col gap-3 border-t border-border pt-3 dark:border-border"
        >
          <SubmissionReviewPanel
            dispatchId={row.id}
            menteeId={row.mentee_id}
            contentItemTitle={contentItemTitle}
            currentUserId={currentUserId}
          />
          <div className="flex justify-end">{markCompleteButton}</div>
        </div>
      )}
    </div>
  );
}

function SubmissionReviewPanel({
  dispatchId,
  menteeId,
  contentItemTitle,
  currentUserId,
}: {
  dispatchId: string;
  menteeId: string;
  contentItemTitle: string;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState("");

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["submissions-all", dispatchId],
    queryFn: () => fetchSubmissionsForDispatch(dispatchId),
  });

  const latest = submissions?.[0] ?? null;
  const olderSubmissions = submissions?.slice(1) ?? [];

  const reviewMutation = useMutation({
    mutationFn: (status: "approved" | "revision_requested") =>
      reviewSubmission({
        submissionId: latest!.id,
        status,
        reviewedBy: currentUserId,
        feedback: feedback || null,
        contentDispatchId: dispatchId,
        menteeId,
        contentItemTitle,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions-all", dispatchId] });
      queryClient.invalidateQueries({ queryKey: ["content-item-roster-status"] });
    },
  });

  if (isLoading) return <p className="text-xs text-text-muted dark:text-text-muted">Loading submissions…</p>;
  if (!latest) return <p className="text-xs text-text-muted dark:text-text-muted">No submission yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {/* --- Latest version: reviewable --- */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-primary dark:text-text-primary">
          Version {latest.version_number} (latest)
        </span>
        <span className="text-[11px] text-text-muted dark:text-text-muted">
          Submitted {new Date(latest.submitted_at).toLocaleString()}
        </span>
      </div>

      <SubmissionAnswersReadout submission={latest} />

      {latest.status === "pending_review" ? (
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
          Already {latest.status === "approved" ? "approved" : "sent back for revision"}
          {latest.feedback ? ` — "${latest.feedback}"` : ""}.
        </p>
      )}

      {/* --- Older versions: read-only history --- */}
      {olderSubmissions.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3 dark:border-border">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">
            Previous versions ({olderSubmissions.length})
          </span>
          {olderSubmissions.map((submission) => (
            <div key={submission.id} className="surface-card-alt flex flex-col gap-2 dark:surface-card-alt">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary dark:text-text-primary">
                  Version {submission.version_number} — {submission.status.replace("_", " ")}
                </span>
                <span className="text-[11px] text-text-muted dark:text-text-muted">
                  {new Date(submission.submitted_at).toLocaleString()}
                </span>
              </div>
              <SubmissionAnswersReadout submission={submission} />
              {submission.feedback && (
                <p className="text-xs text-text-primary dark:text-text-primary">
                  Feedback: &quot;{submission.feedback}&quot;
                </p>
              )}
            </div>
          ))}
        </div>
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
            <a
              href={normalizeExternalUrl(answers.type_specific.assignment.submission_link)}
              target="_blank"
              rel="noreferrer"
              className="text-text-accent underline dark:text-text-accent"
            >
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

// ---------------------------------------------------------------------------
// Mentee-facing submission section
// ---------------------------------------------------------------------------

function MySubmissionSection({
  item,
  requirement,
  dispatch,
  submissions,
  isLoading,
  onSubmitted,
}: {
  item: ContentItemWithMeta;
  requirement: "required" | "optional" | "disabled";
  dispatch: ContentDispatch | null;
  submissions: ContentSubmission[];
  isLoading: boolean;
  onSubmitted: () => void;
}) {
  if (requirement === "disabled") return null;

  if (isLoading) {
    return (
      <section className="surface-card dark:surface-card">
        <p className="text-xs text-text-muted dark:text-text-muted">Loading your submission…</p>
      </section>
    );
  }

  if (!dispatch) {
    return (
      <section className="surface-card dark:surface-card">
        <p className="text-xs text-text-muted dark:text-text-muted">
          This item hasn&apos;t been assigned to you yet.
        </p>
      </section>
    );
  }

  const latest = submissions[0] ?? null;
  const maxRevisions =
    item.content_type === "assignment"
      ? item.submission_template.type_specific.assignment.submission_links.max_revisions
      : null;
  const revisionLimitReached = maxRevisions !== null && submissions.length >= maxRevisions;
  const isPendingReview = latest?.status === "pending_review";
  const isMarkedComplete = !!dispatch.completed_at;
  const canSubmit = !isMarkedComplete && !revisionLimitReached && !isPendingReview;

  return (
    <section className="surface-card flex flex-col gap-4 dark:surface-card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">
          Your submission
        </h2>
        {isMarkedComplete && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-text-accent dark:bg-primary/15 dark:text-text-accent">
            <CheckCircle2 className="h-3 w-3" />
            Marked complete
          </span>
        )}
      </div>

      {latest && (
        <div className="surface-card-alt flex flex-col gap-2 dark:surface-card-alt">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-primary dark:text-text-primary">
              Version {latest.version_number} — {latest.status.replace("_", " ")}
            </span>
            <span className="text-[11px] text-text-muted dark:text-text-muted">
              {new Date(latest.submitted_at).toLocaleString()}
            </span>
          </div>
          {latest.feedback && (
            <p className="text-xs text-text-primary dark:text-text-primary">Feedback: &quot;{latest.feedback}&quot;</p>
          )}
        </div>
      )}

      {isMarkedComplete ? (
        <p className="text-xs text-text-muted dark:text-text-muted">
          This item has been marked complete — you can&apos;t submit a new version.
        </p>
      ) : (
        <>
          {revisionLimitReached && (
            <p className="text-xs text-text-muted dark:text-text-muted">
              You&apos;ve used all {maxRevisions} allowed submissions for this assignment.
            </p>
          )}
          {isPendingReview && !revisionLimitReached && (
            <p className="text-xs text-text-muted dark:text-text-muted">
              Your latest submission is waiting on review — you can submit a new version once it&apos;s reviewed.
            </p>
          )}
        </>
      )}

      {canSubmit && (
        <MenteeSubmissionForm
          item={item}
          dispatch={dispatch}
          priorVersionCount={submissions.length}
          latestAnswers={latest?.answers ?? null}
          onSubmitted={onSubmitted}
        />
      )}
    </section>
  );
}

function defaultAnswersFor(item: ContentItemWithMeta): ContentSubmissionAnswers {
  const base: ContentSubmissionAnswers = { additional_questions: {} };
  if (item.content_type === "assignment") {
    base.type_specific = { assignment: { submission_link: "", difficulty_level: null } };
  } else if (item.content_type === "course") {
    base.type_specific = { course: { modules_completed: null, difficulty_level: null } };
  }
  return base;
}

function isQuestionVisible(
  question: ContentQuestionEntry,
  answers: Record<string, string | string[] | number>
): boolean {
  if (!question.showIf) return true;
  const parentValue = answers[question.showIf.questionId];
  if (question.showIf.equals !== undefined) {
    if (Array.isArray(parentValue)) return parentValue.includes(question.showIf.equals);
    return parentValue === question.showIf.equals;
  }
  if (question.showIf.atLeast !== undefined) {
    return typeof parentValue === "number" && parentValue >= question.showIf.atLeast;
  }
  return true;
}

function MenteeSubmissionForm({
  item,
  dispatch,
  priorVersionCount,
  latestAnswers,
  onSubmitted,
}: {
  item: ContentItemWithMeta;
  dispatch: ContentDispatch;
  priorVersionCount: number;
  latestAnswers: ContentSubmissionAnswers | null;
  onSubmitted: () => void;
}) {
  const currentUserFullName = useSessionStore((s) => s.fullName);

  const [answers, setAnswers] = React.useState<ContentSubmissionAnswers>(
    () => latestAnswers ?? defaultAnswersFor(item)
  );
  const { data: podMentorIds } = useQuery({
    queryKey: ["pod-mentor-ids-for-mentee", dispatch.mentee_id],
    queryFn: () => getMentorIdsForMentee(dispatch.mentee_id),
  });


  // WIRED: createSubmission now needs mentorId/menteeName/contentItemTitle
  // to fire notifyContentSubmitted. mentorId = item.created_by (the
  // content item's author — see the file header note in
  // lib/api/content-submissions.ts for why this rather than
  // dispatch.assigned_by). menteeName falls back to a generic string if
  // the session store doesn't have a full name populated yet — flagged
  // rather than silently sending an empty/undefined name in the
  // notification body.
  const submitMutation = useMutation({
    mutationFn: () =>
      createSubmission({
        dispatchId: dispatch.id,
        contentItemId: item.id,
        answers,
        priorVersionCount,
        questionDefs: item.submission_template.additional_questions,
        recipientMentorIds: Array.from(new Set([...(podMentorIds ?? []), item.created_by])),
        menteeName: currentUserFullName || "A mentee",
        contentItemTitle: item.title,
      }),
    onSuccess: () => {
      onSubmitted();
    },
  });

  function patchAdditional(questionId: string, value: string | string[] | number) {
    setAnswers((prev) => ({
      ...prev,
      additional_questions: { ...prev.additional_questions, [questionId]: value },
    }));
  }

  function patchAssignment(patch: Partial<{ submission_link: string; difficulty_level: number | null }>) {
    setAnswers((prev) => ({
      ...prev,
      type_specific: {
        ...prev.type_specific,
        assignment: {
          submission_link: prev.type_specific?.assignment?.submission_link ?? "",
          difficulty_level: prev.type_specific?.assignment?.difficulty_level ?? null,
          ...patch,
        },
      },
    }));
  }

  function patchCourse(patch: Partial<{ modules_completed: number | null; difficulty_level: number | null }>) {
    setAnswers((prev) => ({
      ...prev,
      type_specific: {
        ...prev.type_specific,
        course: {
          modules_completed: prev.type_specific?.course?.modules_completed ?? null,
          difficulty_level: prev.type_specific?.course?.difficulty_level ?? null,
          ...patch,
        },
      },
    }));
  }

  const canSubmitForm =
    item.content_type !== "assignment" || (answers.type_specific?.assignment?.submission_link ?? "").trim() !== "";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitMutation.mutate();
      }}
      className="flex flex-col gap-4 border-t border-border pt-4 dark:border-border"
    >
      {item.content_type === "assignment" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted dark:text-text-muted">Submission link</label>
            <input
              type="url"
              required
              value={answers.type_specific?.assignment?.submission_link ?? ""}
              onChange={(e) => patchAssignment({ submission_link: e.target.value })}
              placeholder="https://..."
              className="rounded-lg border border-border bg-card-alt px-3 py-1.5 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
            />
          </div>
          <RatingInput
            label="How difficult was this?"
            scale={5}
            value={answers.type_specific?.assignment?.difficulty_level ?? null}
            onChange={(v) => patchAssignment({ difficulty_level: v })}
          />
        </div>
      )}

      {item.content_type === "course" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted dark:text-text-muted">Modules completed</label>
            <input
              type="number"
              min={0}
              max={item.submission_template.type_specific.course.modules_total ?? undefined}
              value={answers.type_specific?.course?.modules_completed ?? ""}
              onChange={(e) =>
                patchCourse({ modules_completed: e.target.value === "" ? null : Number(e.target.value) })
              }
              className="w-24 rounded-lg border border-border bg-card-alt px-3 py-1.5 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
            />
          </div>
          <RatingInput
            label="How difficult is this course?"
            scale={5}
            value={answers.type_specific?.course?.difficulty_level ?? null}
            onChange={(v) => patchCourse({ difficulty_level: v })}
          />
        </div>
      )}

      {item.submission_template.additional_questions
        .filter((q) => isQuestionVisible(q, answers.additional_questions))
        .map((question) => (
          <AdditionalQuestionInput
            key={question.id}
            question={question}
            value={answers.additional_questions[question.id]}
            onChange={(v) => patchAdditional(question.id, v)}
          />
        ))}

      {submitMutation.isError && (
        <p className="text-xs text-destructive dark:text-destructive">
          Something went wrong submitting — please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmitForm || submitMutation.isPending}
        className="w-fit rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
      >
        {submitMutation.isPending ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}

function RatingInput({
  label,
  scale,
  value,
  onChange,
}: {
  label: string;
  scale: number;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-muted dark:text-text-muted">{label}</label>
      <div className="flex gap-1">
        {Array.from({ length: scale }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium transition-colors ${
              value === n
                ? "border-primary bg-primary text-primary-foreground dark:border-primary dark:bg-primary dark:text-primary-foreground"
                : "border-border text-text-muted hover:border-primary dark:border-border dark:text-text-muted"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function AdditionalQuestionInput({
  question,
  value,
  onChange,
}: {
  question: ContentQuestionEntry;
  value: string | string[] | number | undefined;
  onChange: (value: string | string[] | number) => void;
}) {
  if (question.component === "short_answer") {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-muted dark:text-text-muted">{question.question}</label>
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="resize-none rounded-lg border border-border bg-card-alt px-3 py-1.5 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
        />
      </div>
    );
  }

  if (question.component === "rating") {
    return (
      <RatingInput
        label={question.question}
        scale={question.scale}
        value={typeof value === "number" ? value : null}
        onChange={onChange}
      />
    );
  }

  if (question.component === "single_select") {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-muted dark:text-text-muted">{question.question}</label>
        <div className="flex flex-wrap gap-1.5">
          {question.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                value === option
                  ? "border-primary bg-primary text-primary-foreground dark:border-primary dark:bg-primary dark:text-primary-foreground"
                  : "border-border text-text-muted hover:border-primary dark:border-border dark:text-text-muted"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // multi_select
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-muted dark:text-text-muted">{question.question}</label>
      <div className="flex flex-wrap gap-1.5">
        {question.options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() =>
                onChange(isSelected ? selected.filter((o) => o !== option) : [...selected, option])
              }
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground dark:border-primary dark:bg-primary dark:text-primary-foreground"
                  : "border-border text-text-muted hover:border-primary dark:border-border dark:text-text-muted"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}