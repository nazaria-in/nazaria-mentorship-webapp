// /lib/filtering/exit-survey-fields.ts

import type { FilterFieldDef } from "@/lib/filtering/types";

// concern_tags (text[]) and pod (view-joined, no direct column) aren't
// included here — no FilterFieldDef kind maps cleanly onto either without
// a computed resolver. Pod gets its own dropdown outside SmartFilterBar in
// ExitSurveyStaffDashboard; concern tags remain read-only badges only. See
// docs/EXIT_SURVEY_SYSTEM.md "Known gaps."
export const EXIT_SURVEY_STAFF_FIELD_DEFS: FilterFieldDef[] = [
  { key: "search", kind: "text", columns: ["transcript", "ai_summary", "ai_headline"], searchable: true },
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
    key: "sentiment",
    kind: "enum",
    label: "AI sentiment",
    column: "sentiment",
    options: [
      { value: "positive", label: "Positive" },
      { value: "neutral", label: "Neutral" },
      { value: "negative", label: "Negative" },
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