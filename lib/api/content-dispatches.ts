// /lib/api/content-dispatches.ts

import { supabase } from "@/lib/supabase/client";
import type { CompletionStatus, ContentItemWithMeta, ContentType, MenteeContentDispatch, MenteeRef } from "@/types/content";

export async function fetchAssignedMenteeRefs(contentItemId: string): Promise<MenteeRef[]> {
  const { data, error } = await supabase
    .from("content_dispatches")
    .select("id, mentee_id")
    .eq("content_item_id", contentItemId);
  if (error) throw error;
  return (data ?? []).map((row) => ({ menteeId: row.mentee_id as string, contentDispatchId: row.id as string }));
}

interface DispatchContentItemInput {
  contentItemId: string;
  menteeIds: string[];
  assignedBy: string;
  dueAt: string | null;
}

export async function dispatchContentItem({ contentItemId, menteeIds, assignedBy, dueAt }: DispatchContentItemInput): Promise<void> {
  if (menteeIds.length === 0) return;
  const { error } = await supabase.from("content_dispatches").insert(
    menteeIds.map((mentee_id) => ({
      content_item_id: contentItemId,
      mentee_id,
      assigned_by: assignedBy,
      due_at: dueAt,
    }))
  );
  if (error) throw error;
  // Notification-on-dispatch (assignment_due) is intentionally not fired
  // here — Phase 2 of the todo owns notification wiring; this stays a pure
  // roster write so it doesn't get built twice.
}

export async function removeContentDispatch(contentDispatchId: string): Promise<void> {
  const { error } = await supabase.from("content_dispatches").delete().eq("id", contentDispatchId);
  if (error) throw error;
}

/**
 * The one and only path to a dispatch being "done" (Phase 2: "Mark Complete
 * action (mentor-only) on content_dispatches — whole-item level"). Doesn't
 * touch content_submissions at all — a mentor can mark complete even if a
 * submission is still pending_review, e.g. for participation-only items.
 * Notification + reminder-cancellation wiring happens once
 * lib/notifications/content-notifications.ts exists (todo §G) — this stays
 * a pure data write for the same reason dispatchContentItem does.
 */
export async function markDispatchComplete(contentDispatchId: string, completedBy: string): Promise<void> {
  const { error } = await supabase
    .from("content_dispatches")
    .update({ completed_at: new Date().toISOString(), completed_by: completedBy })
    .eq("id", contentDispatchId);
  if (error) throw error;
}

export async function unmarkDispatchComplete(contentDispatchId: string): Promise<void> {
  const { error } = await supabase
    .from("content_dispatches")
    .update({ completed_at: null, completed_by: null })
    .eq("id", contentDispatchId);
  if (error) throw error;
}

interface RawDispatchRow {
  id: string;
  content_item_id: string;
  mentee_id: string;
  assigned_by: string;
  due_at: string | null;
  pushed_at: string;
  completed_at: string | null;
  completed_by: string | null;
  content_item: ContentItemWithMeta;
}

interface RawAssignmentStatusRow {
  content_dispatch_id: string;
  completion_status: string;
  latest_submission_status: "pending_review" | "revision_requested" | "approved" | null;
  total_submissions: number;
}

/**
 * Mentee-facing fetch, split by content type because only assignments have
 * the richer v_mentee_assignment_status view (see the schema-gap note in
 * types/content.ts). Courses/resources fall back to a plain completed_at
 * check — "not_started" vs "completed", nothing in between yet.
 */
export async function fetchMenteeContentDispatches(menteeId: string, contentType: ContentType): Promise<MenteeContentDispatch[]> {
  const { data, error } = await supabase
    .from("content_dispatches")
    .select("*, content_item:content_items!inner(*, week:weeks(*), content_item_tags(tag:tags(*)))")
    .eq("mentee_id", menteeId)
    .eq("content_item.content_type", contentType)
    .is("content_item.deleted_at", null);
  if (error) throw error;

  const rows = (data ?? []) as unknown as RawDispatchRow[];

  if (contentType !== "assignment") {
    return rows.map((row) => ({
      ...row,
      content_item: normalizeJoinedContentItem(row.content_item),
      completion_status: (row.completed_at ? "completed" : "not_started") as CompletionStatus,
      latest_submission_status: null,
      total_submissions: 0,
    }));
  }

  const dispatchIds = rows.map((r) => r.id);
  const { data: statusRows, error: statusError } = await supabase
    .from("v_mentee_assignment_status")
    .select("content_dispatch_id, completion_status, latest_submission_status, total_submissions")
    .in("content_dispatch_id", dispatchIds);
  if (statusError) throw statusError;

  const statusById = new Map((statusRows as RawAssignmentStatusRow[]).map((s) => [s.content_dispatch_id, s]));

  return rows.map((row) => {
    const status = statusById.get(row.id);
    return {
      ...row,
      content_item: normalizeJoinedContentItem(row.content_item),
      completion_status: (status?.completion_status ?? "not_started") as CompletionStatus,
      latest_submission_status: status?.latest_submission_status ?? null,
      total_submissions: status?.total_submissions ?? 0,
    };
  });
}

/**
 * Single-dispatch fetch for the mentee submission page
 * (/assignments_and_courses/via/[dispatchId]). Reuses the same status
 * derivation as fetchMenteeContentDispatches rather than duplicating it —
 * fetches the one row via content_dispatches, then layers on
 * v_mentee_assignment_status only for assignments, same as the list path.
 */
export async function fetchDispatchById(dispatchId: string): Promise<MenteeContentDispatch> {
  const { data, error } = await supabase
    .from("content_dispatches")
    .select("*, content_item:content_items(*, week:weeks(*), content_item_tags(tag:tags(*)))")
    .eq("id", dispatchId)
    .single();
  if (error) throw error;

  const row = data as unknown as RawDispatchRow;
  const contentItem = normalizeJoinedContentItem(row.content_item);

  if (contentItem.content_type !== "assignment") {
    return {
      ...row,
      content_item: contentItem,
      completion_status: (row.completed_at ? "completed" : "not_started") as CompletionStatus,
      latest_submission_status: null,
      total_submissions: 0,
    };
  }

  const { data: statusRow, error: statusError } = await supabase
    .from("v_mentee_assignment_status")
    .select("completion_status, latest_submission_status, total_submissions")
    .eq("content_dispatch_id", dispatchId)
    .maybeSingle();
  if (statusError) throw statusError;

  return {
    ...row,
    content_item: contentItem,
    completion_status: (statusRow?.completion_status ?? "not_started") as CompletionStatus,
    latest_submission_status: statusRow?.latest_submission_status ?? null,
    total_submissions: statusRow?.total_submissions ?? 0,
  };
}

export interface DispatchRosterRow {
  id: string;
  mentee_id: string;
  mentee_name: string;
  due_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completion_status: CompletionStatus;
  latest_submission_status: "pending_review" | "revision_requested" | "approved" | null;
  total_submissions: number;
}

interface RawRosterRow {
  id: string;
  mentee_id: string;
  due_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  mentee: { full_name: string | null } | null;
}

/**
 * Roster-with-status for the staff/mentor detail page — every dispatch for
 * one content item, joined to the mentee's name and (for assignments) the
 * richer per-mentee status. This is the "per-mentee submission review"
 * list the detail page renders.
 */
export async function fetchDispatchesForContentItem(
  contentItemId: string,
  contentType: ContentType
): Promise<DispatchRosterRow[]> {
  const { data, error } = await supabase
    .from("content_dispatches")
    .select("id, mentee_id, due_at, completed_at, completed_by, mentee:users(full_name)")
    .eq("content_item_id", contentItemId);
  if (error) throw error;

  const rows = (data ?? []) as unknown as RawRosterRow[];

  if (contentType !== "assignment") {
    return rows.map((row) => ({
      id: row.id,
      mentee_id: row.mentee_id,
      mentee_name: row.mentee?.full_name ?? "Unknown mentee",
      due_at: row.due_at,
      completed_at: row.completed_at,
      completed_by: row.completed_by,
      completion_status: (row.completed_at ? "completed" : "not_started") as CompletionStatus,
      latest_submission_status: null,
      total_submissions: 0,
    }));
  }

  const dispatchIds = rows.map((r) => r.id);
  const { data: statusRows, error: statusError } = await supabase
    .from("v_mentee_assignment_status")
    .select("content_dispatch_id, completion_status, latest_submission_status, total_submissions")
    .in("content_dispatch_id", dispatchIds);
  if (statusError) throw statusError;

  const statusById = new Map((statusRows as RawAssignmentStatusRow[]).map((s) => [s.content_dispatch_id, s]));

  return rows.map((row) => {
    const status = statusById.get(row.id);
    return {
      id: row.id,
      mentee_id: row.mentee_id,
      mentee_name: row.mentee?.full_name ?? "Unknown mentee",
      due_at: row.due_at,
      completed_at: row.completed_at,
      completed_by: row.completed_by,
      completion_status: (status?.completion_status ?? "not_started") as CompletionStatus,
      latest_submission_status: status?.latest_submission_status ?? null,
      total_submissions: status?.total_submissions ?? 0,
    };
  });
}

// Supabase's embed for a *-to-one relation already returns the shape we
// want; this only exists so the tags join (array of {tag}) is flattened the
// same way it is in lib/api/content-items.ts, without importing a private
// helper from that file.
function normalizeJoinedContentItem(raw: ContentItemWithMeta & { content_item_tags?: { tag: unknown }[] }): ContentItemWithMeta {
  const tagsJoin = raw.content_item_tags as { tag: ContentItemWithMeta["tags"][number] }[] | undefined;
  return { ...raw, tags: tagsJoin ? tagsJoin.map((j) => j.tag) : raw.tags };
}