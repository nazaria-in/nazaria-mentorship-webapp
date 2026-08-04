// /lib/api/in-person-sessions.ts

import { createClient } from "@/lib/supabase/client";
import type {
  InPersonSession,
  InPersonSessionSeries,
  CreateInPersonSessionSeriesInput,
  UpdateSingleOccurrenceInput,
  CancelSingleOccurrenceInput,
} from "@/types/in-person-sessions";

const supabase = createClient();

function rowToSession(row: Record<string, unknown>): InPersonSession {
  return {
    id: row.id as string,
    seriesId: (row.series_id as string | null) ?? null,
    createdBy: row.created_by as string,
    title: row.title as string,
    location: (row.location as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    status: row.status as InPersonSession["status"],
    cohortId: (row.cohort_id as string | null) ?? null,
    createdAt: row.created_at as string,
    deletedAt: (row.deleted_at as string | null) ?? null,
  };
}

function rowToSeries(row: Record<string, unknown>): InPersonSessionSeries {
  return {
    id: row.id as string,
    createdBy: row.created_by as string,
    title: row.title as string,
    location: (row.location as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    recurrence: row.recurrence as InPersonSessionSeries["recurrence"],
    recurrenceUntil: (row.recurrence_until as string | null) ?? null,
    dayOfWeek: (row.day_of_week as number | null) ?? null,
    defaultStartsAt: row.default_starts_at as string,
    defaultEndsAt: row.default_ends_at as string,
    cohortId: (row.cohort_id as string | null) ?? null,
    createdAt: row.created_at as string,
    deletedAt: (row.deleted_at as string | null) ?? null,
  };
}

/**
 * Computes the next `count` occurrence dates for a weekly series starting
 * from `fromDate`. Only "weekly" is implemented for v1 — daily/monthly
 * follow the same shape and can be added when a program actually needs
 * them (per PROJECT_BUILD_CONTEXT's "don't build what isn't asked for" pattern).
 */
function computeUpcomingWeeklyDates(fromDate: Date, dayOfWeek: number, count: number): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(fromDate);
  const currentDay = cursor.getDay();
  const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
  cursor.setDate(cursor.getDate() + daysUntilTarget);

  for (let i = 0; i < count; i += 1) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates;
}

function combineDateAndTime(date: Date, time: string): string {
  const [hours, minutes, seconds] = time.split(":").map(Number);
  const combined = new Date(date);
  combined.setHours(hours ?? 0, minutes ?? 0, seconds ?? 0, 0);
  return combined.toISOString();
}

/**
 * Creates the series row, then materializes `initialOccurrenceCount` real
 * in_person_sessions rows against it. Each occurrence is a normal row from
 * here on — there is no virtual-recurrence expansion anywhere else in the
 * app. This is what makes "edit just this week" a plain UPDATE later.
 */
export async function createInPersonSessionSeries(
  createdBy: string,
  input: CreateInPersonSessionSeriesInput,
): Promise<{ series: InPersonSessionSeries; occurrences: InPersonSession[] }> {
  const { data: seriesRow, error: seriesError } = await supabase
    .from("in_person_session_series")
    .insert({
      created_by: createdBy,
      title: input.title,
      location: input.location,
      description: input.description,
      recurrence: input.recurrence,
      recurrence_until: input.recurrenceUntil,
      day_of_week: input.dayOfWeek,
      default_starts_at: input.defaultStartsAt,
      default_ends_at: input.defaultEndsAt,
      cohort_id: input.cohortId,
    })
    .select()
    .single();

  if (seriesError || !seriesRow) {
    throw seriesError ?? new Error("Failed to create in-person session series");
  }

  const series = rowToSeries(seriesRow as Record<string, unknown>);

  if (series.recurrence === "none" || input.dayOfWeek === null) {
    return { series, occurrences: [] };
  }

  const dates = computeUpcomingWeeklyDates(new Date(), input.dayOfWeek, input.initialOccurrenceCount);

  const occurrenceRows = dates.map((date) => ({
    series_id: series.id,
    created_by: series.createdBy,
    title: series.title,
    location: series.location,
    description: series.description,
    starts_at: combineDateAndTime(date, series.defaultStartsAt),
    ends_at: combineDateAndTime(date, series.defaultEndsAt),
    status: "scheduled" as const,
    cohort_id: series.cohortId,
  }));

  const { data: insertedRows, error: occurrencesError } = await supabase
    .from("in_person_sessions")
    .insert(occurrenceRows)
    .select();

  if (occurrencesError || !insertedRows) {
    throw occurrencesError ?? new Error("Failed to materialize session occurrences");
  }

  return {
    series,
    occurrences: (insertedRows as Record<string, unknown>[]).map(rowToSession),
  };
}

export async function fetchInPersonSessions(rangeStartIso: string, rangeEndIso: string): Promise<InPersonSession[]> {
  const { data, error } = await supabase
    .from("in_person_sessions")
    .select("*")
    .is("deleted_at", null)
    .gte("starts_at", rangeStartIso)
    .lt("starts_at", rangeEndIso)
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return (data as Record<string, unknown>[]).map(rowToSession);
}

/**
 * Edits ONE occurrence. This never touches the series row or sibling
 * occurrences — that's the entire trick. Because occurrences are
 * materialized rows, "edit this week only" is just an UPDATE on that row's
 * id. No exception table, no diffing against a recurrence rule.
 */
export async function updateSingleOccurrence(input: UpdateSingleOccurrenceInput): Promise<InPersonSession> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.location !== undefined) patch.location = input.location;
  if (input.description !== undefined) patch.description = input.description;
  if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
  if (input.endsAt !== undefined) patch.ends_at = input.endsAt;

  const { data, error } = await supabase
    .from("in_person_sessions")
    .update(patch)
    .eq("id", input.sessionId)
    .select()
    .single();

  if (error || !data) throw error ?? new Error("Failed to update session occurrence");
  return rowToSession(data as Record<string, unknown>);
}

/**
 * Cancels ONE occurrence (soft — status: cancelled) without affecting the
 * series or any other week. The series keeps generating future rows
 * normally; this row just renders muted/struck-through on the timeline.
 */
export async function cancelSingleOccurrence(input: CancelSingleOccurrenceInput): Promise<InPersonSession> {
  const { data, error } = await supabase
    .from("in_person_sessions")
    .update({ status: "cancelled" })
    .eq("id", input.sessionId)
    .select()
    .single();

  if (error || !data) throw error ?? new Error("Failed to cancel session occurrence");
  return rowToSession(data as Record<string, unknown>);
}