// /lib/filtering/admin-user-fields.ts

import type { FilterFieldDef } from "@/lib/filtering/types";

// Role change is PM-only in the UI (see UserRolesTab) — this field just
// drives filtering, not permission.
export const USER_ROLE_FIELD_DEFS: FilterFieldDef[] = [
  { key: "search", kind: "text", columns: ["full_name", "email", "school_or_org"], searchable: true },
  {
    key: "role",
    kind: "enum",
    label: "Role",
    column: "role",
    options: [
      { value: "mentee", label: "Mentee" },
      { value: "mentor", label: "Mentor" },
      { value: "associate", label: "Associate" },
      { value: "pm", label: "PM" },
    ],
  },
  {
    key: "approval_status",
    kind: "enum",
    label: "Approval status",
    column: "approval_status",
    options: [
      { value: "pending", label: "Pending" },
      { value: "approved", label: "Approved" },
      { value: "rejected", label: "Rejected" },
    ],
  },
  { key: "created_at", kind: "dateRange", label: "Joined", column: "created_at", sortable: true, defaultSort: "desc" },
];

// Queried against v_user_pods, not users directly — pod_id is a plain
// column on the view (left join), so this is a normal `entity` field
// rather than a `relation` field. See migration 0003 for why.
export const USER_POD_FIELD_DEFS: FilterFieldDef[] = [
  { key: "search", kind: "text", columns: ["full_name", "email"], searchable: true },
  {
    key: "role",
    kind: "enum",
    label: "Role",
    column: "role",
    options: [
      { value: "mentee", label: "Mentee" },
      { value: "mentor", label: "Mentor" },
      { value: "associate", label: "Associate" },
      { value: "pm", label: "PM" },
    ],
  },
  {
    key: "pod",
    kind: "entity",
    label: "Pod",
    column: "pod_id",
    options: [], // populated at runtime from fetchPodOptions() — pods vary by cohort
  },
];