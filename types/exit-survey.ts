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
 * Each entry snapshots exactly what was shown and what was picked, so a
 * later template rewrite never invalidates historical rows. Frontend
 * decides which entries appear (including conditional "why" follow-ups) —
 * the backend never validates against a template, only against this shape.
 */
export type ExitSurveyEntry =
  | {
      type: "single_select";
      question: string;
      options: string[];
      selected: string;
    }
  | {
      type: "multi_select";
      question: string;
      options: string[];
      selected: string[];
    }
  | {
      type: "rating";
      question: string;
      scale: number; // 5, per the current forms
      selected: number;
    }
  | {
      type: "short_answer";
      question: string;
      selected: string;
    };

/** What Gemini returns from the single transcribe+analyze call. */
export interface ExitSurveyAiAnalysis {
  transcript: string;
  summary: string;
  concernTags: ExitSurveyConcernTag[];
  needsFollowUp: boolean;
  followUpUrgency: ExitSurveyUrgency;
}

export interface ExitSurveyRow {
  id: string;
  meetingId: string;
  userId: string;
  userRole: ExitSurveyRole;
  answers: ExitSurveyEntry[];
  signal: ExitSurveySignal;
  transcript: string | null;
  aiSummary: string | null;
  concernTags: ExitSurveyConcernTag[];
  needsFollowUp: boolean;
  followUpUrgency: ExitSurveyUrgency;
  createdAt: string;
}

/** Shape used when inserting a new submission (id/createdAt are server-assigned). */
export interface ExitSurveySubmission {
  meetingId: string;
  userId: string;
  userRole: ExitSurveyRole;
  answers: ExitSurveyEntry[];
  signal: ExitSurveySignal;
  transcript?: string;
  aiSummary?: string;
  concernTags?: ExitSurveyConcernTag[];
  needsFollowUp?: boolean;
  followUpUrgency?: ExitSurveyUrgency;
}

/** Runtime shape check before insert — see rationale in lib/exit-survey/validate.ts */
export function isValidExitSurveyEntry(value: unknown): value is ExitSurveyEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.question !== "string") return false;

  switch (entry.type) {
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