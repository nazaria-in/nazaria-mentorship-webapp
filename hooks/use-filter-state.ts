// /hooks/use-filter-state.ts

"use client";

import * as React from "react";
import type { FilterFieldDef, FilterState, FilterValue, SortState } from "@/lib/filtering/types";
import { EMPTY_FILTER_STATE } from "@/lib/filtering/types";
import { getDefaultSort } from "@/lib/filtering/apply-sort";

/**
 * Local, ephemeral filter/sort state for one view. `viewKey` just needs to
 * be stable+unique per page (e.g. "assignments-list", "mentee-roster") —
 * it's for your own sanity when debugging, not persisted anywhere.
 */
export function useFilterState(fieldDefs: FilterFieldDef[], viewKey: string) {
  const [filterState, setFilterState] = React.useState<FilterState>(EMPTY_FILTER_STATE);
  const [sortState, setSortState] = React.useState<SortState>(() => getDefaultSort(fieldDefs));

  function setValue(key: string, value: FilterValue | undefined) {
    setFilterState((prev) => {
      const next = { ...prev.values };
      if (value == null) delete next[key];
      else next[key] = value;
      return { ...prev, values: next };
    });
  }

  function setSearch(search: string) {
    setFilterState((prev) => ({ ...prev, search }));
  }

  function clearAll() {
    setFilterState(EMPTY_FILTER_STATE);
  }

  function setSort(key: string, direction: "asc" | "desc") {
    setSortState({ key, direction });
  }

  const hasActiveFilters =
    filterState.search.trim().length > 0 || Object.keys(filterState.values).length > 0;

  return {
    viewKey,
    filterState,
    sortState,
    setValue,
    setSearch,
    setSort,
    clearAll,
    hasActiveFilters,
  };
}

export type UseFilterStateReturn = ReturnType<typeof useFilterState>;