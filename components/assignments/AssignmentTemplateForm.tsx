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
      { id: crypto.randomUUID(), title: "Submission Title", max_versions: 4 },
    ]
  );

  // Lock editing if the assignment has already started
  const hasStarted = mode === "edit" && !!initialValues && initialValues.start_date <= new Date().toISOString().slice(0, 10);

  const isDateRangeValid = React.useMemo(() => {
    if (!startDate || !endDate) return true; // end date is optional; nothing to compare until both are set
    return endDate >= startDate; // yyyy-MM-dd strings compare correctly lexicographically
  }, [startDate, endDate]);

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

  const canSubmit =
    !!title.trim() &&
    !!description.trim() &&
    !!startDate &&
    isDateRangeValid &&
    slots.length > 0 &&
    slots.every((s) => s.title.trim());

  return (
    <form
      className="flex flex-col gap-5 p-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mutation.mutate();
      }}
    >
      {hasStarted && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground font-medium backdrop-blur-sm">
          This assignment has started. The timeline schedules and template slots cannot be modified.
        </div>
      )}

      <Field label="Title">
        <input
          type="text"
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
          placeholder="Provide a short overview summary..."
        />
      </Field>

      <Field label="Instructions" optional>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          disabled={hasStarted}
          rows={3}
          className={inputClass}
          placeholder="Detailed submission pipeline guide, criteria requirements..."
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date">
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              const next = e.target.value;
              setStartDate(next);
              // keep due date in sync if it's now before the new start date
              setEndDate((prevEnd) => (prevEnd && prevEnd < next ? next : prevEnd));
            }}
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
            min={startDate || undefined}
            aria-invalid={!isDateRangeValid}
            className={`${inputClass} aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:border-destructive`}
          />
        </Field>
      </div>

      {!isDateRangeValid && (
        <p className="-mt-3 text-xs font-medium text-destructive">Due date can&apos;t be before the start date.</p>
      )}

      <Field label="Week number" optional>
        <input
          type="number"
          value={weekNumber}
          onChange={(e) => setWeekNumber(e.target.value)}
          disabled={hasStarted}
          className={inputClass}
          placeholder="e.g. 3"
        />
      </Field>

      <div className="space-y-2 mt-2">
        <p className="text-xs font-semibold tracking-wide uppercase text-text-primary/80">Submission slots</p>
        <div className={hasStarted ? "opacity-65 pointer-events-none" : ""}>
          <SubmissionSlotEditor slots={slots} onChange={setSlots} disabled={hasStarted} />
        </div>
      </div>

      {mutation.isError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-medium">
          Failed to commit updates. Please verify entries and retry.
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40 mt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border/80 bg-surface px-5 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface-muted hover:border-border focus:outline-none focus:ring-2 focus:ring-border/40"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit || mutation.isPending || hasStarted}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-95 disabled:bg-muted disabled:text-text-primary/40 disabled:border-transparent disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {mutation.isPending ? "Saving changes..." : mode === "create" ? "Create assignment" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-border/80 bg-background/50 px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-primary/40 backdrop-blur-xs transition focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-muted/30 disabled:text-text-primary/50 disabled:cursor-not-allowed dark:bg-white/5 dark:border-white/10 dark:focus:border-primary";

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 w-full">
      <span className="text-xs font-semibold tracking-wide uppercase text-text-primary/80">
        {label} {optional && <span className="text-text-primary/40 lowercase normal-case font-normal">(optional)</span>}
      </span>
      {children}
    </label>
  );
}