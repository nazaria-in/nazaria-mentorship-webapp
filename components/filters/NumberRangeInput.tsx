// /components/filters/NumberRangeInput.tsx

"use client";

import type { NumberRangeValue } from "@/lib/filtering/types";

export interface NumberRangeInputProps {
  label: string;
  value: NumberRangeValue;
  onChange: (value: NumberRangeValue) => void;
}

export function NumberRangeInput({ label, value, onChange }: NumberRangeInputProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-text-primary/60">{label}</span>
      <input
        type="number"
        value={value.min ?? ""}
        onChange={(e) => onChange({ ...value, min: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="Min"
        className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs text-text-primary placeholder:text-text-primary/40 focus:outline-none dark:bg-white/5"
      />
      <span className="text-text-primary/40">–</span>
      <input
        type="number"
        value={value.max ?? ""}
        onChange={(e) => onChange({ ...value, max: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="Max"
        className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs text-text-primary placeholder:text-text-primary/40 focus:outline-none dark:bg-white/5"
      />
    </div>
  );
}