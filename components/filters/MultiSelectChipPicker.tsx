// /components/filters/MultiSelectChipPicker.tsx

"use client";

import { Check, Minus } from "lucide-react";
import type { FilterOption, MultiSelectFilterValue } from "@/lib/filtering/types";

/**
 * Shared rendering for EntityPicker and RelationPicker — per the filter
 * guide's rule of thumb #5, the two stay visually identical on purpose
 * (they only differ in which query clause applyFilters builds from their
 * value), so the actual chip UI lives here once instead of being
 * duplicated in both files.
 *
 * 3-state cycle per chip, same as the existing enum FilterChip: neutral →
 * include → exclude → neutral. Neutral = absent from both included/excluded.
 */
export function MultiSelectChipPicker({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: FilterOption[];
  value: MultiSelectFilterValue | undefined;
  onChange: (next: MultiSelectFilterValue) => void;
}) {
  const included = value?.included ?? [];
  const excluded = value?.excluded ?? [];

  function cycle(optionValue: string) {
    const isIncluded = included.includes(optionValue);
    const isExcluded = excluded.includes(optionValue);

    if (!isIncluded && !isExcluded) {
      onChange({ included: [...included, optionValue], excluded });
      return;
    }
    if (isIncluded) {
      onChange({ included: included.filter((v) => v !== optionValue), excluded: [...excluded, optionValue] });
      return;
    }
    // was excluded -> back to neutral
    onChange({ included, excluded: excluded.filter((v) => v !== optionValue) });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-xs font-medium text-text-muted dark:text-text-muted">{label}</span>
      )}
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isIncluded = included.includes(option.value);
          const isExcluded = excluded.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => cycle(option.value)}
              aria-pressed={isIncluded}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                isIncluded
                  ? "border-primary bg-primary text-primary-foreground dark:border-primary dark:bg-primary dark:text-primary-foreground"
                  : isExcluded
                  ? "border-destructive/40 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/15 dark:text-destructive"
                  : "border-border text-text-muted hover:text-text-primary dark:border-border dark:text-text-muted dark:hover:text-text-primary"
              }`}
            >
              {isIncluded && <Check className="h-3 w-3" />}
              {isExcluded && <Minus className="h-3 w-3" />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}