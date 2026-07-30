// /components/meetings/MeetingFormModal.tsx

"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/shared/Modal";
import { InviteParticipantsPicker } from "@/components/meetings/InviteParticipantsPicker";
import { fetchInviteCandidates } from "@/lib/api/meetings";
import { useRole } from "@/providers/role-provider";
import type { CreateMeetingInput } from "@/types/meetings";

export interface MeetingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  /** ISO string to prefill start time, e.g. when the user clicked an empty timeline slot. */
  initialStartsAt?: string;
}

interface CreateMeetingResponse {
  meeting: { id: string };
}

interface CreateMeetingErrorBody {
  error?: string;
}

async function createMeetingRequest(input: CreateMeetingInput): Promise<CreateMeetingResponse> {
  const response = await fetch("/api/meetings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      participantUserIds: input.participantUserIds,
    }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as CreateMeetingErrorBody;
    throw new Error(errorBody.error ?? "Failed to create meeting");
  }

  return (await response.json()) as CreateMeetingResponse;
}

function toLocalInputValue(iso: string | undefined): string {
  const date = iso ? new Date(iso) : new Date();
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

/**
 * Wrapper just owns the Modal chrome. The actual form (MeetingFormFields)
 * only mounts while isOpen is true — that mount/unmount cycle is what
 * resets the form on every reopen, via each useState's lazy initializer.
 * No "reset via useEffect(() => setX(...), [isOpen])" needed — React flags
 * that pattern as an anti-pattern (setState-in-effect causing an extra
 * cascading render), and this sidesteps it entirely rather than suppressing
 * the warning.
 */
export function MeetingFormModal({
  isOpen,
  onClose,
  currentUserId,
  initialStartsAt,
}: MeetingFormModalProps): React.JSX.Element {
  return (
    <Modal open={isOpen} onClose={onClose} title="Schedule a meeting">
      {isOpen && (
        <MeetingFormFields currentUserId={currentUserId} initialStartsAt={initialStartsAt} onClose={onClose} />
      )}
    </Modal>
  );
}

interface MeetingFormFieldsProps {
  currentUserId: string;
  initialStartsAt?: string;
  onClose: () => void;
}

function MeetingFormFields({ currentUserId, initialStartsAt, onClose }: MeetingFormFieldsProps): React.JSX.Element {
  const { role } = useRole();
  const queryClient = useQueryClient();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [startsAt, setStartsAt] = React.useState(() => toLocalInputValue(initialStartsAt));
  const [endsAt, setEndsAt] = React.useState(() => {
    const base = initialStartsAt ? new Date(initialStartsAt) : new Date();
    base.setHours(base.getHours() + 1);
    return toLocalInputValue(base.toISOString());
  });
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const isRangeValid = React.useMemo(() => {
    if (!startsAt || !endsAt) return true; // let `required` handle empty fields
    return new Date(startsAt).getTime() < new Date(endsAt).getTime();
  }, [startsAt, endsAt]);

  const candidatesQuery = useQuery({
    queryKey: ["meeting-invite-candidates", currentUserId, role],
    queryFn: () => fetchInviteCandidates(currentUserId, role),
  });

  const mutation = useMutation({
    mutationFn: createMeetingRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["meetings"] });
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!title.trim() || selectedIds.length === 0 || !isRangeValid) return;

    mutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      participantUserIds: selectedIds,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* ...title, description fields unchanged... */}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm font-medium text-text-primary" htmlFor="meeting-starts">
            Starts
          </label>
          <input
            id="meeting-starts"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm font-medium text-text-primary" htmlFor="meeting-ends">
            Ends
          </label>
          <input
            id="meeting-ends"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
            min={startsAt || undefined}
            aria-invalid={!isRangeValid}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary aria-[invalid=true]:border-destructive"
          />
        </div>
      </div>

      {!isRangeValid && (
        <p className="text-sm text-destructive">End time must be after the start time.</p>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text-primary">Invite</span>
        <InviteParticipantsPicker
          candidates={candidatesQuery.data ?? []}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          isLoading={candidatesQuery.isLoading}
        />
      </div>

      {mutation.isError && <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border px-4 py-2 text-sm text-text-primary hover:bg-card"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending || !title.trim() || selectedIds.length === 0 || !isRangeValid}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {mutation.isPending ? "Scheduling…" : "Schedule meeting"}
        </button>
      </div>
    </form>
  );
}