// /components/filters/EntityPicker.tsx

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { SelectOption } from "@/lib/filtering/types";

export interface EntityPickerProps {
  label: string;
  value: string | undefined;
  options: SelectOption[];
  onChange: (value: string | undefined) => void;
}

export function EntityPicker({ label, value, options, onChange }: EntityPickerProps) {
  const [open, setOpen] = React.useState(false);
  const currentLabel = options.find((o) => o.value === value)?.label;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          value
            ? "border-primary bg-primary/10 text-text-accent dark:bg-primary/20"
            : "border-border bg-transparent text-text-primary hover:bg-surface-muted dark:hover:bg-white/5"
        )}
      >
        {currentLabel ?? label}
      </button>

      {open && (
        <>
          {/* click-outside layer */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-1 min-w-[180px] rounded-2xl border border-border bg-surface p-2 shadow-lg dark:shadow-black/40">
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className="mb-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-text-primary/60 hover:bg-surface-muted dark:hover:bg-white/5"
            >
              Any
            </button>
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                  value === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-text-primary hover:bg-surface-muted dark:hover:bg-white/5"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}