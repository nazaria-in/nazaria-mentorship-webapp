// components/assignments/CreateAssignmentModal.tsx
"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/shared/Modal";
import { AssignmentTemplateForm } from "@/components/assignments/AssignmentTemplateForm";
import { fetchUsersByApproval } from "@/lib/api/users";
import { dispatchAssignment } from "@/lib/api/mentee-assignments";
import type { AssignmentWithSlots } from "@/types/assignments";

export interface CreateAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  createdBy: string;
  /** Called once the assignment (and optional dispatch) is fully done, so the caller can refetch its list. */
  onCreated: () => void;
}

type Step = "details" | "dispatch";

export function CreateAssignmentModal({ open, onClose, createdBy, onCreated }: CreateAssignmentModalProps) {
  const [step, setStep] = React.useState<Step>("details");
  const [createdAssignment, setCreatedAssignment] = React.useState<AssignmentWithSlots | null>(null);
  const [selectedMenteeIds, setSelectedMenteeIds] = React.useState<string[]>([]);
  const [dueAt, setDueAt] = React.useState("");

  const { data: mentees, isLoading: loadingMentees } = useQuery({
    queryKey: ["users", "mentees", "approved"],
    queryFn: () => fetchUsersByApproval({ role: "mentee", status: "approved" }),
    enabled: open && step === "dispatch",
  });

  const dispatchMutation = useMutation({
    mutationFn: () => {
      if (!createdAssignment) throw new Error("No assignment to dispatch");
      return dispatchAssignment({
        assignmentId: createdAssignment.id,
        menteeIds: selectedMenteeIds,
        assignedBy: createdBy,
        dueAt: dueAt || createdAssignment.end_date || createdAssignment.start_date,
      });
    },
    onSuccess: () => {
      reset();
      onClose();
      onCreated();
    },
  });

  function reset() {
    setStep("details");
    setCreatedAssignment(null);
    setSelectedMenteeIds([]);
    setDueAt("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function toggleMentee(id: string) {
    setSelectedMenteeIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === "details" ? "Create assignment" : "Assign to mentees"}
      description={
        step === "details"
          ? "Set up the assignment and its submission slots."
          : "Choose which mentees should receive this assignment, and by when it's due for them."
      }
      className="max-w-xl"
    >
      {step === "details" ? (
        <AssignmentTemplateForm
          mode="create"
          createdBy={createdBy}
          onSaved={(assignment) => {
            setCreatedAssignment(assignment);
            setDueAt(assignment.end_date ?? assignment.start_date);
            setStep("dispatch");
          }}
          onCancel={handleClose}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-primary/70">Due date for mentees</span>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 dark:bg-white/5 dark:border-white/10"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-text-primary/70">Mentees</span>
            {loadingMentees ? (
              <p className="text-xs text-text-primary/50">Loading mentees…</p>
            ) : !mentees || mentees.length === 0 ? (
              <p className="text-xs text-text-primary/50">No approved mentees found.</p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-xl border border-border p-2 dark:border-white/10">
                {mentees.map((mentee) => (
                  <li key={mentee.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface-muted dark:hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={selectedMenteeIds.includes(mentee.id)}
                        onChange={() => toggleMentee(mentee.id)}
                        className="h-3.5 w-3.5"
                      />
                      {mentee.full_name ?? mentee.school_or_org ?? mentee.id}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {dispatchMutation.isError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive dark:bg-destructive/15">
              Couldn&apos;t dispatch this assignment. Try again.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={selectedMenteeIds.length === 0 || !dueAt || dispatchMutation.isPending}
              onClick={() => dispatchMutation.mutate()}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dispatchMutation.isPending
                ? "Assigning…"
                : `Assign to ${selectedMenteeIds.length || ""} mentee${selectedMenteeIds.length === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={() => {
                handleClose();
                onCreated();
              }}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted dark:border-white/10 dark:hover:bg-white/5"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}