// /lib/filtering/exit-survey-fields.ts

import type { FilterFieldDef } from "@/lib/filtering/types";

// concern_tags (text[]) isn't included here — no FilterFieldDef kind maps
// cleanly onto an array column without a computed resolver or a supporting
// view. See docs/EXIT_SURVEY_SYSTEM.md "Known gaps." Tags still render as
// read-only badges in the table, just not filterable yet.
export const EXIT_SURVEY_STAFF_FIELD_DEFS: FilterFieldDef[] = [
  { key: "search", kind: "text", columns: ["transcript", "ai_summary"], searchable: true },
  {
    key: "role",
    kind: "enum",
    label: "Submitter role",
    column: "user_role",
    options: [
      { value: "mentor", label: "Mentor" },
      { value: "mentee", label: "Mentee" },
    ],
  },
  {
    key: "signal",
    kind: "enum",
    label: "Signal",
    column: "signal",
    options: [
      { value: "green", label: "Green" },
      { value: "yellow", label: "Yellow" },
      { value: "red", label: "Red" },
    ],
  },
  {
    key: "urgency",
    kind: "enum",
    label: "Follow-up urgency",
    column: "follow_up_urgency",
    options: [
      { value: "none", label: "None" },
      { value: "soon", label: "Soon" },
      { value: "urgent", label: "Urgent" },
    ],
  },
  {
    key: "needs_follow_up",
    kind: "boolean",
    label: "Needs follow-up",
    column: "needs_follow_up",
    chipLabel: "Needs follow-up only",
  },
  {
    key: "submitted_at",
    kind: "dateRange",
    label: "Submitted",
    column: "submitted_at",
    sortable: true,
    defaultSort: "desc",
  },
];