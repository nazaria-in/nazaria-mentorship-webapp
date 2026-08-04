// /lib/api/content-items.ts

import { supabase } from "@/lib/supabase/client";
import { applyFilters } from "@/lib/filtering/apply-filters";
import { applySort } from "@/lib/filtering/apply-sort";
import { cancelContentReminders } from "@/lib/notifications/content-notifications";
import type { FilterFieldDef, FilterState, SortState } from "@/lib/filtering/types";
import type { ContentItem, ContentItemWithMeta, ContentType, Tag, Week } from "@/types/content";
import { createDefaultSubmissionTemplate, type ContentSubmissionTemplate } from "@/components/content/ContentSubmissionTemplateEditor";

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

interface FetchContentItemsParams {
  contentType: ContentType;
  fieldDefs: FilterFieldDef[];
  filterState: FilterState;
  sortState: SortState;
  /** Mentor management view: only their own authored items. */
  scopeToCreatedBy?: string;
}

/**
 * RESOLVED (was the tag-filter no-op): the tags embed needs `!inner` for a
 * `content_item_tags` filter clause to actually narrow results in
 * Postgrest, but a permanent `!inner` would hide untagged items even when
 * no tag filter is active. So this branches: use the default left join
 * when the "tags" relation field has no value selected, switch to
 * `!inner` only when it does.
 *
 * CORRECTED in this pass: the real `relation` kind is single-select — its
 * value in `filterState.values["tags"]` is a plain `string | undefined`
 * (one tag id), not a multi-select `{included, excluded}` shape. An
 * earlier pass here incorrectly assumed a 3-state multi-select had been
 * added to entity/relation filters; it hadn't — `enum` is the only kind
 * with include/exclude chip behavior in the real SmartFilterBar. This
 * check now matches EntityPicker/RelationPicker's actual single-value
 * shape.
 */
function isTagFilterActive(filterState: FilterState): boolean {
  const tagsFilter = filterState.values["tags"];
  return typeof tagsFilter === "string" && tagsFilter !== "";
}

export async function fetchContentItems({
  contentType,
  fieldDefs,
  filterState,
  sortState,
  scopeToCreatedBy,
}: FetchContentItemsParams): Promise<ContentItemWithMeta[]> {
  const tagsEmbed = isTagFilterActive(filterState)
    ? "content_item_tags!inner(tag:tags(*))"
    : "content_item_tags(tag:tags(*))";

  let query = supabase
    .from("content_items")
    .select(`*, week:weeks(*), ${tagsEmbed}`)
    .eq("content_type", contentType)
    .is("deleted_at", null);

  if (scopeToCreatedBy) query = query.eq("created_by", scopeToCreatedBy);

  query = applyFilters(query, fieldDefs, filterState);
  query = applySort(query, fieldDefs, sortState);

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as unknown as RawContentItemRow[]).map(normalizeContentItemRow);
}

export async function fetchContentItem(id: string): Promise<ContentItemWithMeta> {
  const { data, error } = await supabase
    .from("content_items")
    .select("*, week:weeks(*), content_item_tags(tag:tags(*))")
    .eq("id", id)
    .single();
  if (error) throw error;
  return normalizeContentItemRow(data as unknown as RawContentItemRow);
}

export async function fetchWeeks(): Promise<Week[]> {
  const { data, error } = await supabase
    .from("weeks")
    .select("*")
    .is("deleted_at", null)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return data as Week[];
}

export interface CreateWeekInput {
  name: string;
  start_date: string | null;
  end_date: string | null;
}

/**
 * Used by the inline "create or select a week" control in
 * ContentItemFormModal — shared across all three content types, since
 * `week_id` lives on `content_items` regardless of `content_type`.
 */
export async function createWeek(input: CreateWeekInput, existingWeeks: Week[]): Promise<Week> {
  const nextOrderIndex = existingWeeks.reduce((max, w) => Math.max(max, w.order_index), -1) + 1;

  const { data, error } = await supabase
    .from("weeks")
    .insert({
      name: input.name,
      start_date: input.start_date,
      end_date: input.end_date,
      order_index: nextOrderIndex,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Week;
}

export async function fetchTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from("tags").select("*").order("name", { ascending: true });
  if (error) throw error;
  return data as Tag[];
}

export async function createTag(name: string): Promise<Tag> {
  const { data, error } = await supabase.from("tags").insert({ name }).select().single();
  if (error) throw error;
  return data as Tag;
}

interface CreateContentItemInput {
  content_type: ContentType;
  title: string;
  description: string | null;
  instructions: string | null;
  week_id: string | null;
  submission_template: ContentSubmissionTemplate;
  created_by: string;
  tag_ids: string[];
  /**
   * Required by content_items_submission_window_check whenever
   * submission_template.metadata.is_not_required is false. Pass null/null
   * for "No submission" content.
   */
  submission_starts_at: string | null;
  submission_ends_at: string | null;
}

export async function createContentItem(input: CreateContentItemInput): Promise<ContentItemWithMeta> {
  const { data: item, error } = await supabase
    .from("content_items")
    .insert({
      content_type: input.content_type,
      title: input.title,
      description: input.description,
      instructions: input.instructions,
      week_id: input.week_id,
      submission_template: input.submission_template,
      created_by: input.created_by,
      submission_starts_at: input.submission_starts_at,
      submission_ends_at: input.submission_ends_at,
    })
    .select()
    .single();
  if (error) throw error;

  if (input.tag_ids.length > 0) {
    const { error: tagError } = await supabase
      .from("content_item_tags")
      .insert(input.tag_ids.map((tag_id) => ({ content_item_id: item.id, tag_id })));
    if (tagError) throw tagError;
  }

  return fetchContentItem(item.id);
}

interface UpdateContentItemInput {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  week_id: string | null;
  submission_template: ContentSubmissionTemplate;
  tag_ids: string[];
  submission_starts_at: string | null;
  submission_ends_at: string | null;
}

export async function updateContentItem(input: UpdateContentItemInput): Promise<ContentItemWithMeta> {
  const { error } = await supabase
    .from("content_items")
    .update({
      title: input.title,
      description: input.description,
      instructions: input.instructions,
      week_id: input.week_id,
      submission_template: input.submission_template,
      submission_starts_at: input.submission_starts_at,
      submission_ends_at: input.submission_ends_at,
    })
    .eq("id", input.id);
  if (error) throw error;

  // Simplest correct approach for a small tag set: replace the join rows
  // wholesale rather than diffing. Fine at this scale; revisit if tag lists
  // per item ever get long enough for this to matter.
  const { error: deleteError } = await supabase.from("content_item_tags").delete().eq("content_item_id", input.id);
  if (deleteError) throw deleteError;

  if (input.tag_ids.length > 0) {
    const { error: insertError } = await supabase
      .from("content_item_tags")
      .insert(input.tag_ids.map((tag_id) => ({ content_item_id: input.id, tag_id })));
    if (insertError) throw insertError;
  }

  return fetchContentItem(input.id);
}

/**
 * ADDED: cancels any pending reminders across every dispatch under this
 * item before soft-deleting it — same reasoning as removeContentDispatch
 * cancelling reminders for a single dispatch. A deleted item's mentees
 * shouldn't keep getting "wrap up soon" nudges for something that no
 * longer exists. Best-effort: logged, not thrown, so a notification
 * cleanup hiccup never blocks the actual delete.
 */
export async function softDeleteContentItem(id: string): Promise<void> {
  const { data: dispatches, error: dispatchesError } = await supabase
    .from("content_dispatches")
    .select("id")
    .eq("content_item_id", id);
  if (dispatchesError) throw dispatchesError;

  await Promise.all(
    (dispatches ?? []).map((d) =>
      cancelContentReminders(supabase, d.id as string).catch((err) => {
        console.error("[content-items] Failed to cancel reminders for dispatch during item delete", d.id, err);
      })
    )
  );

  const { error } = await supabase.from("content_items").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export function defaultTemplateFor(contentType: ContentType): ContentSubmissionTemplate {
  return createDefaultSubmissionTemplate(contentType);
}

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  assignment: "Assignment",
  course: "Course",
  resource: "Resource",
};