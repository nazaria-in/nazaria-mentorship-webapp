// /lib/api/content-items.ts

import { supabase } from "@/lib/supabase/client";
import { applyFilters } from "@/lib/filtering/apply-filters";
import { applySort } from "@/lib/filtering/apply-sort";
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
 * TODO / SCHEMA GAP: the tags embed below is a left join (`content_item_tags(tag:tags(*))`),
 * not `!inner`, so items with zero tags still show up when no tag filter is
 * active — that's the correct default-list behavior. BUT per the SmartFilterBar
 * guide, applyFilters can't add the `!inner` for you, so if filterState has a
 * "tags" value selected, the resulting `.eq("content_item_tags.tag_id", ...)`
 * clause is silently a no-op against a left join in Postgrest. Until this is
 * fixed (likely: a dedicated content_items_with_tags view, same pattern as
 * v_mentee_assignment_status), tag filtering only reliably narrows results
 * when combined with a week filter or search — flagging this rather than
 * quietly shipping a filter that looks like it works but doesn't.
 */
export async function fetchContentItems({
  contentType,
  fieldDefs,
  filterState,
  sortState,
  scopeToCreatedBy,
}: FetchContentItemsParams): Promise<ContentItemWithMeta[]> {
  let query = supabase
    .from("content_items")
    .select("*, week:weeks(*), content_item_tags(tag:tags(*))")
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
 *
 * order_index: new weeks are appended after the current max so they sort
 * last by default; the mentor can still reorder weeks elsewhere if that
 * UI exists. Computed client-side from the already-fetched weeks list
 * rather than a round trip, since this is a management-UI convenience,
 * not a value that needs to be transactionally safe against concurrent
 * creates (worst case two weeks tie on order_index and sort by name/id
 * next, not a correctness issue).
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

export async function softDeleteContentItem(id: string): Promise<void> {
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