// /lib/filtering/types.ts

/** The 3-state chip value already used by FilterChip — reused here so enum
 *  fields can be "include" or "exclude", not just on/off. */
export type ChipState = "selected" | "anti-selected" | null;

export interface SelectOption {
  value: string;
  label: string;
}

export interface DateRangeValue {
  from?: string; // ISO date
  to?: string; // ISO date
}

export interface NumberRangeValue {
  min?: number;
  max?: number;
}

/**
 * One entry per filterable/sortable field on a page. This is the ONLY thing
 * a page author writes — SmartFilterBar and apply-filters/apply-sort read
 * this array and do the rest. Never hand-roll .eq()/.ilike() chains outside
 * of apply-filters.ts; add a new `kind` here instead if something doesn't fit.
 */
export type FilterFieldDef =
  | {
      key: string;
      kind: "text";
      label?: string;
      /** Columns OR'd together via .ilike() — e.g. ["title","description"] */
      columns: string[];
      searchable?: boolean; // renders in the single global search box instead of its own control
    }
  | {
      key: string;
      kind: "enum";
      label: string;
      column: string;
      options: SelectOption[];
      sortable?: boolean;
    }
  | {
      key: string;
      kind: "boolean";
      label: string;
      column: string;
      /** Label shown on the single toggle chip, e.g. "Active only" */
      chipLabel: string;
    }
  | {
      key: string;
      kind: "date" | "dateRange";
      label: string;
      column: string;
      sortable?: boolean;
      defaultSort?: "asc" | "desc";
    }
  | {
      key: string;
      kind: "number" | "numberRange";
      label: string;
      column: string;
      sortable?: boolean;
      defaultSort?: "asc" | "desc";
    }
  | {
      key: string;
      kind: "entity";
      label: string;
      /** FK column that lives directly on the table being queried, e.g. pod_id on pods table itself */
      column: string;
      options: SelectOption[];
    }
  | {
      key: string;
      kind: "relation";
      label: string;
      /** The relation lives on a joined table, not the row itself — e.g.
       *  filtering `users` by pod membership via `pod_members`. Uses
       *  PostgREST embedded-resource `!inner` filtering. */
      relation: { table: string; column: string; foreignTable?: string };
      options: SelectOption[];
    }
  | {
      key: string;
      kind: "computed";
      label: string;
      options: SelectOption[];
      sortable?: boolean;
      /** Escape hatch only — prefer backing a SQL view and using `enum`/
       *  `boolean` against that view instead of reaching for this. Typed
       *  as unknown[] since the row shape varies per call site — cast
       *  inside your resolver, e.g. `(rows as MyRow[]).filter(...)`. */
      resolver: (rows: unknown[], selected: string[]) => unknown[];
    };

export type FilterValue = ChipState | boolean | string | DateRangeValue | NumberRangeValue | Record<string, ChipState>;

export interface FilterState {
  values: Record<string, FilterValue>;
  search: string;
}

export interface SortState {
  key: string | null;
  direction: "asc" | "desc";
}

export const EMPTY_FILTER_STATE: FilterState = { values: {}, search: "" };