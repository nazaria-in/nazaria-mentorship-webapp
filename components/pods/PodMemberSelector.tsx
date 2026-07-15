// /components/pods/PodMemberSelector.tsx

"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPodMemberGroups } from "@/lib/api/pods";
import { WarningModal } from "@/components/shared/WarningModal";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/users";
import type { PodMember } from "@/types/pods";

export interface PodMemberSelectorProps {
  selectableRole: Extract<UserRole, "mentee" | "associate">;
  mentorId?: string;
  podId?: string;
  value: string[];
  onChange: (ids: string[]) => void;
  /**
   * IDs already committed elsewhere (e.g. already have a mentee_assignments
   * row). Pinned to the top of their pod with an "Already assigned" tag.
   * Unselecting one doesn't call onChange directly — it opens a warning
   * modal, and only removes on confirm via `onRemoveCommitted`. Omit both
   * this and `onRemoveCommitted` for plain selection (e.g. picking
   * associates) where nothing is committed yet.
   */
  alreadyCommittedIds?: string[];
  /**
   * Performs the actual removal (e.g. removeMenteeAssignment) after the
   * user confirms. Should throw/reject on failure — the modal stays open
   * and shows the error instead of closing. Required if
   * `alreadyCommittedIds` is passed.
   */
  onRemoveCommitted?: (id: string) => Promise<void>;
  /** Blocks removing the last remaining committed member — an assignment
   *  with zero mentees is an orphan. Default true whenever onRemoveCommitted is set. */
  preventEmptyCommitted?: boolean;
  removalWarningTitle?: string;
  removalWarningDescription?: (memberNames: string[]) => string;
  className?: string;
}

export function PodMemberSelector({
  selectableRole,
  mentorId,
  podId,
  value,
  onChange,
  alreadyCommittedIds,
  onRemoveCommitted,
  preventEmptyCommitted = true,
  removalWarningTitle = "Remove from this assignment?",
  removalWarningDescription,
  className,
}: PodMemberSelectorProps) {
  const { data: pods, isLoading } = useQuery({
    queryKey: ["pod-member-groups", selectableRole, mentorId, podId],
    queryFn: () => fetchPodMemberGroups({ role: selectableRole, mentorId, podId }),
  });

  const selectedSet = React.useMemo(() => new Set(value), [value]);
  const committedSet = React.useMemo(() => new Set(alreadyCommittedIds ?? []), [alreadyCommittedIds]);

  const allMembers = React.useMemo(() => (pods ?? []).flatMap((p) => p.members), [pods]);
  const nameFor = React.useCallback(
    (id: string) => allMembers.find((m) => m.id === id)?.full_name ?? "this member",
    [allMembers]
  );

  const [pendingRemovalIds, setPendingRemovalIds] = React.useState<string[] | null>(null);
  const [pendingBlocked, setPendingBlocked] = React.useState(false);
  const [removeError, setRemoveError] = React.useState<string | null>(null);
  const [isRemoving, setIsRemoving] = React.useState(false);

  function requestRemoval(ids: string[]) {
    const remainder = value.length - ids.length;
    if (preventEmptyCommitted && onRemoveCommitted && remainder <= 0) {
      setPendingBlocked(true);
      return;
    }
    setRemoveError(null);
    setPendingRemovalIds(ids);
  }

  function toggleMember(id: string) {
    const isSelected = selectedSet.has(id);
    if (isSelected && committedSet.has(id) && onRemoveCommitted) {
      requestRemoval([id]);
      return;
    }
    onChange(isSelected ? value.filter((v) => v !== id) : [...value, id]);
  }

  function togglePod(memberIds: string[], allSelected: boolean) {
    if (allSelected) {
      const committedInPod = onRemoveCommitted ? memberIds.filter((id) => committedSet.has(id)) : [];
      const plainRemovable = memberIds.filter((id) => !committedInPod.includes(id));
      if (plainRemovable.length > 0) onChange(value.filter((id) => !plainRemovable.includes(id)));
      if (committedInPod.length > 0) requestRemoval(committedInPod);
    } else {
      const merged = new Set(value);
      memberIds.forEach((id) => merged.add(id));
      onChange(Array.from(merged));
    }
  }

  async function confirmRemoval() {
    if (!pendingRemovalIds || !onRemoveCommitted) return;
    setIsRemoving(true);
    setRemoveError(null);
    try {
      for (const id of pendingRemovalIds) {
        await onRemoveCommitted(id);
      }
      onChange(value.filter((id) => !pendingRemovalIds.includes(id)));
      setPendingRemovalIds(null);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Couldn't remove this mentee. Try again.");
    } finally {
      setIsRemoving(false);
    }
  }

  if (isLoading) {
    return <p className="text-xs text-text-primary/50 dark:text-text-primary/60">Loading pods…</p>;
  }

  if (!pods || pods.length === 0) {
    return (
      <p className="text-xs text-text-primary/50 dark:text-text-primary/60">
        No pods with {selectableRole === "mentee" ? "mentees" : "associates"} found.
      </p>
    );
  }

  return (
    <>
      <div className={cn("flex max-h-80 flex-col gap-3 overflow-y-auto pr-1", className)}>
        {pods.map((pod) => {
          const memberIds = pod.members.map((m) => m.id);
          const selectedCount = memberIds.filter((id) => selectedSet.has(id)).length;
          const allSelected = memberIds.length > 0 && selectedCount === memberIds.length;
          const someSelected = selectedCount > 0 && !allSelected;
          const sortedMembers = [...pod.members].sort((a, b) => {
            const aC = committedSet.has(a.id) ? 0 : 1;
            const bC = committedSet.has(b.id) ? 0 : 1;
            return aC !== bC ? aC - bC : a.full_name.localeCompare(b.full_name);
          });

          return (
            <PodCard
              key={pod.id}
              name={pod.name}
              members={sortedMembers}
              selectedSet={selectedSet}
              committedSet={committedSet}
              allSelected={allSelected}
              someSelected={someSelected}
              onToggleAll={() => togglePod(memberIds, allSelected)}
              onToggleMember={toggleMember}
            />
          );
        })}
      </div>

      <WarningModal
        open={!!pendingRemovalIds}
        onClose={() => {
          if (!isRemoving) {
            setPendingRemovalIds(null);
            setRemoveError(null);
          }
        }}
        onConfirm={confirmRemoval}
        variant="danger"
        title={removalWarningTitle}
        description={
          pendingRemovalIds
            ? removalWarningDescription
              ? removalWarningDescription(pendingRemovalIds.map(nameFor))
              : `This assignment has already been assigned to ${pendingRemovalIds
                  .map(nameFor)
                  .join(", ")}. Do you wish to remove ${
                  pendingRemovalIds.length > 1 ? "them" : "this mentee"
                } from the assignment list? This can't be undone.`
            : ""
        }
        confirmLabel="Remove"
        isLoading={isRemoving}
        errorMessage={removeError}
      />

      <WarningModal
        open={pendingBlocked}
        onClose={() => setPendingBlocked(false)}
        title="Can't remove the last mentee"
        description="This assignment needs at least one mentee. To remove everyone, delete the assignment itself instead."
        variant="warning"
      />
    </>
  );
}

interface PodCardProps {
  name: string;
  members: PodMember[];
  selectedSet: Set<string>;
  committedSet: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onToggleMember: (id: string) => void;
}

function PodCard({ name, members, selectedSet, committedSet, allSelected, someSelected, onToggleAll, onToggleMember }: PodCardProps) {
  const selectAllRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <div className="surface-card flex flex-col gap-2">
      <label className="flex cursor-pointer items-center gap-2 border-b border-border pb-2 dark:border-white/10">
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={allSelected}
          onChange={onToggleAll}
          disabled={members.length === 0}
          className="h-3.5 w-3.5"
        />
        <span className="text-sm font-semibold text-text-primary">{name}</span>
        <span className="ml-auto text-xs text-text-primary/50 dark:text-text-primary/60">
          {members.filter((m) => selectedSet.has(m.id)).length}/{members.length}
        </span>
      </label>

      <ul className="flex flex-col gap-0.5">
        {members.map((member) => (
          <li key={member.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface-muted dark:hover:bg-white/5">
              <input
                type="checkbox"
                checked={selectedSet.has(member.id)}
                onChange={() => onToggleMember(member.id)}
                className="h-3.5 w-3.5"
              />
              {member.full_name}
              {committedSet.has(member.id) && (
                <span className="ml-auto shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  Already assigned
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}