// /app/assignments_and_courses/via/[dispatchId]/page.tsx

"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Link2 } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import { fetchDispatchById } from "@/lib/api/content-dispatches";
import { fetchSubmissionsForDispatch, createSubmission } from "@/lib/api/content-submissions";
import type {
  AdditionalQuestionAnswerValue,
  ContentSubmission,
  ContentSubmissionAnswers,
} from "@/types/content";
import type { ContentQuestionEntry } from "@/components/content/ContentSubmissionTemplateEditor";

export default function MenteeSubmissionPage() {
  const params = useParams<{ dispatchId: string }>();
  const router = useRouter();
  const userId = useSessionStore((s) => s.userId);
  const queryClient = useQueryClient();

  const dispatchId = params.dispatchId;

  const { data: dispatch, isLoading: loadingDispatch } = useQuery({
    queryKey: ["dispatch", dispatchId],
    queryFn: () => fetchDispatchById(dispatchId),
  });

  const { data: submissions, isLoading: loadingSubmissions } = useQuery({
    queryKey: ["submissions", dispatchId],
    queryFn: () => fetchSubmissionsForDispatch(dispatchId),
    enabled: !!dispatch,
  });

  if (loadingDispatch || !dispatch) {
    return <p className="p-4 text-sm text-text-muted dark:text-text-muted">Loading…</p>;
  }

  const item = dispatch.content_item;
  const template = item.submission_template;
  const requirement = template.metadata.is_not_required
    ? "disabled"
    : template.metadata.is_required
    ? "required"
    : "optional";
  const isRecurring = template.metadata.submission_type === "recurring_update";
  const latestSubmission = submissions && submissions.length > 0 ? submissions[0] : null;

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

      <section className="surface-card flex flex-col gap-2 dark:surface-card">
        <h1 className="font-heading text-lg font-medium text-text-primary dark:text-text-primary">{item.title}</h1>
        {item.description && <p className="text-sm text-text-primary dark:text-text-primary">{item.description}</p>}
        {item.instructions && (
          <p className="whitespace-pre-wrap text-sm text-text-muted dark:text-text-muted">{item.instructions}</p>
        )}
        {dispatch.due_at && <p className="text-xs text-text-muted dark:text-text-muted">Due {new Date(dispatch.due_at).toLocaleDateString()}</p>}
      </section>

      {template.resource_links.length > 0 && (
        <section className="surface-card flex flex-col gap-2 dark:surface-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">Resources</h2>
          {template.resource_links.map((link, i) => (
            <a key={i} href={link.link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-text-accent hover:underline dark:text-text-accent">
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              {link.title || link.link}
            </a>
          ))}
        </section>
      )}

      {requirement === "disabled" ? (
        <section className="surface-card dark:surface-card">
          <p className="text-sm text-text-muted dark:text-text-muted">This item has no submission — nothing to fill out here.</p>
        </section>
      ) : loadingSubmissions ? (
        <p className="text-sm text-text-muted dark:text-text-muted">Loading your submission…</p>
      ) : (
        <SubmissionForm
          dispatchId={dispatchId}
          menteeId={userId ?? ""}
          contentType={item.content_type}
          questions={template.additional_questions}
          requirement={requirement}
          isRecurring={isRecurring}
          priorVersionCount={submissions?.length ?? 0}
          latestSubmission={latestSubmission}
          onSubmitted={() => queryClient.invalidateQueries({ queryKey: ["submissions", dispatchId] })}
        />
      )}

      {isRecurring && submissions && submissions.length > 1 && (
        <SubmissionHistory submissions={submissions.slice(1)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submission form — renders the matching type_specific block (by
// content_type) + additional_questions, respecting each question's showIf.
// Handles both submission_type "single" (assignment/resource default — one
// version, resubmission creates a new version on revision request) and
// "recurring_update" (course default — repeated updates over time, each
// its own version, no "needs revision" gate on submitting again).
// ---------------------------------------------------------------------------

interface SubmissionFormProps {
  dispatchId: string;
  menteeId: string;
  contentType: "assignment" | "course" | "resource";
  questions: ContentQuestionEntry[];
  requirement: "required" | "optional";
  isRecurring: boolean;
  priorVersionCount: number;
  latestSubmission: ContentSubmission | null;
  onSubmitted: () => void;
}

function SubmissionForm({
  dispatchId,
  menteeId: _menteeId,
  contentType,
  questions,
  requirement,
  isRecurring,
  priorVersionCount,
  latestSubmission,
  onSubmitted,
}: SubmissionFormProps) {
  const [submissionLink, setSubmissionLink] = React.useState(
    latestSubmission?.answers.type_specific?.assignment?.submission_link ?? ""
  );
  const [difficultyLevel, setDifficultyLevel] = React.useState<number | null>(
    latestSubmission?.answers.type_specific?.assignment?.difficulty_level ??
      latestSubmission?.answers.type_specific?.course?.difficulty_level ??
      null
  );
  const [modulesCompleted, setModulesCompleted] = React.useState<number | null>(
    latestSubmission?.answers.type_specific?.course?.modules_completed ?? null
  );
  const [questionAnswers, setQuestionAnswers] = React.useState<Record<string, AdditionalQuestionAnswerValue>>(
    latestSubmission?.answers.additional_questions ?? {}
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const answers: ContentSubmissionAnswers = {
        additional_questions: questionAnswers,
        type_specific:
          contentType === "assignment"
            ? { assignment: { submission_link: submissionLink, difficulty_level: difficultyLevel } }
            : contentType === "course"
            ? { course: { modules_completed: modulesCompleted, difficulty_level: difficultyLevel } }
            : undefined,
      };
      return createSubmission({ dispatchId, answers, priorVersionCount });
    },
    onSuccess: () => onSubmitted(),
  });

  // Locked once pending_review for a non-recurring item — a mentee
  // shouldn't be able to silently overwrite what a mentor is about to
  // review. Recurring items (courses) are always open for a new update.
  const locked = !isRecurring && latestSubmission?.status === "pending_review";

  function setAnswer(questionId: string, value: AdditionalQuestionAnswerValue) {
    setQuestionAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  return (
    <section className="surface-card flex flex-col gap-4 dark:surface-card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">
          {isRecurring ? "Post an update" : "Your submission"}
        </h2>
        {requirement === "optional" && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted dark:border-border dark:text-text-muted">
            Optional
          </span>
        )}
      </div>

      {latestSubmission && !isRecurring && (
        <p className="text-xs text-text-muted dark:text-text-muted">
          Status: {latestSubmission.status === "approved" ? "Approved" : latestSubmission.status === "revision_requested" ? "Revision requested" : "Waiting on review"}
          {latestSubmission.feedback ? ` — "${latestSubmission.feedback}"` : ""}
        </p>
      )}

      {contentType === "assignment" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted dark:text-text-muted">Submission link</span>
          <input
            value={submissionLink}
            onChange={(e) => setSubmissionLink(e.target.value)}
            disabled={locked}
            placeholder="https://..."
            className="rounded-lg border border-border bg-card-alt px-3 py-2 text-sm text-text-primary disabled:opacity-60 dark:border-border dark:bg-card-alt dark:text-text-primary"
          />
        </label>
      )}

      {contentType === "course" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted dark:text-text-muted">Modules completed</span>
          <input
            type="number"
            min={0}
            value={modulesCompleted ?? ""}
            onChange={(e) => setModulesCompleted(e.target.value === "" ? null : Number(e.target.value))}
            className="w-24 rounded-lg border border-border bg-card-alt px-3 py-2 text-sm text-text-primary dark:border-border dark:bg-card-alt dark:text-text-primary"
          />
        </label>
      )}

      {(contentType === "assignment" || contentType === "course") && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted dark:text-text-muted">How difficult was this? (1–5)</span>
          <input
            type="number"
            min={1}
            max={5}
            value={difficultyLevel ?? ""}
            onChange={(e) => setDifficultyLevel(e.target.value === "" ? null : Number(e.target.value))}
            disabled={locked}
            className="w-24 rounded-lg border border-border bg-card-alt px-3 py-2 text-sm text-text-primary disabled:opacity-60 dark:border-border dark:bg-card-alt dark:text-text-primary"
          />
        </label>
      )}

      {questions.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border pt-3 dark:border-border">
          {questions.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              allQuestions={questions}
              answers={questionAnswers}
              value={questionAnswers[question.id]}
              onChange={(value) => setAnswer(question.id, value)}
              disabled={locked}
            />
          ))}
        </div>
      )}

      {createMutation.isError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive dark:bg-destructive/15">
          Couldn&apos;t submit. Try again.
        </p>
      )}

      <button
        type="button"
        disabled={locked || createMutation.isPending}
        onClick={() => createMutation.mutate()}
        className="w-fit rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
      >
        {createMutation.isPending ? "Submitting…" : isRecurring ? "Post update" : locked ? "Waiting on review" : "Submit"}
      </button>
    </section>
  );
}

/**
 * Derives visibility from showIf during render — no effect needed. A
 * question with no showIf, or one pointing at nothing answered yet,
 * defaults to visible/hidden per the same rule the template editor uses:
 * showIf absent = always show; showIf present = only show once the parent
 * question's current answer matches.
 */
function isQuestionVisible(question: ContentQuestionEntry, allQuestions: ContentQuestionEntry[], answers: Record<string, AdditionalQuestionAnswerValue>): boolean {
  if (!question.showIf) return true;
  const parent = allQuestions.find((q) => q.id === question.showIf?.questionId);
  const parentAnswer = answers[question.showIf.questionId];
  if (!parent || parentAnswer === undefined) return false;

  if (question.showIf.atLeast !== undefined) {
    return typeof parentAnswer === "number" && parentAnswer >= question.showIf.atLeast;
  }
  if (question.showIf.equals !== undefined) {
    if (Array.isArray(parentAnswer)) return parentAnswer.includes(question.showIf.equals);
    return parentAnswer === question.showIf.equals;
  }
  return true;
}

function QuestionField({
  question,
  allQuestions,
  answers,
  value,
  onChange,
  disabled,
}: {
  question: ContentQuestionEntry;
  allQuestions: ContentQuestionEntry[];
  answers: Record<string, AdditionalQuestionAnswerValue>;
  value: AdditionalQuestionAnswerValue | undefined;
  onChange: (value: AdditionalQuestionAnswerValue) => void;
  disabled: boolean;
}) {
  const visible = isQuestionVisible(question, allQuestions, answers);
  if (!visible) return null;

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-primary dark:text-text-primary">{question.question}</span>

      {question.component === "short_answer" && (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={2}
          className="resize-none rounded-lg border border-border bg-card-alt px-3 py-2 text-sm text-text-primary disabled:opacity-60 dark:border-border dark:bg-card-alt dark:text-text-primary"
        />
      )}

      {question.component === "rating" && (
        <input
          type="number"
          min={1}
          max={question.scale}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          disabled={disabled}
          className="w-20 rounded-lg border border-border bg-card-alt px-3 py-2 text-sm text-text-primary disabled:opacity-60 dark:border-border dark:bg-card-alt dark:text-text-primary"
        />
      )}

      {question.component === "single_select" && (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="rounded-lg border border-border bg-card-alt px-3 py-2 text-sm text-text-primary disabled:opacity-60 dark:border-border dark:bg-card-alt dark:text-text-primary"
        >
          <option value="">Select…</option>
          {question.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {question.component === "multi_select" && (
        <div className="flex flex-wrap gap-1.5">
          {question.options.map((option) => {
            const selected = Array.isArray(value) && value.includes(option);
            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() => {
                  const current = Array.isArray(value) ? value : [];
                  onChange(selected ? current.filter((v) => v !== option) : [...current, option]);
                }}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                  selected
                    ? "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground"
                    : "border border-border text-text-muted hover:text-text-primary dark:border-border dark:text-text-muted dark:hover:text-text-primary"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}
    </label>
  );
}

function SubmissionHistory({ submissions }: { submissions: ContentSubmission[] }) {
  return (
    <section className="surface-card flex flex-col gap-2 dark:surface-card">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted">Previous updates</h2>
      <div className="flex flex-col gap-2">
        {submissions.map((s) => (
          <div key={s.id} className="surface-card-alt flex items-center justify-between dark:surface-card-alt">
            <span className="text-xs text-text-primary dark:text-text-primary">Version {s.version_number}</span>
            <span className="text-[11px] text-text-muted dark:text-text-muted">{new Date(s.submitted_at).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </section>
  );
}