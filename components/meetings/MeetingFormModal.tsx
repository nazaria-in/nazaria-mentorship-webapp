// /components/meetings/MeetingFormModal.tsx

"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/shared/Modal";
import { PeopleGrid, type ExplicitGroup } from "@/components/shared/PeopleGrid";
import type { UserCardPerson } from "@/components/shared/UserCard";
import { fetchInviteCandidates } from "@/lib/api/meetings";
import { useRole } from "@/providers/role-provider";
import type { CreateMeetingInput, InviteCandidate } from "@/types/meetings";
import type { FilterFieldDef } from "@/lib/filtering/types";

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

interface CandidatePerson extends UserCardPerson {
  podId?: string;
  podName?: string;
}

const NO_TEAM_KEY = "__no_team__";

function toCandidatePerson(candidate: InviteCandidate): CandidatePerson {
  return {
    id: candidate.id,
    fullName: candidate.full_name,
    role: candidate.role,
    approvalStatus: "approved",
    podId: candidate.podId,
    podName: candidate.podName,
  };
}

const INVITE_FIELD_DEFS: FilterFieldDef[] = [
  { key: "search", kind: "text", columns: ["full_name"], searchable: true },
];

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
  const [mountTime] = React.useState(() => Date.now());

  // This is pure during render because `mountTime` never changes after the initial render
  const isStartInFuture = startsAt !== "" && new Date(startsAt).getTime() >= mountTime;
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // Floor for the "Starts" picker — can't schedule a meeting in the past.
  // Recomputed on every render on purpose (cheap, and "now" moving forward
  // while the modal sits open is the correct behavior, not a bug).
  const minStartsAt = toLocalInputValue(new Date().toISOString());

  // Derived during render — no effect needed.
  const isRangeValid = React.useMemo(() => {
    if (!startsAt || !endsAt) return true; // let `required` handle empty fields
    return new Date(startsAt).getTime() < new Date(endsAt).getTime();
  }, [startsAt, endsAt]);

  // `role` is `Role | null` while the session is still resolving. Rather
  // than cast past the null, gate the query on role being resolved so
  // queryFn is never actually invoked with null — no cast needed to
  // satisfy fetchInviteCandidates' parameter type.
  const candidatesQuery = useQuery({
    queryKey: ["meeting-invite-candidates", currentUserId, role],
    queryFn: () => {
      if (!role) {
        return Promise.reject(new Error("Role not loaded yet"));
      }
      return fetchInviteCandidates(currentUserId, role);
    },
    enabled: role !== null,
  });

  const candidatePeople = React.useMemo(
    () => (candidatesQuery.data ?? []).map(toCandidatePerson),
    [candidatesQuery.data]
  );

  // Real team groups derived from the candidates themselves (podId/podName
  // now come from fetchInviteCandidates, not a hopeful cast). A "No team"
  // group is appended for anyone without a podId, but only if such people
  // exist — an all-team-affiliated org shouldn't show a permanent empty
  // "No team" bucket.
  const teamGroups: ExplicitGroup[] = React.useMemo(() => {
    const seen = new Map<string, string>();
    let hasUnaffiliated = false;
    for (const p of candidatePeople) {
      if (p.podId) {
        if (!seen.has(p.podId)) seen.set(p.podId, p.podName ?? p.podId);
      } else {
        hasUnaffiliated = true;
      }
    }
    const groups: ExplicitGroup[] = Array.from(seen.entries()).map(([key, label]) => ({ key, label }));
    if (hasUnaffiliated) groups.push({ key: NO_TEAM_KEY, label: "No team" });
    return groups;
  }, [candidatePeople]);

  const mutation = useMutation({
    mutationFn: createMeetingRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["meetings"] });
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!title.trim() || selectedIds.length === 0 || !isRangeValid || !isStartInFuture) return;

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
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-primary dark:text-text-primary" htmlFor="meeting-title">
          Title
        </label>
        <input
          id="meeting-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g. Weekly check-in"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary dark:border-border dark:bg-white/5 dark:text-text-primary"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-primary dark:text-text-primary" htmlFor="meeting-description">
          Description <span className="text-text-primary/50 dark:text-text-primary/50">(optional)</span>
        </label>
        <textarea
          id="meeting-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What's this meeting about?"
          className="resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary dark:border-border dark:bg-white/5 dark:text-text-primary"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm font-medium text-text-primary dark:text-text-primary" htmlFor="meeting-starts">
            Starts
          </label>
          <input
            id="meeting-starts"
            type="datetime-local"
            value={startsAt}
            min={minStartsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            aria-invalid={!isStartInFuture}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary aria-[invalid=true]:border-destructive dark:border-border dark:bg-surface dark:text-text-primary dark:aria-[invalid=true]:border-destructive"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm font-medium text-text-primary dark:text-text-primary" htmlFor="meeting-ends">
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
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary aria-[invalid=true]:border-destructive dark:border-border dark:bg-surface dark:text-text-primary dark:aria-[invalid=true]:border-destructive"
          />
        </div>
      </div>

      {!isStartInFuture && (
        <p className="text-sm text-destructive dark:text-destructive">Start time can&apos;t be in the past.</p>
      )}
      {!isRangeValid && (
        <p className="text-sm text-destructive dark:text-destructive">End time must be after the start time.</p>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text-primary dark:text-text-primary">Invite</span>
        {/*
          explicitGroups carries every team the candidate pool touches
          (built from real podId/podName on each candidate, not a cast),
          so a team with zero OTHER members still shows up with a working
          — if inert — select-all. groupKeyFn falls back to NO_TEAM_KEY for
          anyone without a podId; PeopleGrid buckets any stragglers whose
          key isn't in explicitGroups into a trailing "Other" group, so
          nobody silently disappears if the two ever drift.
        */}
        {candidatesQuery.isLoading ? (
          <p className="text-sm text-text-muted dark:text-text-muted">Loading people…</p>
        ) : (
          <PeopleGrid
            fieldDefs={INVITE_FIELD_DEFS}
            viewKey="meeting-invite-participants"
            queryKey={["meeting-invite-candidates-picker", candidatesQuery.dataUpdatedAt]}
            queryFn={async (filterState) => {
              const term = filterState.search?.trim().toLowerCase();
              return term
                ? candidatePeople.filter((p) => (p.fullName ?? "").toLowerCase().includes(term))
                : candidatePeople;
            }}
            groupBy="pod"
            groupKeyFn={(p) => (p as CandidatePerson).podId ?? NO_TEAM_KEY}
            explicitGroups={teamGroups}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            emptyMessage="No one matches that search."
            defaultView="list"
          />
        )}
      </div>

      {mutation.isError && (
        <p className="text-sm text-destructive dark:text-destructive">{(mutation.error as Error).message}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border px-4 py-2 text-sm text-text-primary hover:bg-card dark:border-border dark:text-text-primary dark:hover:bg-card"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={
            mutation.isPending ||
            !title.trim() ||
            selectedIds.length === 0 ||
            !isRangeValid ||
            !isStartInFuture
          }
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
        >
          {mutation.isPending ? "Scheduling…" : "Schedule meeting"}
        </button>
      </div>
    </form>
  );
}