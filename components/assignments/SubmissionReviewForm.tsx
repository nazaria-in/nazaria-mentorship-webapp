// components/assignments/SubmissionReviewForm.tsx
"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { reviewSubmission } from "@/lib/api/mentee-assignments";
import type { SubmissionStatus } from "@/types/assignments";

export interface SubmissionReviewFormProps {
  submissionId: string;
  reviewerId: string;
  onReviewed: () => void;
}

type ReviewAction = Extract<SubmissionStatus, "approved" | "revision_requested">;

export function SubmissionReviewForm({ submissionId, reviewerId, onReviewed }: SubmissionReviewFormProps) {
  const [feedback, setFeedback] = React.useState("");
  const [pendingAction, setPendingAction] = React.useState<ReviewAction | null>(null);

  const mutation = useMutation({
    mutationFn: (status: ReviewAction) => reviewSubmission({ submissionId, feedback, reviewedBy: reviewerId, status }),
    onSuccess: () => {
      setFeedback("");
      setPendingAction(null);
      onReviewed();
    },
  });

  function handleAction(status: ReviewAction) {
    if (!feedback.trim()) return;
    setPendingAction(status);
    mutation.mutate(status);
  }

  return (
    <div className="mt-2.5 flex flex-col gap-2.5 border-t border-border/60 pt-3 dark:border-white/10">
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Leave feedback for this submission…"
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-text-primary outline-none transition-colors placeholder:text-text-primary/40 focus:border-ring focus:ring-2 focus:ring-ring/30 dark:bg-white/5 dark:border-white/10"
      />
      {mutation.isError && (
        <p className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive dark:bg-destructive/15">
          Couldn&apos;t save review. Try again.
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleAction("approved")}
          disabled={!feedback.trim() || mutation.isPending}
          className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending && pendingAction === "approved" ? "Saving…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => handleAction("revision_requested")}
          disabled={!feedback.trim() || mutation.isPending}
          className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
        >
          {mutation.isPending && pendingAction === "revision_requested" ? "Saving…" : "Request revision"}
        </button>
      </div>
    </div>
  );
}