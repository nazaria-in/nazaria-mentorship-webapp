// /lib/filtering/examples/assignment-fields.example.ts

import type { FilterFieldDef } from "@/lib/filtering/types";

// Plain fields, queried directly against `assignments`.
export const ASSIGNMENT_FIELD_DEFS: FilterFieldDef[] = [
  { key: "search", kind: "text", columns: ["title", "description"], searchable: true },
  { key: "week_number", kind: "number", label: "Week", column: "week_number", sortable: true },
  { key: "start_date", kind: "dateRange", label: "Start date", column: "start_date", sortable: true, defaultSort: "desc" },
  { key: "is_active", kind: "boolean", label: "Active", column: "is_active", chipLabel: "Active only" },
];

// Pod membership — `users` doesn't have a pod_id column directly, so this
// is a `relation` field against `pod_members`. Requires the select to embed
// pod_members with !inner, e.g.:
//   supabase.from("users").select("*, pod_members!inner(pod_id)")
export function menteeFieldDefs(podOptions: { value: string; label: string }[]): FilterFieldDef[] {
  return [
    { key: "search", kind: "text", columns: ["bio"], searchable: true }, // swap for full_name once added
    {
      key: "pod",
      kind: "relation",
      label: "Pod",
      relation: { table: "pod_members", column: "pod_id" },
      options: podOptions,
    },
  ];
}

// Assignment completion — backed by v_mentee_assignment_status, so this is
// a plain `enum` against the view's `completion_status` column, not a
// `computed` client-side resolver.
export const MENTEE_ASSIGNMENT_STATUS_FIELD_DEFS: FilterFieldDef[] = [
  {
    key: "completion",
    kind: "enum",
    label: "Status",
    column: "completion_status",
    sortable: false,
    options: [
      { value: "completed", label: "Completed" },
      { value: "pending_review", label: "Pending review" },
      { value: "needs_revision", label: "Needs revision" },
      { value: "not_started", label: "Not started" },
    ],
  },
];