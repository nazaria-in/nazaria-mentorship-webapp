// /components/filters/FilterChip.tsx

"use client";

import { cn } from "@/lib/utils";

// Three-state cycle per click: not selected -> selected -> anti-selected ->
// not selected. "selected" = actively wanted (include), "anti-selected" =
// actively excluded, null = neutral/off.
export type FilterChipState = "selected" | "anti-selected" | null;

interface FilterChipProps {
  label: string;
  state: FilterChipState;
  onChange: (next: FilterChipState) => void;
}

function nextState(state: FilterChipState): FilterChipState {
  if (state === null) return "selected";
  if (state === "selected") return "anti-selected";
  return null;
}

export function FilterChip({ label, state, onChange }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(nextState(state))}
      aria-pressed={state !== null}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        state === "selected" &&
          "border-primary bg-primary text-primary-foreground",
        state === "anti-selected" &&
          "border-destructive/40 bg-destructive/10 text-destructive line-through",
        state === null &&
          "border-border bg-transparent text-text-primary hover:bg-surface-muted dark:hover:bg-white/5"
      )}
    >
      {label}
    </button>
  );
}