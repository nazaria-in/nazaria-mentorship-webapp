// /lib/filtering/apply-sort.ts

import type { FilterFieldDef, SortState } from "@/lib/filtering/types";
import type { FilterableQuery } from "@/lib/filtering/query-types";

export function applySort<Q extends FilterableQuery<Q>>(
  query: Q,
  fieldDefs: FilterFieldDef[],
  sortState: SortState
): Q {
  if (!sortState.key) return query;

  const field = fieldDefs.find((f) => f.key === sortState.key);
  if (!field) return query;

  const column = "column" in field ? field.column : undefined;
  if (!column) return query; // computed/text-search fields aren't sortable via query

  return query.order(column, { ascending: sortState.direction === "asc" });
}

/** Picks the default SortState for a field list — first field with a
 *  `defaultSort` wins, otherwise no default sort is applied. */
export function getDefaultSort(fieldDefs: FilterFieldDef[]): SortState {
  const withDefault = fieldDefs.find((f) => "defaultSort" in f && f.defaultSort);
  if (withDefault && "defaultSort" in withDefault && "column" in withDefault) {
    return { key: withDefault.key, direction: withDefault.defaultSort! };
  }
  return { key: null, direction: "asc" };
}