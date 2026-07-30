// types/admin.ts

export type ExitSurveySignal = "green" | "yellow" | "red";
export type ExitSurveyUrgency = "none" | "soon" | "urgent";
export type UserRole = "pm" | "associate" | "mentor" | "mentee";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Escalation {
  exit_survey_id: string;
  subject_user_id: string | null;
  reported_by: string;
  signal: ExitSurveySignal | null;
  follow_up_urgency: ExitSurveyUrgency;
  needs_follow_up: boolean;
  concern_tags: string[];
  created_at: string;
}

export interface PodStats {
  pod_id: string;
  pod_name: string;
  cohort_id: string;
  mentee_count: number;
  mentor_count: number;
  completed_assignments: number;
  total_assignments: number;
  open_escalations: number;
}

export interface MentorStats {
  mentor_id: string;
  mentor_name: string | null;
  mentee_count: number;
  completed_assignments: number;
  total_assignments: number;
  open_escalations_among_mentees: number;
}