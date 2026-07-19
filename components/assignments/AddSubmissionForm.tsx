// /components/assignments/AddSubmissionForm.tsx
"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
// import { UploadBox, type UploadedFileRef } from "@/components/shared/uploadbox/UploadBox";
import { createFileFromLink } from "@/lib/api/uploads";
import { submitVersion } from "@/lib/api/mentee-assignments";

export interface AddSubmissionFormProps {
  slotId: string;
  menteeAssignmentId: string;
  nextVersionNumber: number;
  onSubmitted: () => void;
}

function isLikelyValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function AddSubmissionForm({ slotId, menteeAssignmentId, nextVersionNumber, onSubmitted }: AddSubmissionFormProps) {
  // const [files, setFiles] = React.useState<UploadedFileRef[]>([]);
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkError, setLinkError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmed = linkUrl.trim();
      if (!isLikelyValidUrl(trimmed)) throw new Error("Enter a valid link");

      const fileRef = await createFileFromLink(trimmed, { kind: "assignment_submission", menteeAssignmentId });

      return submitVersion({
        mentee_assignment_id: menteeAssignmentId,
        slot_id: slotId,
        file_id: fileRef.id,
        version_number: nextVersionNumber,
      });
    },
    onSuccess: () => {
      setLinkUrl("");
      setLinkError(null);
      onSubmitted();
    },
  });

  const canSubmit = isLikelyValidUrl(linkUrl);

  return (
    <form
      className="mt-2 flex flex-col gap-2.5 border-t border-border/60 pt-3.5 dark:border-white/10"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isLikelyValidUrl(linkUrl)) {
          setLinkError("Enter a valid link");
          return;
        }
        setLinkError(null);
        mutation.mutate();
      }}
    >
      <span className="text-xs font-medium text-text-primary/70 dark:text-text-primary/70">
        {nextVersionNumber === 1 ? "Add submission" : `Create new submission — v${nextVersionNumber}`}
      </span>

      {/* <UploadBox
        value={files}
        onChange={setFiles}
        uploadContext={{ kind: "assignment_submission", menteeAssignmentId }}
        multiple={false}
        label="Upload your work"
      /> */}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-primary/70 dark:text-text-primary/70">
          Link to your work
        </span>
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => {
            setLinkUrl(e.target.value);
            if (linkError) setLinkError(null);
          }}
          placeholder="https://drive.google.com/…"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 dark:bg-white/5 dark:border-white/10 dark:text-text-primary"
        />
        <span className="text-[11px] text-text-primary/50 dark:text-text-primary/60">
          Make sure the file&apos;s sharing/access setting is public — reviewers won&apos;t be able to open it otherwise.
        </span>
      </label>

      {linkError && (
        <p className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive dark:bg-destructive/15">
          {linkError}
        </p>
      )}
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