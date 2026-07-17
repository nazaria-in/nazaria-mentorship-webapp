// components/assignments/AddSubmissionForm.tsx
"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { UploadBox, type UploadedFileRef } from "@/components/shared/uploadbox/UploadBox";
import { submitVersion } from "@/lib/api/mentee-assignments";

export interface AddSubmissionFormProps {
  slotId: string;
  menteeAssignmentId: string;
  nextVersionNumber: number;
  onSubmitted: () => void;
}

export function AddSubmissionForm({ slotId, menteeAssignmentId, nextVersionNumber, onSubmitted }: AddSubmissionFormProps) {
  const [files, setFiles] = React.useState<UploadedFileRef[]>([]);

  const mutation = useMutation({
    mutationFn: async () => {
      const fileId = files[0]?.id;
      if (!fileId) throw new Error("No file uploaded");
      return submitVersion({
        mentee_assignment_id: menteeAssignmentId,
        slot_id: slotId,
        file_id: fileId,
        version_number: nextVersionNumber,
      });
    },
    onSuccess: () => {
      setFiles([]);
      onSubmitted();
    },
  });

  const canSubmit = files.length > 0;

  return (
    <form
      className="mt-2 flex flex-col gap-2.5 border-t border-border/60 pt-3.5 dark:border-white/10"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mutation.mutate();
      }}
    >
      <span className="text-xs font-medium text-text-primary/70 dark:text-text-primary/70">
        {nextVersionNumber === 1 ? "Add submission" : `Create new submission — v${nextVersionNumber}`}
      </span>

      <UploadBox
        value={files}
        onChange={setFiles}
        uploadContext={{ kind: "assignment_submission", menteeAssignmentId }}
        multiple={false}
        label="Upload your work"
      />

      {mutation.isError && (
        <p className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive dark:bg-destructive/15">
          Couldn&apos;t submit. Try again.
        </p>
      )}
      <button
        type="submit"
        disabled={!canSubmit || mutation.isPending}
        className="self-start rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mutation.isPending ? "Submitting…" : nextVersionNumber === 1 ? "Submit" : "Create submission"}
      </button>
    </form>
  );
}