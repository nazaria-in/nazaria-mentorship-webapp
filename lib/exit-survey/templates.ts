// /lib/exit-survey/templates.ts

import type { ExitSurveyEntry, ExitSurveyRole } from "@/types/exit-survey";

/**
 * A template question is the same shape as ExitSurveyEntry but with
 * `selected` unset — the form fills it in as the user answers.
 * `showIf` makes a question conditional on a prior answer (e.g. the
 * "why not" reasons only show if the meeting didn't fully happen).
 */
export type ExitSurveyTemplateEntry = (
  | { type: "single_select"; options: string[] }
  | { type: "multi_select"; options: string[] }
  | { type: "rating"; scale: number }
  | { type: "short_answer" }
) & {
  question: string;
  showIf?: { question: string; equals: string | string[] };
};

const YES_PARTIAL_NO = ["Yes", "Partially", "No"];

export const MENTOR_TEMPLATE: ExitSurveyTemplateEntry[] = [
  { type: "single_select", question: "Did your meeting happen?", options: YES_PARTIAL_NO },
  {
    type: "single_select",
    question: "Why?",
    options: ["Mentee absent", "Mentor unavailable", "Technical issues", "Rescheduled", "Other"],
    showIf: { question: "Did your meeting happen?", equals: "No" },
  },
  { type: "rating", question: "How engaged was your mentee today?", scale: 5 },
  {
    type: "single_select",
    question: "Did your mentee complete this week's assignment?",
    options: ["Completed fully", "Mostly completed", "Partially completed", "Not completed"],
  },
  {
    type: "single_select",
    question: "Primary reason (if partially/not completed)",
    options: [
      "Time management",
      "College/School workload",
      "Family responsibilities",
      "Work commitments",
      "Financial challenges",
      "Didn't understand assignment",
      "Technical issues",
      "Motivation/confidence",
      "Health",
      "Other",
    ],
    showIf: {
      question: "Did your mentee complete this week's assignment?",
      equals: ["Partially completed", "Not completed"],
    },
  },
  { type: "rating", question: "How would you rate this week's submission?", scale: 5 },
  {
    type: "multi_select",
    question: "Did your mentee:",
    options: [
      "Come prepared",
      "Ask questions",
      "Reflect on feedback",
      "Implement last week's feedback",
      "Show improvement",
      "Take initiative",
    ],
  },
  { type: "rating", question: "Professional Skills: Communication", scale: 5 },
  { type: "rating", question: "Professional Skills: Accountability", scale: 5 },
  { type: "rating", question: "Professional Skills: Confidence", scale: 5 },
  { type: "rating", question: "Professional Skills: Collaboration", scale: 5 },
  { type: "rating", question: "Professional Skills: Professionalism", scale: 5 },
  {
    type: "multi_select",
    question: "Are there any concerns you'd like to flag?",
    options: [
      "Attendance",
      "Motivation",
      "Family situation",
      "Financial concerns",
      "Mental health / wellbeing",
      "College workload",
      "Employment commitments",
      "Communication issues",
      "Needs additional academic support",
      "No concerns",
    ],
  },
  {
    type: "single_select",
    question: "How would you describe today's session?",
    options: ["Excellent", "Good", "Average", "Difficult", "Needs intervention"],
  },
  {
    type: "single_select",
    question: "Does this mentee need follow-up from the Nazaria team?",
    options: ["No", "Mentor Associate", "Programme Manager", "Urgent follow-up"],
  },
  { type: "short_answer", question: "One win from today's session" },
  { type: "short_answer", question: "Anything else you'd like the Nazaria team to know?" },
];

export const MENTEE_TEMPLATE: ExitSurveyTemplateEntry[] = [
  { type: "single_select", question: "Did your meeting happen?", options: YES_PARTIAL_NO },
  { type: "rating", question: "How helpful was today's session?", scale: 5 },
  {
    type: "multi_select",
    question: "My mentor today...",
    options: [
      "Asked thoughtful questions",
      "Listened carefully",
      "Helped me understand my feedback",
      "Encouraged me",
      "Helped me solve problems",
      "Shared useful industry advice",
      "Helped me set goals",
    ],
  },
  {
    type: "multi_select",
    question: "If today's session wasn't very helpful, why?",
    options: [
      "My mentor cancelled",
      "My mentor seemed rushed",
      "I didn't understand the feedback",
      "I didn't get enough feedback",
      "My mentor didn't ask questions",
      "We ran out of time",
      "Technical issues",
      "Other",
    ],
  },
  {
    type: "single_select",
    question: "I understand what I need to improve before next session",
    options: ["Completely", "Mostly", "Somewhat", "Not really"],
  },
  { type: "rating", question: "How confident do you feel about completing this week's work?", scale: 5 },
  {
    type: "single_select",
    question: "This week's assignment feels:",
    options: ["Very easy", "Manageable", "Challenging", "Very difficult"],
  },
  {
    type: "multi_select",
    question: "What made it difficult?",
    options: [
      "Time management",
      "College/School",
      "Family responsibilities",
      "Didn't understand assignment",
      "Technical skills",
      "Software issues",
      "Internet/device issues",
      "Low confidence",
      "Health",
      "Other",
    ],
  },
  {
    type: "single_select",
    question: "Did you implement your mentor's feedback from last time?",
    options: ["Yes, completely", "Mostly", "Some", "Not yet"],
  },
  { type: "rating", question: "Right now, I feel... Confidence", scale: 5 },
  { type: "rating", question: "Right now, I feel... Motivation", scale: 5 },
  { type: "rating", question: "Right now, I feel... Stress Level", scale: 5 },
  {
    type: "multi_select",
    question: "Is there anything you'd like the Nazaria team to know?",
    options: [
      "I'd like additional technical support",
      "I'd like career guidance",
      "I'd like mental wellbeing support",
      "I'd like to speak to someone privately",
      "No concerns",
    ],
  },
  { type: "short_answer", question: "One thing I learnt today" },
  {
    type: "short_answer",
    question: "Anything else you'd like to share?",
    // This is the field that becomes notifications.action_items for pod
    // messaging — see lib/api/exit-surveys.ts submitExitSurvey().
  },
];

export const EXIT_SURVEY_TEMPLATES: Record<ExitSurveyRole, ExitSurveyTemplateEntry[]> = {
  mentor: MENTOR_TEMPLATE,
  mentee: MENTEE_TEMPLATE,
};

/** The mentee entry whose text gets forwarded to pod messages on submission. */
export const MENTEE_ACTION_ITEM_QUESTION = "Anything else you'd like to share?";

/** Only mentor and mentee templates exist today — PM/associate submission is unconfirmed. */
export function getTemplateForRole(role: ExitSurveyRole): ExitSurveyTemplateEntry[] {
  return EXIT_SURVEY_TEMPLATES[role];
}

/**
 * Filters a template down to the questions that should currently be visible,
 * given answers collected so far. Drives both the form UI and the final
 * "did they answer everything visible" check before submit.
 */
export function getVisibleTemplateEntries(
  template: ExitSurveyTemplateEntry[],
  currentAnswers: Partial<Record<string, ExitSurveyEntry["selected"]>>
): ExitSurveyTemplateEntry[] {
  return template.filter((entry) => {
    if (!entry.showIf) return true;
    const answer = currentAnswers[entry.showIf.question];
    if (typeof answer !== "string") return false;
    return Array.isArray(entry.showIf.equals)
      ? entry.showIf.equals.includes(answer)
      : entry.showIf.equals === answer;
  });
}