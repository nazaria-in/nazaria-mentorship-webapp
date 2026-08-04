// /types/in-person-sessions.ts

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";
export type SessionStatus = "scheduled" | "completed" | "cancelled";

export interface InPersonSessionSeries {
  id: string;
  createdBy: string;
  title: string;
  location: string | null;
  description: string | null;
  recurrence: RecurrenceType;
  recurrenceUntil: string | null; // ISO
  dayOfWeek: number | null; // 0-6, only meaningful when recurrence === "weekly"
  defaultStartsAt: string; // "HH:mm:ss"
  defaultEndsAt: string; // "HH:mm:ss"
  cohortId: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface InPersonSession {
  id: string;
  seriesId: string | null; // null = one-off session, not part of a series
  createdBy: string;
  title: string;
  location: string | null;
  description: string | null;
  startsAt: string; // ISO
  endsAt: string; // ISO
  status: SessionStatus;
  cohortId: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface CreateInPersonSessionSeriesInput {
  title: string;
  location: string | null;
  description: string | null;
  recurrence: RecurrenceType;
  recurrenceUntil: string | null;
  dayOfWeek: number | null;
  defaultStartsAt: string;
  defaultEndsAt: string;
  cohortId: string | null;
  /** How many upcoming occurrences to materialize immediately on create. */
  initialOccurrenceCount: number;
}

export interface UpdateSingleOccurrenceInput {
  sessionId: string;
  title?: string;
  location?: string | null;
  description?: string | null;
  startsAt?: string;
  endsAt?: string;
}

export interface CancelSingleOccurrenceInput {
  sessionId: string;
}