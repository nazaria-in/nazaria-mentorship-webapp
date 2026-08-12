// /components/shared/PeopleGrid.tsx

"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { List, LayoutGrid } from "lucide-react";
import { useFilterState } from "@/hooks/use-filter-state";
import { SmartFilterBar } from "@/components/filters/SmartFilterBar";
import { UserCard, type UserCardPerson } from "@/components/shared/UserCard";
import { WarningModal } from "@/components/shared/WarningModal";
import type { FilterFieldDef, FilterState, SortState } from "@/lib/filtering/types";

export interface ExplicitGroup {
  key: string;
  label: string;
}

export interface PeopleGridProps {
  fieldDefs: FilterFieldDef[];
  viewKey: string;
  queryKey: unknown[];
  queryFn: (filterState: FilterState, sortState: SortState) => Promise<UserCardPerson[]>;
  renderActions?: (person: UserCardPerson) => React.ReactNode;
  /**
   * "pod" and "cohort" both just mean "derive a group label from each
   * person via groupKeyFn" — PeopleGrid doesn't care what the label
   * represents. Nesting (cohort containing pods) isn't supported; pick
   * one grouping level per PeopleGrid instance.
   */
  groupBy?: "pod" | "cohort" | "none";
  groupKeyFn?: (person: UserCardPerson) => string;
  /**
   * Full set of groups to render, independent of who's currently fetched
   * into `data` — e.g. every cohort/team including ones with zero members
   * right now. When provided, every group here always renders (0/0 count
   * is fine, select-all is simply a no-op via the existing `disabled`
   * guard below). Groups are still sorted ascending by label regardless
   * of the order given here — pass them in any order.
   */
  explicitGroups?: ExplicitGroup[];
  computeClickable?: (person: UserCardPerson) => boolean;
  emptyMessage?: string;
  defaultView?: "list" | "card";

  // ---- Picker / selectable mode (replaces PodMemberSelector) ----
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  alreadyCommittedIds?: string[];
  onRemoveCommitted?: (id: string) => Promise<void>;
  preventEmptyCommitted?: boolean;
  removalWarningTitle?: string;
  removalWarningDescription?: (memberNames: string[]) => string;
  showSelectAllVisible?: boolean;
}

const OTHER_GROUP_KEY = "__other__";
/** Natural/numeric alphabetical compare — "Team 2" sorts before "Team 10". */
function alphaCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Sorts groups ascending by label, but always pushes catch-all buckets
 * ("Other", "No pod", "No cohort", etc.) to the end — those aren't a real
 * alphabetical peer of the named groups, they're a leftover bucket.
 */
function sortGroupsAscending<T extends { key: string | null; label: string | null }>(groups: T[]): T[] {
  const isCatchAll = (g: T) => g.key === OTHER_GROUP_KEY || g.label === null;
  const named = groups.filter((g) => !isCatchAll(g));
  const catchAll = groups.filter(isCatchAll);
  named.sort((a, b) => alphaCompare(a.label ?? "", b.label ?? ""));
  return [...named, ...catchAll];
}

/** Sorts people within a single group/list by name — the piece that was missing. */
function sortPeopleAscending(people: UserCardPerson[]): UserCardPerson[] {
  return [...people].sort((a, b) => alphaCompare(a.fullName ?? "", b.fullName ?? ""));
}

export function PeopleGrid({
  fieldDefs,
  viewKey,
  queryKey,
  queryFn,
  renderActions,
  groupBy = "none",
  groupKeyFn,
  explicitGroups,
  computeClickable,
  emptyMessage = "No one matches these filters.",
  defaultView = "list",
  selectable = false,
  selectedIds,
  onSelectionChange,
  alreadyCommittedIds,
  onRemoveCommitted,
  preventEmptyCommitted = true,
  removalWarningTitle = "Remove from this assignment?",
  removalWarningDescription,
  showSelectAllVisible
}: PeopleGridProps) {
  const [view, setView] = useState<"list" | "card">(defaultView);
  const filterState = useFilterState(fieldDefs, viewKey);

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKey, filterState.filterState, filterState.sortState],
    queryFn: () => queryFn(filterState.filterState, filterState.sortState),
  });

  // Derived during render — grouping + sorting is pure from data/props,
  // no effect needed.
  const groups = useMemo(() => {
    const people = data ?? [];
    if (groupBy === "none") return [{ key: null, label: null, people: sortPeopleAscending(people) }];

    const keyFn = groupKeyFn ?? (() => "Ungrouped");

    if (explicitGroups && explicitGroups.length > 0) {
      const buckets = new Map<string, UserCardPerson[]>(explicitGroups.map((g) => [g.key, []]));
      const otherBucket: UserCardPerson[] = [];
      for (const person of people) {
        const key = keyFn(person);
        if (buckets.has(key)) {
          buckets.get(key)!.push(person);
        } else {
          otherBucket.push(person);
        }
      }
      const result = explicitGroups.map((g) => ({
        key: g.key,
        label: g.label,
        people: sortPeopleAscending(buckets.get(g.key) ?? []),
      }));
      if (otherBucket.length > 0) {
        result.push({ key: OTHER_GROUP_KEY, label: "Other", people: sortPeopleAscending(otherBucket) });
      }
      return sortGroupsAscending(result);
    }

    const map = new Map<string, UserCardPerson[]>();
    for (const person of people) {
      const key = keyFn(person);
      const list = map.get(key) ?? [];
      list.push(person);
      map.set(key, list);
    }
    const result = Array.from(map.entries()).map(([key, people]) => ({
      key,
      label: key,
      people: sortPeopleAscending(people),
    }));
    return sortGroupsAscending(result);
  }, [data, groupBy, groupKeyFn, explicitGroups]);

  const value = selectedIds ?? [];
  const selectedSet = useMemo(() => new Set(value), [value]);
  const committedSet = useMemo(() => new Set(alreadyCommittedIds ?? []), [alreadyCommittedIds]);
  const allPeople = data ?? [];
  const nameFor = useCallback(
    (id: string) => allPeople.find((p) => p.id === id)?.fullName ?? "this member",
    [allPeople]
  );

  const visibleIds = useMemo(() => (data ?? []).map((p) => p.id), [data]);
  const visibleSelectedCount = visibleIds.filter((id) => selectedSet.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;

  function toggleAllVisible() {
    if (allVisibleSelected) {
      // Same committed-guard as toggleGroup — don't silently strip committed
      // members, route them through the same removal confirmation.
      const committedInVisible = onRemoveCommitted ? visibleIds.filter((id) => committedSet.has(id)) : [];
      const plainRemovable = visibleIds.filter((id) => !committedInVisible.includes(id));
      if (plainRemovable.length > 0) onSelectionChange?.(value.filter((id) => !plainRemovable.includes(id)));
      if (committedInVisible.length > 0) requestRemoval(committedInVisible);
    } else {
      const merged = new Set(value);
      visibleIds.forEach((id) => merged.add(id));
      onSelectionChange?.(Array.from(merged));
    }
  }

  const [pendingRemovalIds, setPendingRemovalIds] = useState<string[] | null>(null);
  const [pendingBlocked, setPendingBlocked] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

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
    onSelectionChange?.(isSelected ? value.filter((v) => v !== id) : [...value, id]);
  }

  // Works identically whether memberIds represents a pod or a whole
  // cohort — "select everyone in this group" is the same operation either
  // way, which is why cohort-level "select all" doesn't need new logic,
  // just groupBy="cohort" upstream.
  function toggleGroup(memberIds: string[], allSelected: boolean) {
    if (memberIds.length === 0) return;
    if (allSelected) {
      const committedInGroup = onRemoveCommitted ? memberIds.filter((id) => committedSet.has(id)) : [];
      const plainRemovable = memberIds.filter((id) => !committedInGroup.includes(id));
      if (plainRemovable.length > 0) onSelectionChange?.(value.filter((id) => !plainRemovable.includes(id)));
      if (committedInGroup.length > 0) requestRemoval(committedInGroup);
    } else {
      const merged = new Set(value);
      memberIds.forEach((id) => merged.add(id));
      onSelectionChange?.(Array.from(merged));
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
      onSelectionChange?.(value.filter((id) => !pendingRemovalIds.includes(id)));
      setPendingRemovalIds(null);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Couldn't remove this member. Try again.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <SmartFilterBar fieldDefs={fieldDefs} state={filterState} />
        <div className="inline-flex shrink-0 rounded-full border border-border p-0.5 dark:border-border">
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label="List view"
            className={`rounded-full p-1.5 ${view === "list" ? "bg-primary text-primary-foreground" : "text-text-muted dark:text-text-muted"}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("card")}
            aria-label="Card view"
            className={`rounded-full p-1.5 ${view === "card" ? "bg-primary text-primary-foreground" : "text-text-muted dark:text-text-muted"}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-text-muted dark:text-text-muted">Loading…</p>}
      {error && (
        <p className="text-sm text-destructive dark:text-destructive">
          {error instanceof Error ? error.message : "Couldn't load people."}
        </p>
      )}
      {!isLoading && (data ?? []).length === 0 && !explicitGroups && (
        <p className="text-sm text-text-muted dark:text-text-muted">{emptyMessage}</p>
      )}

      {selectable && showSelectAllVisible && visibleIds.length > 0 && (
        <button
          type="button"
          onClick={toggleAllVisible}
          className="w-fit rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-card-alt dark:border-border dark:text-text-primary dark:hover:bg-card-alt"
        >
          {allVisibleSelected ? "Clear all visible" : `Select all visible (${visibleIds.length})`}
        </button>
      )}

      {groups.map((group) => {
        const memberIds = group.people.map((p) => p.id);
        const selectedCount = memberIds.filter((id) => selectedSet.has(id)).length;
        const allSelected = memberIds.length > 0 && selectedCount === memberIds.length;
        const someSelected = selectedCount > 0 && !allSelected;

        return (
          <div key={group.key ?? "all"} className="flex flex-col gap-2">
            {group.label && (
              selectable ? (
                <GroupSelectAllHeader
                  label={group.label}
                  count={`${selectedCount}/${memberIds.length}`}
                  allSelected={allSelected}
                  someSelected={someSelected}
                  disabled={memberIds.length === 0}
                  onToggle={() => toggleGroup(memberIds, allSelected)}
                />
              ) : (
                <h4 className="text-sm font-semibold text-text-muted dark:text-text-muted">{group.label}</h4>
              )
            )}
            {memberIds.length === 0 ? (
              <p className="pl-1 text-xs text-text-muted/70 dark:text-text-muted/70">No members yet.</p>
            ) : (
              <div className={view === "card" ? "grid gap-2 sm:grid-cols-2" : "flex flex-col gap-2"}>
                {group.people.map((person) =>
                  selectable ? (
                    <UserCard
                      key={person.id}
                      person={person}
                      view={view}
                      clickable={false}
                      selected={selectedSet.has(person.id)}
                      onToggleSelect={() => toggleMember(person.id)}
                      committed={committedSet.has(person.id)}
                    />
                  ) : (
                    <UserCard
                      key={person.id}
                      person={person}
                      view={view}
                      clickable={computeClickable?.(person) ?? false}
                    >
                      {renderActions?.(person)}
                    </UserCard>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}

      {selectable && (
        <>
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
                  : `This has already been assigned to ${pendingRemovalIds
                      .map(nameFor)
                      .join(", ")}. Do you wish to remove ${
                      pendingRemovalIds.length > 1 ? "them" : "this person"
                    }? This can't be undone.`
                : ""
            }
            confirmLabel="Remove"
            isLoading={isRemoving}
            errorMessage={removeError}
          />

          <WarningModal
            open={pendingBlocked}
            onClose={() => setPendingBlocked(false)}
            title="Can't remove the last member"
            description="This needs at least one person assigned. To remove everyone, delete the assignment itself instead."
            variant="warning"
          />
        </>
      )}
    </div>
  );
}

function GroupSelectAllHeader({
  label,
  count,
  allSelected,
  someSelected,
  disabled,
  onToggle,
}: {
  label: string;
  count: string;
  allSelected: boolean;
  someSelected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const setIndeterminateRef = useCallback(
    (el: HTMLInputElement | null) => {
      if (el) {
        el.indeterminate = someSelected;
      }
    },
    [someSelected]
  );

  return (
    <label
      className={`flex items-center gap-2 border-b border-border pb-1.5 dark:border-border ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <input
        ref={setIndeterminateRef}
        type="checkbox"
        checked={allSelected}
        onChange={onToggle}
        disabled={disabled}
        className="h-3.5 w-3.5 accent-[var(--color-nazaria-burgundy)]"
      />
      <span className="text-sm font-semibold text-text-muted dark:text-text-muted">{label}</span>
      <span className="ml-auto text-xs text-text-muted dark:text-text-muted">{count}</span>
    </label>
  );
}