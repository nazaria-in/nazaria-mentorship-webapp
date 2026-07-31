// components/assignments/AssignmentFormModal.tsx

"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/shared/Modal";
import { AssignmentTemplateForm } from "@/components/assignments/AssignmentTemplateForm";
import { PeopleGrid } from "@/components/shared/PeopleGrid";
import { fetchSelectablePeople } from "@/lib/api/people-picker";
import { fetchAssignment } from "@/lib/api/assignments";
import { dispatchAssignment, fetchAssignedMenteeRefs, removeMenteeAssignment } from "@/lib/api/mentee-assignments";
import type { AssignmentWithSlots } from "@/types/assignments";
import type { FilterFieldDef } from "@/lib/filtering/types";

const PICKER_FIELD_DEFS: FilterFieldDef[] = [
  { key: "search", kind: "text", columns: ["full_name"], searchable: true },
];

export interface AssignmentFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  assignmentId?: string;
  currentUserId: string;
  scopeToMentorId?: string;
  onSaved: () => void;
}

type Step = "details" | "roster";

export function AssignmentFormModal({
  open,
  onClose,
  mode,
  assignmentId,
  currentUserId,
  scopeToMentorId,
  onSaved,
}: AssignmentFormModalProps) {
  const [step, setStep] = React.useState<Step>("details");
  const [workingAssignment, setWorkingAssignment] = React.useState<AssignmentWithSlots | null>(null);
  const [selectedMenteeIds, setSelectedMenteeIds] = React.useState<string[]>([]);
  const [dueAt, setDueAt] = React.useState("");
  const [locallyRemovedIds, setLocallyRemovedIds] = React.useState<Set<string>>(new Set());

  const { data: existingAssignment, isLoading: loadingAssignment } = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: () => fetchAssignment(assignmentId!),
    enabled: open && mode === "edit" && !!assignmentId,
  });

  const isInitialized = React.useRef(false);

  const { data: assignedRefs, isLoading: loadingRoster } = useQuery({
    queryKey: ["assigned-mentee-refs", assignmentId],
    queryFn: () => fetchAssignedMenteeRefs(assignmentId!),
    enabled: open && mode === "edit" && !!assignmentId && step === "roster",
    select: (data) => {
      if (!isInitialized.current && mode === "edit") {
        setSelectedMenteeIds(data.map((r) => r.menteeId));
        isInitialized.current = true;
      }
      return data;
    },
  });

  const committedIds = React.useMemo(() => (assignedRefs ?? []).map((r) => r.menteeId), [assignedRefs]);
  const effectiveCommittedIds = React.useMemo(
    () => committedIds.filter((id) => !locallyRemovedIds.has(id)),
    [committedIds, locallyRemovedIds]
  );
  const menteeIdToAssignmentId = React.useMemo(() => {
    const map = new Map<string, string>();
    (assignedRefs ?? []).forEach((r) => map.set(r.menteeId, r.menteeAssignmentId));
    return map;
  }, [assignedRefs]);

  const rosterTarget = workingAssignment ?? existingAssignment ?? null;

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!rosterTarget) throw new Error("No assignment to assign mentees to");
      const newIds = selectedMenteeIds.filter((id) => !effectiveCommittedIds.includes(id));
      if (newIds.length === 0) return;
      return dispatchAssignment({
        assignmentId: rosterTarget.id,
        menteeIds: newIds,
        assignedBy: currentUserId,
        dueAt: dueAt || rosterTarget.end_date || rosterTarget.start_date,
        assignmentTitle: rosterTarget.title,
        assignmentStartDate: rosterTarget.start_date,
      });
    },
    onSuccess: () => {
      reset();
      onClose();
      onSaved();
    },
  });

  async function handleRemoveCommitted(menteeId: string) {
    const menteeAssignmentId = menteeIdToAssignmentId.get(menteeId);
    if (!menteeAssignmentId) return;
    await removeMenteeAssignment(menteeAssignmentId);
    setLocallyRemovedIds((prev) => new Set(prev).add(menteeId));
  }

  function reset() {
    setStep("details");
    setWorkingAssignment(null);
    setSelectedMenteeIds([]);
    setDueAt("");
    setLocallyRemovedIds(new Set());
    isInitialized.current = false;
  }

  function handleClose() {
    reset();
    onClose();
  }

  const canFinish = mode === "create" ? selectedMenteeIds.length > 0 : true;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === "details" ? (mode === "create" ? "Create assignment" : "Edit assignment") : "Manage mentees"}
      description={
        step === "details"
          ? "Set up the assignment and its submission slots."
          : "Choose which mentees should receive this assignment, and by when it's due for new additions."
      }
      className="max-w-xl"
    >
      {step === "details" ? (
        loadingAssignment && mode === "edit" ? (
          <p className="p-4 text-sm text-text-primary/50">Loading assignment…</p>
        ) : (
          <AssignmentTemplateForm
            mode={mode}
            initialValues={mode === "edit" ? existingAssignment : undefined}
            createdBy={currentUserId}
            onSaved={(assignment) => {
              setWorkingAssignment(assignment);
              if (!dueAt) setDueAt(assignment.end_date ?? assignment.start_date);
              setStep("roster");
            }}
            onCancel={handleClose}
          />
        )
      ) : (
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-primary/70">Due date for newly added mentees</span>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 dark:bg-white/5 dark:border-border"
            />
          </label>

          {mode === "edit" && loadingRoster ? (
            <p className="text-xs text-text-primary/50">Loading current roster…</p>
          ) : (
            <PeopleGrid
              fieldDefs={PICKER_FIELD_DEFS}
              viewKey={`assignment-roster-${assignmentId ?? "new"}`}
              queryKey={["selectable-mentees", scopeToMentorId ?? "all"]}
              queryFn={(filterState) =>
                fetchSelectablePeople({ role: "mentee", mentorId: scopeToMentorId }, filterState.search)
              }
              groupBy="pod"
              groupKeyFn={(p) => (p as { podName?: string }).podName ?? "No pod"}
              selectable
              selectedIds={selectedMenteeIds}
              onSelectionChange={setSelectedMenteeIds}
              alreadyCommittedIds={mode === "edit" ? effectiveCommittedIds : undefined}
              onRemoveCommitted={mode === "edit" ? handleRemoveCommitted : undefined}
              removalWarningTitle="Remove from this assignment?"
              removalWarningDescription={(names) =>
                `This assignment has already been assigned to ${names.join(", ")}. Do you wish to remove ${
                  names.length > 1 ? "them" : "this mentee"
                } from the assignment list? This can't be undone.`
              }
              emptyMessage="No pods with mentees found."
            />
          )}

          {dispatchMutation.isError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive dark:bg-destructive/15">
              Couldn&apos;t update the mentee list. Try again.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canFinish || dispatchMutation.isPending}
              onClick={() => dispatchMutation.mutate()}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dispatchMutation.isPending
                ? "Saving…"
                : mode === "create"
                ? `Assign to ${selectedMenteeIds.length || ""} mentee${selectedMenteeIds.length === 1 ? "" : "s"}`
                : "Done"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}