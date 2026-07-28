// /types/exit-survey.ts

export type ExitSurveySignal = "green" | "yellow" | "red";

export type ExitSurveyRole = "mentor" | "mentee";

export type ExitSurveyUrgency = "none" | "soon" | "urgent";

export type ExitSurveySentiment = "positive" | "neutral" | "negative";

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
 * Conditional visibility. Which field is set depends on the PARENT
 * question'''s component:
 *  - parent is single_select/multi_select -> `equals` (answer must match,
 *    or for a multi_select answer, overlap with, one of these values)
 *  - parent is rating -> `atLeast` (answer must be >= this number)
 * short_answer parents aren'''t supported as triggers (free text has no
 * enumerable set of "the answer that should trigger this").
 */
export interface ExitSurveyShowIf {
  questionId: string;
  equals?: string | string[];
  atLeast?: number;
}

export type ExitSurveyTemplateEntry = (
  | { component: "single_select"; options: string[] }
  | { component: "multi_select"; options: string[] }
  | { component: "rating"; scale: number }
  | { component: "short_answer" }
) & {
  id: string;
  question: string;
  showIf?: ExitSurveyShowIf;
};

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
  voicePromptLabel: string | null;
  isActive: boolean;
  createdAt: string;
}

/** What Gemini returns from the single transcribe+analyze call. */
export interface ExitSurveyAiAnalysis {
  transcript: string;
  headline: string;
  summary: string;
  keyPoints: string[];
  sentiment: ExitSurveySentiment;
  concernTags: ExitSurveyConcernTag[];
  needsFollowUp: boolean;
  followUpUrgency: ExitSurveyUrgency;
}

export interface ExitSurveyRow {
  id: string;
  meetingId: string;
  userId: string;
  subjectUserId: string;
  userRole: ExitSurveyRole;
  templateId: string | null;
  templateSnapshot: ExitSurveyTemplateEntry[];
  voicePromptLabel: string | null;
  answers: ExitSurveyEntry[] | null;
  signal: ExitSurveySignal | null;
  transcript: string | null;
  aiSummary: string | null;
  aiHeadline: string | null;
  aiKeyPoints: string[];
  sentiment: ExitSurveySentiment | null;
  concernTags: ExitSurveyConcernTag[];
  needsFollowUp: boolean;
  followUpUrgency: ExitSurveyUrgency;
  createdAt: string;
  submittedAt: string | null;
}

export interface ExitSurveySubmission {
  exitSurveyId: string;
  answers: ExitSurveyEntry[];
  signal: ExitSurveySignal;
  transcript?: string;
  aiSummary?: string;
  aiHeadline?: string;
  aiKeyPoints?: string[];
  sentiment?: ExitSurveySentiment;
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