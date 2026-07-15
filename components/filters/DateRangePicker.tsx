// /components/filters/DateRangePicker.tsx

"use client";

import { DatePicker } from "@/components/shared/DatePicker";

export type DateRange = { from?: string; to?: string };

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <DatePicker
        value={value.from}
        onChange={(from) => {
          // Keep the range valid: if `to` predates the new `from`, push it up too.
          const to = value.to && value.to < from ? from : value.to;
          onChange({ from, to });
        }}
        placeholder="From"
      />
      <span className="text-xs text-text-primary/50">to</span>
      <DatePicker
        value={value.to}
        onChange={(to) => onChange({ from: value.from, to })}
        placeholder="To"
      />
    </div>
  );
}