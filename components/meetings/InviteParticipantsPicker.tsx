// components/meetings/InviteParticipantsPicker.tsx

"use client";

import * as React from "react";
import { PeopleGrid } from "@/components/shared/PeopleGrid";
import type { UserCardPerson } from "@/components/shared/UserCard";
import type { InviteCandidate } from "@/types/meetings";
import type { FilterFieldDef } from "@/lib/filtering/types";

const PICKER_FIELD_DEFS: FilterFieldDef[] = [
  { key: "search", kind: "text", columns: ["full_name"], searchable: true },
];

export interface InviteParticipantsPickerProps {
  candidates: InviteCandidate[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  isLoading?: boolean;
}

/**
 * approvalStatus is assumed "approved" here — InviteCandidate doesn't
 * carry the real value (confirm against types/meetings.ts; if it turns
 * out candidates can be pending/rejected, this needs the real field
 * threaded through instead of defaulting).
 */
function toPerson(candidate: InviteCandidate): UserCardPerson {
  return {
    id: candidate.id,
    fullName: candidate.full_name,
    role: candidate.role,
    approvalStatus: "approved",
  };
}

export function InviteParticipantsPicker({
  candidates,
  selectedIds,
  onChange,
  isLoading = false,
}: InviteParticipantsPickerProps): React.JSX.Element {
  if (isLoading) {
    return <p className="text-sm text-text-muted dark:text-text-muted">Loading people…</p>;
  }

  return (
    <PeopleGrid
      fieldDefs={PICKER_FIELD_DEFS}
      viewKey="invite-participants"
      queryKey={["invite-candidates", candidates.length]}
      queryFn={async (filterState) => {
        const term = filterState.search?.trim().toLowerCase();
        const people = candidates.map(toPerson);
        return term ? people.filter((p) => (p.fullName ?? "").toLowerCase().includes(term)) : people;
      }}
      groupBy="none"
      selectable
      selectedIds={selectedIds}
      onSelectionChange={onChange}
      emptyMessage="No one matches that search."
      defaultView="list"
    />
  );
}