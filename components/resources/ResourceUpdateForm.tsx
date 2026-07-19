// /components/resources/ResourceUpdateForm.tsx

"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
// import { UploadBox, type UploadedFileRef } from "@/components/shared/uploadbox/UploadBox";
import { createFileFromLink } from "@/lib/api/uploads";
import { createResourceUpdate } from "@/lib/api/resources";

export interface ResourceUpdateFormProps {
  resourceId: string;
  menteeId: string;
  onCreated?: () => void;
}

function isLikelyValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function ResourceUpdateForm({ resourceId, menteeId, onCreated }: ResourceUpdateFormProps) {
  const [progressNote, setProgressNote] = React.useState("");
  const [progressPercent, setProgressPercent] = React.useState("");
  const [hoursSpent, setHoursSpent] = React.useState("");
  // const [file, setFile] = React.useState<UploadedFileRef[]>([]);
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmed = linkUrl.trim();
      let fileId: string | null = null;

      if (trimmed) {
        if (!isLikelyValidUrl(trimmed)) throw new Error("Enter a valid link");
        const fileRef = await createFileFromLink(trimmed, { kind: "resource_update", resourceId, menteeId });
        fileId = fileRef.id;
      }

      return createResourceUpdate({
        resourceId,
        menteeId,
        progressNote: progressNote.trim(),
        progressPercent: progressPercent.trim() ? Number(progressPercent) : null,
        hoursSpent: hoursSpent.trim() ? Number(hoursSpent) : null,
        fileId,
      });
    },
    onSuccess: () => {
      setProgressNote("");
      setProgressPercent("");
      setHoursSpent("");
      setLinkUrl("");
      setLinkError(null);
      queryClient.invalidateQueries({ queryKey: ["resource-updates", resourceId] });
      onCreated?.();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!progressNote.trim()) return;
    if (linkUrl.trim() && !isLikelyValidUrl(linkUrl)) {
      setLinkError("Enter a valid link");
      return;
    }
    setLinkError(null);
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-primary/70 dark:text-text-primary/70">What did you work on?</span>
        <textarea
          value={progressNote}
          onChange={(e) => setProgressNote(e.target.value)}
          required
          rows={3}
          placeholder="Log your progress…"
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 dark:bg-white/5 dark:border-white/10 dark:text-text-primary"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-primary/70 dark:text-text-primary/70">Progress %</span>
          <input
            type="number"
            min={0}
            max={100}
            value={progressPercent}
            onChange={(e) => setProgressPercent(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 dark:bg-white/5 dark:border-white/10 dark:text-text-primary"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-primary/70 dark:text-text-primary/70">Hours spent</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={hoursSpent}
            onChange={(e) => setHoursSpent(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 dark:bg-white/5 dark:border-white/10 dark:text-text-primary"
          />
        </label>
      </div>

      {/* <UploadBox
        value={file}
        onChange={setFile}
        multiple={false}
        label="Attach a file (optional)"
        uploadContext={{ kind: "resource_update", resourceId, menteeId }}
      /> */}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-primary/70 dark:text-text-primary/70">
          Link to your work (optional)
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
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive dark:bg-destructive/15">
          {linkError}
        </p>
      )}
      {mutation.isError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive dark:bg-destructive/15">
          Couldn&apos;t save your update. Try again.
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="self-start rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mutation.isPending ? "Saving…" : "Log update"}
      </button>
    </form>
  );
}