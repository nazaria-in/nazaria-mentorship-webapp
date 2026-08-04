// /lib/api/content-dispatches.ts

import { supabase } from "@/lib/supabase/client";
import {
  scheduleContentReminders,
  cancelContentReminders,
  notifyContentCompleted,
} from "@/lib/notifications/content-notifications";
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
  /**
   * ADDED — needed to schedule reminders per the confirmed cascade rules
   * (scheduleContentReminders in lib/notifications/content-notifications.ts).
   * Callers (ContentItemFormModal) already have all four from the item
   * they just created/loaded — see that component's dispatchMutation.
   */
  contentItemTitle: string;
  requirement: "required" | "optional" | "disabled";
  submissionStartsAt: string | null;
  submissionEndsAt: string | null;
}

export async function dispatchContentItem({
  contentItemId,
  menteeIds,
  assignedBy,
  dueAt,
  contentItemTitle,
  requirement,
  submissionStartsAt,
  submissionEndsAt,
}: DispatchContentItemInput): Promise<void> {
  if (menteeIds.length === 0) return;

  const { data: inserted, error } = await supabase
    .from("content_dispatches")
    .insert(
      menteeIds.map((mentee_id) => ({
        content_item_id: contentItemId,
        mentee_id,
        assigned_by: assignedBy,
        due_at: dueAt,
      }))
    )
    .select("id, mentee_id");
  if (error) throw error;

  // Reminder scheduling now happens here (previously deferred). One
  // cascade per newly-dispatched mentee; failures are logged, not thrown,
  // so a notification hiccup never blocks the roster write that already
  // succeeded above.
  const rows = (inserted ?? []) as { id: string; mentee_id: string }[];
  await Promise.all(
    rows.map((row) =>
      scheduleContentReminders(supabase, {
        contentDispatchId: row.id,
        menteeId: row.mentee_id,
        contentItemTitle,
        requirement,
        submissionStartsAt,
        submissionEndsAt,
      }).catch((err) => {
        console.error("[content-dispatches] Failed to schedule reminders for dispatch", row.id, err);
      })
    )
  );
}

export async function removeContentDispatch(contentDispatchId: string): Promise<void> {
  // Cancel first, delete second — if the delete fails the reminders are
  // still harmlessly cancelled; if cancellation fails we don't want a
  // dangling dispatch we can't clean up after, so this order (not the
  // reverse) is deliberate.
  await cancelContentReminders(supabase, contentDispatchId).catch((err) => {
    console.error("[content-dispatches] Failed to cancel reminders before removing dispatch", contentDispatchId, err);
  });

  const { error } = await supabase.from("content_dispatches").delete().eq("id", contentDispatchId);
  if (error) throw error;
}

/**
 * The one and only path to a dispatch being "done" (Phase 2: "Mark Complete
 * action (mentor-only) on content_dispatches — whole-item level"). Doesn't
 * touch content_submissions at all — a mentor can mark complete even if a
 * submission is still pending_review, e.g. for participation-only items.
 *
 * ADDED menteeId/contentItemTitle params — needed to fire the achievement
 * notification + cancel remaining reminders (notifyContentCompleted does
 * both). Call sites: ContentItemDetailPage's completeMutation already has
 * both (row.mentee_id, item.title) in scope.
 */
export async function markDispatchComplete(
  contentDispatchId: string,
  completedBy: string,
  menteeId: string,
  contentItemTitle: string
): Promise<void> {
  const { error } = await supabase
    .from("content_dispatches")
    .update({ completed_at: new Date().toISOString(), completed_by: completedBy })
    .eq("id", contentDispatchId);
  if (error) throw error;

  await notifyContentCompleted(supabase, { contentDispatchId, menteeId, contentItemTitle }).catch((err) => {
    console.error("[content-dispatches] Mark Complete succeeded but completion notification failed", contentDispatchId, err);
  });
}

export async function unmarkDispatchComplete(contentDispatchId: string): Promise<void> {
  const { error } = await supabase
    .from("content_dispatches")
    .update({ completed_at: null, completed_by: null })
    .eq("id", contentDispatchId);
  if (error) throw error;
  // Deliberately does NOT reschedule reminders — an "unmark complete" is
  // an undo action for a mistaken click, not a re-dispatch; re-triggering
  // a whole reminder cascade on undo would be surprising. If the mentee
  // still needs nudging after an unmark, that's a fresh dispatch-level
  // concern, not something this function should infer.
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
 * A mentee item is visible once its submission window has opened (or it
 * has no window at all — e.g. "No submission" resources). Filters using
 * millisecond comparison rather than string comparison since
 * submission_starts_at ISO strings from Postgres aren't guaranteed to be
 * lexically sortable against `new Date().toISOString()` (offset format
 * can differ). Applied only on the mentee read path — staff/mentor still
 * see everything regardless of window, since they're the ones setting it.
 */
function isVisibleToMenteeNow(item: ContentItemWithMeta): boolean {
  if (!item.submission_starts_at) return true;
  return new Date(item.submission_starts_at).getTime() <= Date.now();
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

  const allRows = (data ?? []) as unknown as RawDispatchRow[];
  const rows = allRows.filter((row) => isVisibleToMenteeNow(row.content_item));

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
 * Single-dispatch fetch. SCHEMA GAP CARRIED FORWARD: unlike
 * fetchMenteeContentDispatches, this does NOT gate on isVisibleToMenteeNow.
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
 * Roster-with-status for the staff/mentor detail page. NOTE: content_dispatches
 * has three separate FKs to users (mentee_id, assigned_by, completed_by) —
 * an unqualified `users(...)` embed is ambiguous to PostgREST and errors,
 * must pin the exact constraint name (content_dispatches_mentee_id_fkey).
 */
export async function fetchDispatchesForContentItem(
  contentItemId: string,
  contentType: ContentType
): Promise<DispatchRosterRow[]> {
  const { data, error } = await supabase
    .from("content_dispatches")
    .select("id, mentee_id, due_at, completed_at, completed_by, mentee:users!content_dispatches_mentee_id_fkey(full_name)")
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

function normalizeJoinedContentItem(raw: ContentItemWithMeta & { content_item_tags?: { tag: unknown }[] }): ContentItemWithMeta {
  const tagsJoin = raw.content_item_tags as { tag: ContentItemWithMeta["tags"][number] }[] | undefined;
  return { ...raw, tags: tagsJoin ? tagsJoin.map((j) => j.tag) : raw.tags };
}