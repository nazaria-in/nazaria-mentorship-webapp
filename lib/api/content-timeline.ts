// /lib/api/content-timeline.ts

import { supabase } from "@/lib/supabase/client";
import type { ContentItemWithMeta, ContentType, MenteeContentDispatch, Tag, Week } from "@/types/content";
import type { ContentSubmissionTemplate } from "@/components/content/ContentSubmissionTemplateEditor";

/**
 * ASSUMPTION FLAGGED: this file is intentionally separate from the real
 * lib/api/content-dispatches.ts (not shared with me, so I'm not risking
 * silently breaking its actual exports/shape). If content-dispatches.ts
 * already has range-scoped fetchers, prefer those and delete this file —
 * these two functions exist only to unblock the timeline showing content
 * items at all.
 */

interface RawTagJoinRow {
  tag: Tag;
}

interface RawContentItemRow {
  id: string;
  content_type: ContentType;
  title: string;
  description: string | null;
  instructions: string | null;
  week_id: string | null;
  submission_template: ContentSubmissionTemplate;
  is_active: boolean;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
  submission_starts_at: string | null;
  submission_ends_at: string | null;
  week: Week | null;
  content_item_tags: RawTagJoinRow[] | null;
}

function normalizeContentItemRow(row: RawContentItemRow): ContentItemWithMeta {
  return {
    id: row.id,
    content_type: row.content_type,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    week_id: row.week_id,
    submission_template: row.submission_template,
    is_active: row.is_active,
    created_by: row.created_by,
    created_at: row.created_at,
    deleted_at: row.deleted_at,
    submission_starts_at: row.submission_starts_at,
    submission_ends_at: row.submission_ends_at,
    week: row.week,
    tags: (row.content_item_tags ?? []).map((join) => join.tag),
  };
}

/**
 * Staff/mentor timeline view: one node per content_item due date, not per
 * mentee dispatch — otherwise an assignment sent to 30 mentees would render
 * 30 overlapping cards on the same due date. Deliberately item-level, no
 * dispatch/completion data attached; the details modal can deep-link into
 * the item's roster/review page for that.
 */
export async function fetchContentItemsDueInRange(
  rangeStartIso: string,
  rangeEndIso: string,
  scopeToCreatedBy?: string,
): Promise<ContentItemWithMeta[]> {
  let query = supabase
    .from("content_items")
    .select("*, week:weeks(*), content_item_tags(tag:tags(*))")
    .is("deleted_at", null)
    .not("submission_starts_at", "is", null)
    .not("submission_ends_at", "is", null)
    .gte("submission_ends_at", rangeStartIso)
    .lt("submission_ends_at", rangeEndIso);

  if (scopeToCreatedBy) query = query.eq("created_by", scopeToCreatedBy);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as RawContentItemRow[]).map(normalizeContentItemRow);
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
  content_item: RawContentItemRow;
}

/**
 * KNOWN GAP (mirrors PROJECT_BUILD_CONTEXT §5 item 3): completion_status
 * here is the binary completed_at fallback for all three content types,
 * not the richer v_mentee_assignment_status states
 * (pending_review/needs_revision/approved_awaiting_completion) that
 * assignments specifically can have. If lib/api/content-dispatches.ts
 * already queries that view for assignments, prefer wiring the timeline
 * through its existing fetcher instead of this one so the richer status
 * shows correctly there too.
 */
function normalizeDispatchRow(row: RawDispatchRow): MenteeContentDispatch {
  return {
    id: row.id,
    content_item_id: row.content_item_id,
    mentee_id: row.mentee_id,
    assigned_by: row.assigned_by,
    due_at: row.due_at,
    pushed_at: row.pushed_at,
    completed_at: row.completed_at,
    completed_by: row.completed_by,
    content_item: normalizeContentItemRow(row.content_item),
    completion_status: row.completed_at !== null ? "completed" : "not_started",
    latest_submission_status: null,
    total_submissions: 0,
  };
}

/**
 * Mentee timeline view: their own dispatches whose content_item has a due
 * date inside the visible range. Filtered client-side against the joined
 * content_item's submission_ends_at (same tradeoff fetchContentItems makes
 * elsewhere — PostgREST can't filter cleanly on a nested embed's column via
 * .gte, so range narrowing happens after the fetch rather than in the query).
 */
export async function fetchMenteeContentDispatchesInRange(
  menteeId: string,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<MenteeContentDispatch[]> {
  const { data, error } = await supabase
    .from("content_dispatches")
    .select("*, content_item:content_items(*, week:weeks(*), content_item_tags(tag:tags(*)))")
    .eq("mentee_id", menteeId);

  if (error) throw error;

  const dispatches = ((data ?? []) as unknown as RawDispatchRow[]).map(normalizeDispatchRow);

  return dispatches.filter((d) => {
    const endsAt = d.content_item.submission_ends_at;
    if (!endsAt) return false;
    return endsAt >= rangeStartIso && endsAt < rangeEndIso;
  });
}