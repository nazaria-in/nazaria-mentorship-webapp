// /types/exit-survey.ts

export type ExitSurveySignal = "green" | "yellow" | "red";

export type ExitSurveyRole = "mentor" | "mentee";

export type ExitSurveyUrgency = "none" | "soon" | "urgent";

/**
 * Closed vocabulary, deliberately mirroring the mentor form's own concern
 * checklist. Gemini is constrained to pick only from this list (via
 * responseSchema enum) so concern_tags stays a clean multi-select field
 * instead of free-text drift.
 */
export const EXIT_SURVEY_CONCERN_TAGS = [
  "Attendance",
  "Motivation",
  "Family situation",
  "Financial concerns",
  "Mental health / wellbeing",
  "College workload",
  "Employment commitments",
  "Communication issues",
  "Needs additional academic support",
] as const;

export type ExitSurveyConcernTag = (typeof EXIT_SURVEY_CONCERN_TAGS)[number];

/**
 * A question definition, used both by the PM/associate template editor and
 * by the form renderer. `id` is a stable key independent of the question
 * text — editing a template's wording later never breaks answer lookups
 * for in-flight (already-snapshotted) forms, since those forms hold their
 * own frozen copy of this shape.
 */
export type ExitSurveyTemplateEntry = (
  | { component: "single_select"; options: string[] }
  | { component: "multi_select"; options: string[] }
  | { component: "rating"; scale: number }
  | { component: "short_answer" }
) & {
  id: string;
  question: string;
  showIf?: { questionId: string; equals: string | string[] };
};

/** A submitted answer — same component/id, plus what was actually picked. */
export type ExitSurveyEntry =
  | { id: string; component: "single_select"; question: string; options: string[]; selected: string }
  | { id: string; component: "multi_select"; question: string; options: string[]; selected: string[] }
  | { id: string; component: "rating"; question: string; scale: number; selected: number }
  | { id: string; component: "short_answer"; question: string; selected: string };

export interface ExitSurveyTemplate {
  id: string;
  title: string;
  role: ExitSurveyRole;
  questions: ExitSurveyTemplateEntry[];
  isActive: boolean;
  createdAt: string;
}

/** What Gemini returns from the single transcribe+analyze call. */
export interface ExitSurveyAiAnalysis {
  transcript: string;
  summary: string;
  concernTags: ExitSurveyConcernTag[];
  needsFollowUp: boolean;
  followUpUrgency: ExitSurveyUrgency;
}

/** A pending or submitted exit_surveys row. */
export interface ExitSurveyRow {
  id: string;
  meetingId: string;
  userId: string;
  subjectUserId: string;
  userRole: ExitSurveyRole;
  templateId: string | null;
  templateSnapshot: ExitSurveyTemplateEntry[];
  answers: ExitSurveyEntry[] | null;
  signal: ExitSurveySignal | null;
  transcript: string | null;
  aiSummary: string | null;
  concernTags: ExitSurveyConcernTag[];
  needsFollowUp: boolean;
  followUpUrgency: ExitSurveyUrgency;
  createdAt: string;
  submittedAt: string | null;
}

/** Payload for filling in an already-existing pending row. */
export interface ExitSurveySubmission {
  exitSurveyId: string;
  answers: ExitSurveyEntry[];
  signal: ExitSurveySignal;
  transcript?: string;
  aiSummary?: string;
  concernTags?: ExitSurveyConcernTag[];
  needsFollowUp?: boolean;
  followUpUrgency?: ExitSurveyUrgency;
}

export function isValidExitSurveyEntry(value: unknown): value is ExitSurveyEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string" || typeof entry.question !== "string") return false;

  switch (entry.component) {
    case "single_select":
      return (
        Array.isArray(entry.options) &&
        entry.options.every((o) => typeof o === "string") &&
        typeof entry.selected === "string"
      );
    case "multi_select":
      return (
        Array.isArray(entry.options) &&
        entry.options.every((o) => typeof o === "string") &&
        Array.isArray(entry.selected) &&
        entry.selected.every((s) => typeof s === "string")
      );
    case "rating":
      return typeof entry.scale === "number" && typeof entry.selected === "number";
    case "short_answer":
      return typeof entry.selected === "string";
    default:
      return false;
  }
}

