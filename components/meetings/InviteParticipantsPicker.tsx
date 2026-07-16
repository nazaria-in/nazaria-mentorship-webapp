// /components/meetings/InviteParticipantsPicker.tsx

"use client";

import * as React from "react";
import type { InviteCandidate } from "@/types/meetings";

export interface InviteParticipantsPickerProps {
  candidates: InviteCandidate[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  isLoading?: boolean;
}

export function InviteParticipantsPicker({
  candidates,
  selectedIds,
  onChange,
  isLoading = false,
}: InviteParticipantsPickerProps): React.JSX.Element {
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(
    () => candidates.filter((c) => c.full_name.toLowerCase().includes(search.toLowerCase())),
    [candidates, search],
  );

  function toggle(id: string): void {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((existing) => existing !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search people…"
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
      />

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading people…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-text-muted">No one matches that search.</p>
      ) : (
        <div className="surface-card-alt max-h-64 overflow-y-auto">
          <ul className="flex flex-col gap-1">
            {filtered.map((c) => {
              const checked = selectedIds.includes(c.id);
              return (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-card">
                    <span className="text-sm text-text-primary">{c.full_name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs capitalize text-text-muted">{c.role}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(c.id)}
                        className="h-4 w-4 accent-[var(--color-nazaria-burgundy)]"
                      />
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selectedIds.length > 0 && <p className="text-xs text-text-muted">{selectedIds.length} selected</p>}
    </div>
  );
}