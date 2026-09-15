// /components/meetings/MeetingFormModal.tsx

"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import type { UserCardPerson } from "@/components/shared/UserCard";
import { fetchInviteCandidates } from "@/lib/api/meetings";
import { useRole } from "@/providers/role-provider";
import type { CreateMeetingInput, InviteCandidate } from "@/types/meetings";

export interface MeetingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
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

interface CandidateWithPod extends UserCardPerson {
  podId?: string;
  podName?: string;
}

function toCandidatePerson(candidate: InviteCandidate): CandidateWithPod {
  return {
    id: candidate.id,
    fullName: candidate.full_name,
    role: candidate.role,
    approvalStatus: "approved",
    podId: candidate.podId,
    podName: candidate.podName,
  };
}

export function MeetingFormModal({
  isOpen,
  onClose,
  currentUserId,
  initialStartsAt,
}: MeetingFormModalProps): React.JSX.Element {
  return (
    <Modal open={isOpen} onClose={onClose} title="Schedule a meeting">
      {isOpen && (
        <MeetingFormFields
          currentUserId={currentUserId}
          initialStartsAt={initialStartsAt}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

interface MeetingFormFieldsProps {
  currentUserId: string;
  initialStartsAt?: string;
  onClose: () => void;
}

function MeetingFormFields({
  currentUserId,
  initialStartsAt,
  onClose,
}: MeetingFormFieldsProps): React.JSX.Element {
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
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  // Track which team sections are collapsed — all start collapsed.
  const [collapsedTeams, setCollapsedTeams] = React.useState<Set<string>>(new Set());
  const [allCollapsed, setAllCollapsed] = React.useState(true);

  const isStartInFuture = startsAt !== "" && new Date(startsAt).getTime() >= mountTime;
  const minStartsAt = toLocalInputValue(new Date().toISOString());

  const isRangeValid = React.useMemo(() => {
    if (!startsAt || !endsAt) return true;
    return new Date(startsAt).getTime() < new Date(endsAt).getTime();
  }, [startsAt, endsAt]);

  const candidatesQuery = useQuery({
    queryKey: ["meeting-invite-candidates", currentUserId, role],
    queryFn: () => {
      if (!role) throw new Error("Role not loaded yet");
      return fetchInviteCandidates(currentUserId, role);
    },
    enabled: role !== null,
  });

  const allCandidates: CandidateWithPod[] = React.useMemo(
    () => (candidatesQuery.data ?? []).map(toCandidatePerson),
    [candidatesQuery.data]
  );

  // Build team groups once from candidates.
  const teamGroups: { key: string; label: string; members: CandidateWithPod[] }[] =
    React.useMemo(() => {
      const map = new Map<string, { label: string; members: CandidateWithPod[] }>();
      const ungrouped: CandidateWithPod[] = [];

      for (const c of allCandidates) {
        if (c.podId) {
          const existing = map.get(c.podId);
          if (existing) {
            existing.members.push(c);
          } else {
            map.set(c.podId, { label: c.podName ?? c.podId, members: [c] });
          }
        } else {
          ungrouped.push(c);
        }
      }

      const groups = Array.from(map.entries())
        .map(([key, val]) => ({ key, label: val.label, members: val.members }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

      if (ungrouped.length > 0) {
        groups.push({ key: "__no_team__", label: "No team", members: ungrouped });
      }

      return groups;
    }, [allCandidates]);

  // Initialise all teams as collapsed on first load.
  React.useEffect(() => {
    if (teamGroups.length > 0 && collapsedTeams.size === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsedTeams(new Set(teamGroups.map((g) => g.key)));
    }
  }, [teamGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered list for search — flat, no grouping.
  const searchResults: CandidateWithPod[] = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return allCandidates.filter((c) =>
      (c.fullName ?? "").toLowerCase().includes(term)
    );
  }, [searchTerm, allCandidates]);

  const isSearching = searchTerm.trim().length > 0;

  function toggleTeam(key: string) {
    setCollapsedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllTeams() {
    if (allCollapsed) {
      setCollapsedTeams(new Set());
      setAllCollapsed(false);
    } else {
      setCollapsedTeams(new Set(teamGroups.map((g) => g.key)));
      setAllCollapsed(true);
    }
  }

  function toggleMember(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }

  function toggleGroupAll(memberIds: string[], allSelected: boolean) {
    if (memberIds.length === 0) return;
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !memberIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...memberIds])));
    }
  }

  const selectedSet = new Set(selectedIds);

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
      {/* Title */}
      <div className="flex flex-col gap-1">
        <label
          className="text-sm font-medium text-text-primary dark:text-text-primary"
          htmlFor="meeting-title"
        >
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

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label
          className="text-sm font-medium text-text-primary dark:text-text-primary"
          htmlFor="meeting-description"
        >
          Description{" "}
          <span className="text-text-primary/50 dark:text-text-primary/50">(optional)</span>
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

      {/* Time range */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1">
          <label
            className="text-sm font-medium text-text-primary dark:text-text-primary"
            htmlFor="meeting-starts"
          >
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
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary aria-[invalid=true]:border-destructive dark:border-border dark:bg-surface dark:text-text-primary"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label
            className="text-sm font-medium text-text-primary dark:text-text-primary"
            htmlFor="meeting-ends"
          >
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
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary aria-[invalid=true]:border-destructive dark:border-border dark:bg-surface dark:text-text-primary"
          />
        </div>
      </div>

      {!isStartInFuture && (
        <p className="text-sm text-destructive">Start time can&apos;t be in the past.</p>
      )}
      {!isRangeValid && (
        <p className="text-sm text-destructive">End time must be after the start time.</p>
      )}

      {/* ── Participant picker ──────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary dark:text-text-primary">
            Invite
            {selectedIds.length > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                {selectedIds.length}
              </span>
            )}
          </span>
          {!isSearching && teamGroups.length > 0 && (
            <button
              type="button"
              onClick={toggleAllTeams}
              className="text-xs font-medium text-text-accent hover:underline"
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search people…"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted dark:border-border dark:bg-white/5 dark:text-text-primary"
        />

        {/* Selected chips */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedIds.map((id) => {
              const person = allCandidates.find((c) => c.id === id);
              if (!person) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card-alt px-2.5 py-1 text-xs font-medium text-text-primary dark:border-white/10 dark:bg-white/5"
                >
                  {person.fullName ?? "Unnamed"}
                  <button
                    type="button"
                    onClick={() => toggleMember(id)}
                    aria-label={`Remove ${person.fullName}`}
                    className="ml-0.5 text-text-muted hover:text-destructive"
                  >
                    <X size={11} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {candidatesQuery.isLoading ? (
          <p className="text-sm text-text-muted">Loading people…</p>
        ) : (
          /* Fixed-height scrollable container — doesn't push the whole
             modal into an infinite scroll */
          <div className="max-h-64 overflow-y-auto rounded-xl border border-border dark:border-white/10">
            {isSearching ? (
              /* Flat search results — no team grouping, team shown as chip */
              <div className="flex flex-col divide-y divide-border dark:divide-white/10">
                {searchResults.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-text-muted">
                    No one matches that search.
                  </p>
                ) : (
                  searchResults.map((person) => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      selected={selectedSet.has(person.id)}
                      onToggle={() => toggleMember(person.id)}
                      showTeamChip
                    />
                  ))
                )}
              </div>
            ) : (
              /* Grouped by team — each team collapsible */
              <div className="flex flex-col divide-y divide-border dark:divide-white/10">
                {teamGroups.map((group) => {
                  const memberIds = group.members.map((m) => m.id);
                  const selectedCount = memberIds.filter((id) => selectedSet.has(id)).length;
                  const allSelected =
                    memberIds.length > 0 && selectedCount === memberIds.length;
                  const someSelected = selectedCount > 0 && !allSelected;
                  const isCollapsed = collapsedTeams.has(group.key);

                  return (
                    <div key={group.key}>
                      {/* Team header row */}
                      <div className="flex items-center gap-2 bg-card px-3 py-2 dark:bg-card">
                        {/* Expand/collapse toggle */}
                        <button
                          type="button"
                          onClick={() => toggleTeam(group.key)}
                          aria-label={isCollapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-muted hover:text-text-primary"
                        >
                          {isCollapsed ? (
                            <ChevronRight size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>

                        {/* Select-all checkbox */}
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected;
                          }}
                          onChange={() => toggleGroupAll(memberIds, allSelected)}
                          disabled={memberIds.length === 0}
                          className="h-3.5 w-3.5 accent-[var(--color-nazaria-burgundy)]"
                          aria-label={`Select all in ${group.label}`}
                        />

                        <button
                          type="button"
                          onClick={() => toggleTeam(group.key)}
                          className="flex-1 text-left text-sm font-semibold text-text-muted dark:text-text-muted"
                        >
                          {group.label}
                        </button>

                        <span className="shrink-0 text-xs text-text-muted">
                          {selectedCount}/{memberIds.length}
                        </span>
                      </div>

                      {/* Members — hidden when collapsed */}
                      {!isCollapsed && (
                        <div className="flex flex-col divide-y divide-border dark:divide-white/10">
                          {group.members.map((person) => (
                            <PersonRow
                              key={person.id}
                              person={person}
                              selected={selectedSet.has(person.id)}
                              onToggle={() => toggleMember(person.id)}
                              indented
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {mutation.isError && (
        <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
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

// ── PersonRow ─────────────────────────────────────────────────────────────
// Lightweight inline component — avoids importing the full UserCard which
// carries selection/committed logic not needed here, and keeps the meeting
// form's participant picker self-contained.

interface PersonRowProps {
  person: CandidateWithPod;
  selected: boolean;
  onToggle: () => void;
  indented?: boolean;
  showTeamChip?: boolean;
}

function PersonRow({ person, selected, onToggle, indented, showTeamChip }: PersonRowProps) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-card-alt dark:hover:bg-white/5 ${
        indented ? "pl-10" : ""
      } ${selected ? "bg-primary/5 dark:bg-primary/10" : ""}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="h-3.5 w-3.5 shrink-0 accent-[var(--color-nazaria-burgundy)]"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary dark:text-text-primary">
          {person.fullName ?? "Unnamed"}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {person.role && (
            <span className="text-xs capitalize text-text-muted dark:text-text-muted">
              {person.role}
            </span>
          )}
          {showTeamChip && person.podName && (
            <span className="rounded-full border border-border bg-card-alt px-1.5 py-0.5 text-[10px] font-medium text-text-muted dark:border-white/10 dark:bg-white/5">
              {person.podName}
            </span>
          )}
        </div>
      </div>
    </label>
  );
}