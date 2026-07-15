// /components/filters/SmartFilterBar.tsx

"use client";

import { Search, X } from "lucide-react";
import { FilterChip, type FilterChipState } from "@/components/filters/FilterChip";
import { DateRangePicker } from "@/components/filters/DateRangePicker";
import { EntityPicker } from "@/components/filters/EntityPicker";
import { RelationPicker } from "@/components/filters/RelationPicker";
import { NumberRangeInput } from "@/components/filters/NumberRangeInput";
import { SortDropdown } from "@/components/filters/SortDropdown";
import { cn } from "@/lib/utils";
import type { FilterFieldDef, DateRangeValue, NumberRangeValue } from "@/lib/filtering/types";
import type { UseFilterStateReturn } from "@/hooks/use-filter-state";

export interface SmartFilterBarProps {
  fieldDefs: FilterFieldDef[];
  state: UseFilterStateReturn; // pass the object returned by useFilterState() directly
  className?: string;
}

export function SmartFilterBar({ fieldDefs, state, className }: SmartFilterBarProps) {
  const { filterState, sortState, setValue, setSearch, setSort, clearAll, hasActiveFilters } = state;

  const hasSearchableField = fieldDefs.some((f) => f.kind === "text" && f.searchable);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-3">
        {hasSearchableField && (
          <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 dark:bg-white/5">
            <Search className="h-4 w-4 shrink-0 text-text-primary/50" />
            <input
              value={filterState.search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-primary/40 focus:outline-none"
            />
          </div>
        )}

        <SortDropdown fieldDefs={fieldDefs} sortState={sortState} onChange={setSort} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {fieldDefs.map((field) => {
          if (field.kind === "text" && field.searchable) return null; // already rendered as the main search box

          switch (field.kind) {
            case "enum": {
              const current = (filterState.values[field.key] as Record<string, FilterChipState>) ?? {};
              return (
                <div key={field.key} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-text-primary/60">{field.label}</span>
                  {field.options.map((opt) => (
                    <FilterChip
                      key={opt.value}
                      label={opt.label}
                      state={current[opt.value] ?? null}
                      onChange={(next) => setValue(field.key, { ...current, [opt.value]: next })}
                    />
                  ))}
                </div>
              );
            }

            case "boolean": {
              const active = filterState.values[field.key] === true;
              return (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => setValue(field.key, active ? undefined : true)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-transparent text-text-primary hover:bg-surface-muted dark:hover:bg-white/5"
                  )}
                >
                  {field.chipLabel}
                </button>
              );
            }

            case "dateRange": {
              const range = (filterState.values[field.key] as DateRangeValue) ?? {};
              return (
                <DateRangePicker
                  key={field.key}
                  value={range}
                  onChange={(next) => setValue(field.key, next)}
                />
              );
            }

            case "numberRange": {
              const range = (filterState.values[field.key] as NumberRangeValue) ?? {};
              return (
                <NumberRangeInput
                  key={field.key}
                  label={field.label}
                  value={range}
                  onChange={(next) => setValue(field.key, next)}
                />
              );
            }

            case "entity": {
              const current = filterState.values[field.key] as string | undefined;
              return (
                <EntityPicker
                  key={field.key}
                  label={field.label}
                  value={current}
                  options={field.options}
                  onChange={(next) => setValue(field.key, next)}
                />
              );
            }

            case "relation": {
              const current = filterState.values[field.key] as string | undefined;
              return (
                <RelationPicker
                  key={field.key}
                  label={field.label}
                  value={current}
                  options={field.options}
                  onChange={(next) => setValue(field.key, next)}
                />
              );
            }

            case "computed": {
              const current = (filterState.values[field.key] as Record<string, FilterChipState>) ?? {};
              return (
                <div key={field.key} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-text-primary/60">{field.label}</span>
                  {field.options.map((opt) => (
                    <FilterChip
                      key={opt.value}
                      label={opt.label}
                      state={current[opt.value] ?? null}
                      onChange={(next) => setValue(field.key, { ...current, [opt.value]: next })}
                    />
                  ))}
                </div>
              );
            }

            default:
              return null;
          }
        })}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}