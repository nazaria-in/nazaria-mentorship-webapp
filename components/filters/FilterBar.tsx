// /components/filters/FilterBar.tsx

"use client";

import * as React from "react";
import { X } from "lucide-react";
import { FilterChip, type FilterChipState } from "@/components/filters/FilterChip";
import { DateRangePicker, type DateRange } from "@/components/filters/DateRangePicker";
import { cn } from "@/lib/utils";

/**
 * Each page declares which filters are relevant to it via `defs`; values
 * are lifted up through `value`/`onChange` (backed by store/filter-store.ts
 * at the call site) so FilterBar itself stays presentational and testable.
 *
 * - "enum"   -> inline row of 3-state FilterChips (multi-select, include/
 *               exclude/neutral per option) — e.g. status, category.
 * - "entity" -> single-select popover dropdown — e.g. cohort, pod.
 * - "dateRange" -> DateRangePicker.
 */

export type FilterValue =
  | string
  | Record<string, FilterChipState>
  | DateRange
  | undefined;

export interface FilterDef {
  key: string;
  label: string;
  type: "enum" | "entity" | "dateRange";
  options?: { value: string; label: string }[]; // for enum / entity
}

export interface FilterBarProps {
  defs: FilterDef[];
  values: Record<string, FilterValue>;
  onChange: (key: string, value: FilterValue) => void;
  onClearAll: () => void;
  className?: string;
}

export function FilterBar({ defs, values, onChange, onClearAll, className }: FilterBarProps) {
  const [openPopover, setOpenPopover] = React.useState<string | null>(null);

  const hasActive = defs.some((def) => {
    const v = values[def.key];
    if (v == null) return false;
    if (def.type === "dateRange") {
      const r = v as DateRange;
      return !!r.from || !!r.to;
    }
    if (def.type === "enum") {
      return Object.values(v as Record<string, FilterChipState>).some((s) => s !== null);
    }
    return true; // entity
  });

  return (
    <div className={cn("flex flex-wrap items-center gap-4", className)}>
      {defs.map((def) => {
        if (def.type === "dateRange") {
          return (
            <DateRangePicker
              key={def.key}
              value={(values[def.key] as DateRange) ?? {}}
              onChange={(range) => onChange(def.key, range)}
            />
          );
        }

        if (def.type === "enum") {
          const current = (values[def.key] as Record<string, FilterChipState>) ?? {};
          return (
            <div key={def.key} className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-text-primary/60">{def.label}</span>
              {def.options?.map((opt) => (
                <FilterChip
                  key={opt.value}
                  label={opt.label}
                  state={current[opt.value] ?? null}
                  onChange={(next) => onChange(def.key, { ...current, [opt.value]: next })}
                />
              ))}
            </div>
          );
        }

        // entity — single-select popover (cohort/pod-style, one value at a time)
        const current = values[def.key] as string | undefined;
        const currentLabel = def.options?.find((o) => o.value === current)?.label;
        const isOpen = openPopover === def.key;

        return (
          <div key={def.key} className="relative">
            <button
              type="button"
              onClick={() => setOpenPopover(isOpen ? null : def.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                current
                  ? "border-primary bg-primary/10 text-text-accent dark:bg-primary/20"
                  : "border-border bg-transparent text-text-primary hover:bg-surface-muted dark:hover:bg-white/5"
              )}
            >
              {currentLabel ?? def.label}
            </button>

            {isOpen && (
              <div className="absolute z-30 mt-1 min-w-[180px] rounded-2xl border border-border bg-surface p-2 shadow-lg dark:shadow-black/40">
                <button
                  type="button"
                  onClick={() => {
                    onChange(def.key, undefined);
                    setOpenPopover(null);
                  }}
                  className="mb-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-text-primary/60 hover:bg-surface-muted dark:hover:bg-white/5"
                >
                  Any
                </button>
                {def.options?.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(def.key, opt.value);
                      setOpenPopover(null);
                    }}
                    className={cn(
                      "w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                      current === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "text-text-primary hover:bg-surface-muted dark:hover:bg-white/5"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {hasActive && (
        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
        >
          <X className="h-3 w-3" />
          Clear all
        </button>
      )}
    </div>
  );
}