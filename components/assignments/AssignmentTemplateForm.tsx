// /components/assignments/AssignmentTemplateForm.tsx

"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { createAssignment, updateAssignment } from "@/lib/api/assignments";
import { SubmissionSlotEditor, type DraftSlot } from "@/components/assignments/SubmissionSlotEditor";
import type { AssignmentWithSlots } from "@/types/assignments";

export interface AssignmentTemplateFormProps {
  mode: "create" | "edit";
  initialValues?: AssignmentWithSlots;
  createdBy: string;
  onSaved: (assignment: AssignmentWithSlots) => void;
  onCancel?: () => void;
}

export function AssignmentTemplateForm({ mode, initialValues, createdBy, onSaved, onCancel }: AssignmentTemplateFormProps) {
  const [title, setTitle] = React.useState(initialValues?.title ?? "");
  const [description, setDescription] = React.useState(initialValues?.description ?? "");
  const [instructions, setInstructions] = React.useState(initialValues?.instructions ?? "");
  const [weekNumber, setWeekNumber] = React.useState<string>(initialValues?.week_number?.toString() ?? "");
  const [startDate, setStartDate] = React.useState(initialValues?.start_date ?? "");
  const [endDate, setEndDate] = React.useState(initialValues?.end_date ?? "");
  const [slots, setSlots] = React.useState<DraftSlot[]>(
    initialValues?.slots.map((s) => ({ id: s.id, title: s.title, max_versions: s.max_versions })) ?? [
      { id: crypto.randomUUID(), title: "File Title", max_versions: 4 },
    ]
  );

  // Editing is locked once the assignment has already started — the schema
  // has no `locks_at`, so this is purely an app-level rule against start_date.
  const hasStarted = mode === "edit" && !!initialValues && initialValues.start_date <= new Date().toISOString().slice(0, 10);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "create") {
        return createAssignment({
          title,
          description,
          instructions: instructions || null,
          week_number: weekNumber ? Number(weekNumber) : null,
          start_date: startDate,
          end_date: endDate || null,
          created_by: createdBy,
          slots: slots.map((s, i) => ({ title: s.title, order_index: i, max_versions: s.max_versions })),
        });
      }
      const updated = await updateAssignment({
        id: initialValues!.id,
        title,
        description,
        instructions: instructions || null,
        week_number: weekNumber ? Number(weekNumber) : null,
        start_date: startDate,
        end_date: endDate || null,
      });
      return { ...updated, slots: initialValues!.slots };
    },
    onSuccess: (result) => onSaved(result),
  });

  const canSubmit = title.trim() && description.trim() && startDate && slots.length > 0 && slots.every((s) => s.title.trim());

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mutation.mutate();
      }}
    >
      {hasStarted && (
        <div className="rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-text-primary/70">
          This assignment has started and its dates/slots can no longer be edited.
        </div>
      )}

      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={hasStarted}
          className={inputClass}
          placeholder="e.g. Week 3 — Character study"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={hasStarted}
          rows={2}
          className={inputClass}
        />
      </Field>

      <Field label="Instructions" optional>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          disabled={hasStarted}
          rows={3}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={hasStarted}
            className={inputClass}
          />
        </Field>
        <Field label="Due date" optional>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={hasStarted}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Week number" optional>
        <input
          type="number"
          value={weekNumber}
          onChange={(e) => setWeekNumber(e.target.value)}
          disabled={hasStarted}
          className={inputClass}
        />
      </Field>

      <div>
        <p className="mb-2 text-xs font-medium text-text-primary/70">Submission slots</p>
        <SubmissionSlotEditor slots={slots} onChange={setSlots} disabled={hasStarted} />
      </div>

      {mutation.isError && <p className="text-xs text-destructive">Couldn`t save. Try again.</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canSubmit || mutation.isPending || hasStarted}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : mode === "create" ? "Create assignment" : "Save changes"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-muted"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-primary/40 focus:outline-none disabled:opacity-50 dark:bg-white/5";

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-primary/70">
        {label} {optional && <span className="text-text-primary/40">(optional)</span>}
      </span>
      {children}
    </label>
  );
}