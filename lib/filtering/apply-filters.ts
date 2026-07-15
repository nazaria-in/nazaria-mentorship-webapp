// /lib/filtering/apply-filters.ts

import type { FilterFieldDef, FilterState, ChipState, DateRangeValue, NumberRangeValue } from "@/lib/filtering/types";
import type { FilterableQuery } from "@/lib/filtering/query-types";

/**
 * Applies every field in `fieldDefs` that has a value set in `filterState`
 * to the given query. Call this once per fetch function instead of writing
 * .eq()/.ilike() chains by hand — the goal is that NO lib/api/*.ts file
 * builds filter clauses itself, they all delegate here.
 *
 * Generic over Q so this works against any Supabase query builder shape
 * without needing `any` — Q just has to satisfy FilterableQuery<Q>, which
 * every real PostgrestFilterBuilder does since its methods return `this`.
 */
export function applyFilters<Q extends FilterableQuery<Q>>(
  query: Q,
  fieldDefs: FilterFieldDef[],
  filterState: FilterState
): Q {
  let q = query;

  // Global search — OR's ilike across every field marked searchable: true
  if (filterState.search.trim()) {
    const searchableCols = fieldDefs
      .filter((f): f is Extract<FilterFieldDef, { kind: "text" }> => f.kind === "text" && !!f.searchable)
      .flatMap((f) => f.columns);
    if (searchableCols.length > 0) {
      const term = filterState.search.trim();
      q = q.or(searchableCols.map((col) => `${col}.ilike.%${term}%`).join(","));
    }
  }

  for (const field of fieldDefs) {
    const value = filterState.values[field.key];
    if (value == null) continue;

    switch (field.kind) {
      case "text": {
        // non-searchable text fields can still be filtered individually
        if (typeof value === "string" && value.trim()) {
          q = q.or(field.columns.map((col) => `${col}.ilike.%${value.trim()}%`).join(","));
        }
        break;
      }

      case "enum": {
        const chips = value as Record<string, ChipState>;
        const included = Object.entries(chips).filter(([, s]) => s === "selected").map(([v]) => v);
        const excluded = Object.entries(chips).filter(([, s]) => s === "anti-selected").map(([v]) => v);
        if (included.length > 0) q = q.in(field.column, included);
        if (excluded.length > 0) q = q.not(field.column, "in", `(${excluded.join(",")})`);
        break;
      }

      case "boolean": {
        if (value === true) q = q.eq(field.column, true);
        break;
      }

      case "date": {
        if (typeof value === "string" && value) q = q.eq(field.column, value);
        break;
      }

      case "dateRange": {
        const range = value as DateRangeValue;
        if (range.from) q = q.gte(field.column, range.from);
        if (range.to) q = q.lte(field.column, range.to);
        break;
      }

      case "number": {
        if (typeof value === "string" || typeof value === "number") q = q.eq(field.column, value);
        break;
      }

      case "numberRange": {
        const range = value as NumberRangeValue;
        if (range.min != null) q = q.gte(field.column, range.min);
        if (range.max != null) q = q.lte(field.column, range.max);
        break;
      }

      case "entity": {
        if (typeof value === "string" && value) q = q.eq(field.column, value);
        break;
      }

      case "relation": {
        // Requires the caller's .select() to have embedded the relation with
        // !inner, e.g. .select("*, pod_members!inner(pod_id)") — this only
        // adds the filter clause, it does not add the embed itself, since
        // the embed has to be declared once at the top of the select.
        if (typeof value === "string" && value) {
          const { table, column } = field.relation;
          q = q.eq(`${table}.${column}`, value);
        }
        break;
      }

      case "computed": {
        // Handled client-side after the query resolves — see applyComputedFilters below.
        break;
      }
    }
  }

  return q;
}

/**
 * Computed fields can't be expressed as query clauses (they're aggregates
 * or view-backed lookups resolved elsewhere), so they run as a post-filter
 * on the returned rows. Prefer backing a SQL view + using `enum`/`boolean`
 * over reaching for this — this exists for genuine one-offs only.
 */
export function applyComputedFilters<T>(rows: T[], fieldDefs: FilterFieldDef[], filterState: FilterState): T[] {
  let result = rows;
  for (const field of fieldDefs) {
    if (field.kind !== "computed") continue;
    const value = filterState.values[field.key] as Record<string, ChipState> | undefined;
    if (!value) continue;
    const selected = Object.entries(value).filter(([, s]) => s === "selected").map(([v]) => v);
    const excluded = Object.entries(value).filter(([, s]) => s === "anti-selected").map(([v]) => v);
    if (selected.length > 0 || excluded.length > 0) {
      result = field.resolver(result, selected, excluded) as T[];
    }
  }
  return result;
}