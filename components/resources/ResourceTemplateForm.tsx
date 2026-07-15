// /components/resources/ResourceTemplateForm.tsx

"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { UploadBox, type UploadedFileRef } from "@/components/shared/uploadbox/UploadBox";
import type { ResourceCourseType, ResourceFileRef, ResourceWithFiles } from "@/types/resources";
import { RESOURCE_TYPE_OPTIONS } from "@/lib/filtering/resource-fields";

export interface ResourceDraft {
  type: ResourceCourseType;
  title: string;
  description: string;
  weekNumber: number | null;
  links: string[];
  newFiles: UploadedFileRef[];
}

export interface ResourceTemplateFormProps {
  mode: "create" | "edit";
  initialValues?: ResourceWithFiles;
  onSaved: (draft: ResourceDraft) => void;
  onCancel: () => void;
  submitLabel: string;
}

export function ResourceTemplateForm({ mode, initialValues, onSaved, onCancel, submitLabel }: ResourceTemplateFormProps) {
  const [type, setType] = React.useState<ResourceCourseType>(initialValues?.type ?? "guide");
  const [title, setTitle] = React.useState(initialValues?.title ?? "");
  const [description, setDescription] = React.useState(initialValues?.description ?? "");
  const [weekNumber, setWeekNumber] = React.useState(initialValues?.week_number?.toString() ?? "");
  const [links, setLinks] = React.useState<string[]>(initialValues?.links ?? []);
  const [linkDraft, setLinkDraft] = React.useState("");
  const [newFiles, setNewFiles] = React.useState<UploadedFileRef[]>([]);

  const existingFiles: ResourceFileRef[] = initialValues?.files ?? [];

  function addLink() {
    const trimmed = linkDraft.trim();
    if (!trimmed) return;
    setLinks((prev) => [...prev, trimmed]);
    setLinkDraft("");
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    onSaved({
      type,
      title: title.trim(),
      description: description.trim(),
      weekNumber: weekNumber.trim() ? Number(weekNumber) : null,
      links,
      newFiles,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-primary/70">Type</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ResourceCourseType)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 dark:bg-white/5 dark:border-white/10"
        >
          {RESOURCE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-primary/70">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 dark:bg-white/5 dark:border-white/10"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-primary/70">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 dark:bg-white/5 dark:border-white/10"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-primary/70">Week number (optional)</span>
        <input
          type="number"
          min={0}
          value={weekNumber}
          onChange={(e) => setWeekNumber(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 dark:bg-white/5 dark:border-white/10"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-primary/70">Links (optional)</span>
        <div className="flex gap-2">
          <input
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              }
            }}
            placeholder="https://…"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 dark:bg-white/5 dark:border-white/10"
          />
          <button
            type="button"
            onClick={addLink}
            className="shrink-0 rounded-xl border border-border px-3 text-text-primary/70 hover:bg-surface-muted dark:hover:bg-white/5"
            aria-label="Add link"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {links.length > 0 && (
          <ul className="flex flex-col gap-1">
            {links.map((link, i) => (
              <li key={`${link}-${i}`} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary">
                <span className="flex-1 truncate">{link}</span>
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  aria-label="Remove link"
                  className="shrink-0 rounded-full p-0.5 text-text-primary/40 hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {mode === "edit" && existingFiles.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-primary/70">Already attached</span>
          <ul className="flex flex-col gap-1">
            {existingFiles.map((f) => (
              <li key={f.id} className="truncate rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary/70">
                {f.title ?? f.url}
              </li>
            ))}
          </ul>
        </div>
      )}

      <UploadBox value={newFiles} onChange={setNewFiles} label="Add files" helperText="Demo upload — not yet backed by real storage." />

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm font-medium text-text-primary/60 hover:bg-surface-muted dark:hover:bg-white/5">
          Cancel
        </button>
      </div>
    </form>
  );
}