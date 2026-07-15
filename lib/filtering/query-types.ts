// /lib/filtering/query-types.ts

/**
 * Structural shape of the Supabase query-builder methods apply-filters.ts
 * and apply-sort.ts call. Supabase's real PostgrestFilterBuilder returns
 * `this` from each of these, so any real query object satisfies this
 * interface — we just need something more specific than `any` to constrain
 * the generic in applyFilters/applySort.
 */
export interface FilterableQuery<Self> {
  eq(column: string, value: string | number | boolean): Self;
  in(column: string, values: (string | number)[]): Self;
  not(column: string, operator: string, value: string): Self;
  gte(column: string, value: string | number): Self;
  lte(column: string, value: string | number): Self;
  or(filters: string): Self;
  order(column: string, options?: { ascending?: boolean }): Self;
}