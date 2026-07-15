// /types/resources.ts

export type ResourceCourseType =
  | "handbook"
  | "toolkit"
  | "template"
  | "video"
  | "guide"
  | "external_course";

export type ResourceStatus = "ongoing" | "paused" | "completed" | "abandoned";

export type ResourceFileType = "file" | "image" | "document" | "other";

export interface ResourceFileRef {
  id: string; // resource_files.id (join row id, not the file's own id)
  fileId: string;
  title: string | null;
  url: string | null;
  fileType: ResourceFileType;
}

export interface Resource {
  id: string;
  type: ResourceCourseType | null;
  title: string;
  description: string | null;
  links: string[] | null;
  status: ResourceStatus;
  week_number: number | null;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface ResourceWithFiles extends Resource {
  files: ResourceFileRef[];
}

/** Resource row plus the assignee's display name, used on the list page grid. */
export interface ResourceListItem extends Resource {
  assigneeName: string | null;
}

export interface ResourceUpdate {
  id: string;
  resource_id: string;
  mentee_id: string;
  progress_note: string;
  progress_percent: number | null;
  hours_spent: number | null;
  file_id: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface ResourceUpdateWithFile extends ResourceUpdate {
  file: ResourceFileRef | null;
}

export interface CreateResourceInput {
  type: ResourceCourseType;
  title: string;
  description: string;
  links: string[];
  weekNumber: number | null;
  createdBy: string;
}

export interface CreateResourceUpdateInput {
  resourceId: string;
  menteeId: string;
  progressNote: string;
  progressPercent: number | null;
  hoursSpent: number | null;
  fileId: string | null;
}