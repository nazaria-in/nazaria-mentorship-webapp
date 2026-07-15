// /lib/filtering/resource-fields.ts

import type { FilterFieldDef } from "@/lib/filtering/types";

export const RESOURCE_TYPE_OPTIONS = [
  { value: "handbook", label: "Handbook" },
  { value: "toolkit", label: "Toolkit" },
  { value: "template", label: "Template" },
  { value: "video", label: "Video" },
  { value: "guide", label: "Guide" },
  { value: "external_course", label: "External course" },
] as const;

export const RESOURCE_STATUS_OPTIONS = [
  { value: "ongoing", label: "Ongoing" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
] as const;

export interface MenteeFilterOption {
  value: string;
  label: string;
}

/**
 * FIELD_DEFS for the resources list page. `menteeOptions` is dynamic
 * (depends on which pods the viewer can see), so this is a function —
 * pass `[]` and omit the "assigned_to" field entirely for the mentee's own
 * view, since they only ever see their own resources.
 */
export function getResourceFieldDefs(menteeOptions: MenteeFilterOption[]): FilterFieldDef[] {
  const defs: FilterFieldDef[] = [
    { key: "search", kind: "text", columns: ["title", "description"], searchable: true },
    { key: "type", kind: "enum", label: "Type", column: "type", options: [...RESOURCE_TYPE_OPTIONS] },
    { key: "status", kind: "enum", label: "Status", column: "status", options: [...RESOURCE_STATUS_OPTIONS] },
    { key: "week_number", kind: "numberRange", label: "Week", column: "week_number" },
    { key: "created_at", kind: "dateRange", label: "Created", column: "created_at", sortable: true, defaultSort: "desc" },
  ];

  if (menteeOptions.length > 0) {
    defs.splice(3, 0, { key: "assigned_to", kind: "entity", label: "Mentee", column: "assigned_to", options: menteeOptions });
  }

  return defs;
}