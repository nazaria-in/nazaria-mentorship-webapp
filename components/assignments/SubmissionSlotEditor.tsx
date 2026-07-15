// /components/assignments/SubmissionSlotEditor.tsx

"use client";

import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DraftSlot {
  id: string; // client-side temp id (crypto.randomUUID()) until saved
  title: string;
  max_versions: number;
}

export interface SubmissionSlotEditorProps {
  slots: DraftSlot[];
  onChange: (slots: DraftSlot[]) => void;
  disabled?: boolean;
}

export function SubmissionSlotEditor({ slots, onChange, disabled }: SubmissionSlotEditorProps) {
  function updateSlot(id: string, patch: Partial<DraftSlot>) {
    onChange(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSlot(id: string) {
    onChange(slots.filter((s) => s.id !== id));
  }

  function addSlot() {
    onChange([...slots, { id: crypto.randomUUID(), title: "", max_versions: 4 }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {slots.map((slot) => (
        <div key={slot.id} className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2">
          <input
            value={slot.title}
            onChange={(e) => updateSlot(slot.id, { title: e.target.value })}
            disabled={disabled}
            placeholder="Slot title, e.g. Draft"
            className={cn(
              "min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-primary/40 focus:outline-none disabled:opacity-50 dark:bg-white/5"
            )}
          />
          <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-text-primary/60">
            Max versions
            <input
              type="number"
              min={1}
              value={slot.max_versions}
              onChange={(e) => updateSlot(slot.id, { max_versions: Math.max(1, Number(e.target.value)) })}
              disabled={disabled}
              className="w-14 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-text-primary focus:outline-none disabled:opacity-50 dark:bg-white/5"
            />
          </label>
          {!disabled && slots.length > 1 && (
            <button
              type="button"
              onClick={() => removeSlot(slot.id)}
              className="shrink-0 rounded-lg p-1.5 text-text-primary/40 hover:bg-destructive/10 hover:text-destructive"
              aria-label="Remove slot"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      {!disabled && (
        <button
          type="button"
          onClick={addSlot}
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-text-primary/70 hover:bg-surface-muted"
        >
          <Plus className="h-3.5 w-3.5" />
          Add slot
        </button>
      )}
    </div>
  );
}