// /components/filters/RelationPicker.tsx

"use client";

import { EntityPicker } from "@/components/filters/EntityPicker";
import type { SelectOption } from "@/lib/filtering/types";

export interface RelationPickerProps {
  label: string;
  value: string | undefined;
  options: SelectOption[];
  onChange: (value: string | undefined) => void;
}

// Visually identical to EntityPicker — kept as a separate component because
// the two kinds resolve to different query clauses in apply-filters.ts
// (.eq() on the row itself vs .eq() on an embedded relation). If you ever
// need relation-specific UI (e.g. showing pod member count), change it here
// without touching EntityPicker's simpler direct-FK case.
export function RelationPicker(props: RelationPickerProps) {
  return <EntityPicker {...props} />;
}