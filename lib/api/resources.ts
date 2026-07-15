// /lib/api/resources.ts

import { supabase } from "@/lib/supabase/client";
import type {
  CreateResourceInput,
  CreateResourceUpdateInput,
  Resource,
  ResourceFileRef,
  ResourceFileType,
  ResourceStatus,
  ResourceUpdate,
  ResourceUpdateWithFile,
  ResourceWithFiles,
} from "@/types/resources";

interface ResourceRow {
  id: string;
  type: string | null;
  title: string;
  description: string | null;
  links: string[] | null;
  status: string;
  week_number: number | null;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  deleted_at: string | null;
}

interface FileRow {
  id: string;
  title: string | null;
  url: string | null;
  file_type: string;
}

interface ResourceFileJoinRow {
  id: string;
  file_id: string;
  files: FileRow | null;
}

interface ResourceUpdateRow {
  id: string;
  resource_id: string;
  mentee_id: string;
  progress_note: string;
  progress_percent: number | null;
  hours_spent: string | number | null;
  file_id: string | null;
  created_at: string;
  deleted_at: string | null;
  files: FileRow | null;
}

const RESOURCE_SELECT = "*";
const RESOURCE_WITH_FILES_SELECT = "*, resource_files(id, file_id, files(id, title, url, file_type))";

export function mapResourceRow(row: ResourceRow): Resource {
  return {
    id: row.id,
    type: (row.type as Resource["type"]) ?? null,
    title: row.title,
    description: row.description,
    links: row.links,
    status: row.status as ResourceStatus,
    week_number: row.week_number,
    created_by: row.created_by,
    assigned_to: row.assigned_to,
    created_at: row.created_at,
    deleted_at: row.deleted_at,
  };
}

function mapFileRef(joinId: string, file: FileRow | null): ResourceFileRef | null {
  if (!file) return null;
  return {
    id: joinId,
    fileId: file.id,
    title: file.title,
    url: file.url,
    fileType: (file.file_type as ResourceFileType) ?? "other",
  };
}

/** Single resource with attached files, for the detail page. */
export async function fetchResource(resourceId: string): Promise<ResourceWithFiles | null> {
  const { data, error } = await supabase
    .from("resources_and_courses")
    .select(RESOURCE_WITH_FILES_SELECT)
    .eq("id", resourceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as ResourceRow & { resource_files: ResourceFileJoinRow[] | null };
  const files = (row.resource_files ?? [])
    .map((rf) => mapFileRef(rf.id, rf.files))
    .filter((f): f is ResourceFileRef => f !== null);

  return { ...mapResourceRow(row), files };
}

/**
 * Creates one resources_and_courses row per id in `assignedToIds`. There is
 * no shared "template" row — mentee self-assignment passes a single id
 * ([currentUserId]); mentor/staff dispatch to a pod passes every mentee id
 * in it. Each row is fully independent afterwards (own status, own
 * resource_updates).
 */
export async function createResources(input: CreateResourceInput, assignedToIds: string[]): Promise<Resource[]> {
  if (assignedToIds.length === 0) throw new Error("At least one mentee must be assigned.");

  const rows = assignedToIds.map((assignedTo) => ({
    type: input.type,
    title: input.title,
    description: input.description,
    links: input.links.length > 0 ? input.links : null,
    week_number: input.weekNumber,
    created_by: input.createdBy,
    assigned_to: assignedTo,
    status: "ongoing" satisfies ResourceStatus,
  }));

  const { data, error } = await supabase.from("resources_and_courses").insert(rows).select(RESOURCE_SELECT);
  if (error) throw error;
  return (data as ResourceRow[]).map(mapResourceRow);
}

export interface UpdateResourceInput {
  type?: Resource["type"];
  title?: string;
  description?: string;
  links?: string[];
  weekNumber?: number | null;
  status?: ResourceStatus;
}

export async function updateResource(resourceId: string, patch: UpdateResourceInput): Promise<Resource> {
  const payload: Partial<ResourceRow> = {};
  if (patch.type !== undefined) payload.type = patch.type;
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.links !== undefined) payload.links = patch.links.length > 0 ? patch.links : null;
  if (patch.weekNumber !== undefined) payload.week_number = patch.weekNumber;
  if (patch.status !== undefined) payload.status = patch.status;

  const { data, error } = await supabase
    .from("resources_and_courses")
    .update(payload)
    .eq("id", resourceId)
    .select(RESOURCE_SELECT)
    .single();

  if (error) throw error;
  return mapResourceRow(data as ResourceRow);
}

export async function softDeleteResource(resourceId: string): Promise<void> {
  const { error } = await supabase
    .from("resources_and_courses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", resourceId);
  if (error) throw error;
}

export interface DemoFileInput {
  title: string;
  url: string;
  fileType: ResourceFileType;
}

/** Inserts `files` rows for demo-uploaded attachments and returns their ids. */
export async function insertFileRecords(files: DemoFileInput[], createdBy: string): Promise<string[]> {
  if (files.length === 0) return [];

  const { data, error } = await supabase
    .from("files")
    .insert(files.map((f) => ({ title: f.title, url: f.url, file_type: f.fileType, created_by: createdBy })))
    .select("id");

  if (error) throw error;
  return (data as { id: string }[]).map((f) => f.id);
}

/** Links already-inserted file ids to a resource via the resource_files join table. */
export async function linkFilesToResource(resourceId: string, fileIds: string[]): Promise<void> {
  if (fileIds.length === 0) return;
  const rows = fileIds.map((fileId) => ({ resource_id: resourceId, file_id: fileId }));
  const { error } = await supabase.from("resource_files").insert(rows);
  if (error) throw error;
}

function mapUpdateRow(row: ResourceUpdateRow): ResourceUpdateWithFile {
  return {
    id: row.id,
    resource_id: row.resource_id,
    mentee_id: row.mentee_id,
    progress_note: row.progress_note,
    progress_percent: row.progress_percent,
    hours_spent: row.hours_spent === null ? null : Number(row.hours_spent),
    file_id: row.file_id,
    created_at: row.created_at,
    deleted_at: row.deleted_at,
    file: row.file_id ? mapFileRef(row.file_id, row.files) : null,
  };
}

export async function fetchResourceUpdates(resourceId: string): Promise<ResourceUpdateWithFile[]> {
  const { data, error } = await supabase
    .from("resource_updates")
    .select("*, files(id, title, url, file_type)")
    .eq("resource_id", resourceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as ResourceUpdateRow[]).map(mapUpdateRow);
}

export async function createResourceUpdate(input: CreateResourceUpdateInput): Promise<ResourceUpdate> {
  const { data, error } = await supabase
    .from("resource_updates")
    .insert({
      resource_id: input.resourceId,
      mentee_id: input.menteeId,
      progress_note: input.progressNote,
      progress_percent: input.progressPercent,
      hours_spent: input.hoursSpent,
      file_id: input.fileId,
    })
    .select("*")
    .single();

  if (error) throw error;
  const row = data as ResourceUpdateRow;
  return {
    id: row.id,
    resource_id: row.resource_id,
    mentee_id: row.mentee_id,
    progress_note: row.progress_note,
    progress_percent: row.progress_percent,
    hours_spent: row.hours_spent === null ? null : Number(row.hours_spent),
    file_id: row.file_id,
    created_at: row.created_at,
    deleted_at: row.deleted_at,
  };
}