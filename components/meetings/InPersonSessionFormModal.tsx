// /components/meetings/InPersonSessionFormModal.tsx

"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/shared/Modal";
import { createInPersonSessionSeries } from "@/lib/api/in-person-sessions";
import type { RecurrenceType } from "@/types/in-person-sessions";

export interface InPersonSessionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  cohortId: string | null;
  /** Prefilled from clicking an empty timeline slot, same pattern as MeetingFormModal. */
  initialStartsAt?: string;
  /** Query keys to invalidate on success, e.g. [["in-person-sessions", cohortId]]. */
  invalidateQueryKeys?: unknown[][];
}

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const INITIAL_OCCURRENCE_COUNT = 12; // ~3 months of weekly sessions materialized up front

function toTimeInputValue(iso: string | undefined): string {
  if (!iso) return "09:00";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function InPersonSessionFormModal({
  isOpen,
  onClose,
  currentUserId,
  cohortId,
  initialStartsAt,
  invalidateQueryKeys = [],
}: InPersonSessionFormModalProps): React.JSX.Element {
  const queryClient = useQueryClient();

  // Track the prev prop to reset state synchronously during render when modal opens
  const [prevIsOpen, setPrevIsOpen] = React.useState(isOpen);
  const [prevInitialStartsAt, setPrevInitialStartsAt] = React.useState(initialStartsAt);

  const [title, setTitle] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [recurrence, setRecurrence] = React.useState<RecurrenceType>("weekly");
  const [dayOfWeek, setDayOfWeek] = React.useState<number>(() =>
    initialStartsAt ? new Date(initialStartsAt).getDay() : 1,
  );
  const [startTime, setStartTime] = React.useState(() => toTimeInputValue(initialStartsAt));
  const [endTime, setEndTime] = React.useState("11:00");

  // Synchronous state adjustment during render when the modal opens or initial state changes
  if (isOpen !== prevIsOpen || initialStartsAt !== prevInitialStartsAt) {
    setPrevIsOpen(isOpen);
    setPrevInitialStartsAt(initialStartsAt);

    if (isOpen) {
      setTitle("");
      setLocation("");
      setDescription("");
      setRecurrence("weekly");
      setDayOfWeek(initialStartsAt ? new Date(initialStartsAt).getDay() : 1);
      setStartTime(toTimeInputValue(initialStartsAt));
      setEndTime("11:00");
    }
  }

  const isFormValid = title.trim().length > 0 && startTime < endTime;

  const createMutation = useMutation({
    mutationFn: () =>
      createInPersonSessionSeries(currentUserId, {
        title: title.trim(),
        location: location.trim() || null,
        description: description.trim() || null,
        recurrence,
        recurrenceUntil: null,
        dayOfWeek: recurrence === "none" ? null : dayOfWeek,
        defaultStartsAt: `${startTime}:00`,
        defaultEndsAt: `${endTime}:00`,
        cohortId,
        initialOccurrenceCount: recurrence === "none" ? 1 : INITIAL_OCCURRENCE_COUNT,
      }),
    onSuccess: () => {
      for (const key of invalidateQueryKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      onClose();
    },
  });

  return (
    <Modal open={isOpen} onClose={onClose} title="New in-person session">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (isFormValid) createMutation.mutate();
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-primary">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Saturday studio session"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-primary">Location</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Community hall, Sector 12"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-primary">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
          />
        </label>

        <fieldset className="surface-card-alt flex flex-col gap-3">
          <legend className="px-1 text-sm font-medium text-text-primary">Repeats</legend>

          <div className="flex gap-2">
            {(["none", "weekly"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRecurrence(option)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  recurrence === option
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-text-primary hover:bg-card"
                }`}
              >
                {option === "none" ? "One time" : "Every week"}
              </button>
            ))}
          </div>

          {recurrence === "weekly" && (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-text-muted">Day of week</span>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
              >
                {WEEKDAY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm text-text-muted">Start time</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm text-text-muted">End time</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
              />
            </label>
          </div>

          {recurrence === "weekly" && (
            <p className="text-xs text-text-muted">
              This creates the next {INITIAL_OCCURRENCE_COUNT} weekly occurrences. Each week can be edited or
              cancelled individually afterward without affecting the others.
            </p>
          )}
        </fieldset>

        {createMutation.isError && (
          <p className="text-sm text-destructive">Something went wrong — please try again.</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-primary hover:bg-card-alt"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isFormValid || createMutation.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating…" : "Create session"}
          </button>
        </div>
      </form>
    </Modal>
  );
}