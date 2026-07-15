// /components/filters/SortDropdown.tsx

"use client";

import * as React from "react";
import { ArrowUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FilterFieldDef, SortState } from "@/lib/filtering/types";

export interface SortDropdownProps {
  fieldDefs: FilterFieldDef[];
  sortState: SortState;
  onChange: (key: string, direction: "asc" | "desc") => void;
}

export function SortDropdown({ fieldDefs, sortState, onChange }: SortDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const sortableFields = fieldDefs.filter((f) => "sortable" in f && f.sortable);

  if (sortableFields.length === 0) return null;

  const activeField = sortableFields.find((f) => f.key === sortState.key);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-muted dark:hover:bg-white/5"
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        {activeField ? `${"label" in activeField ? activeField.label : activeField.key} (${sortState.direction})` : "Sort"}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 min-w-[180px] rounded-2xl border border-border bg-surface p-1.5 shadow-lg dark:shadow-black/40">
            {sortableFields.map((field) => (
              <div key={field.key} className="flex flex-col">
                {(["asc", "desc"] as const).map((dir) => {
                  const active = sortState.key === field.key && sortState.direction === dir;
                  return (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => {
                        onChange(field.key, dir);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs",
                        active ? "bg-primary text-primary-foreground" : "text-text-primary hover:bg-surface-muted dark:hover:bg-white/5"
                      )}
                    >
                      {"label" in field ? field.label : field.key} ({dir === "asc" ? "A→Z / oldest" : "Z→A / newest"})
                      {active && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}