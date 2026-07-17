// /lib/google/drive-folders.ts

import { createFolder, findFolderByName } from "./drive-files";

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

/**
 * Path string -> Drive folder id. In-memory only, per server instance —
 * not persisted anywhere on purpose. A cache miss just costs one extra
 * search-then-maybe-create round trip; ensureFolder() below is idempotent,
 * so a cold cache never produces a duplicate folder, just a slower first hit.
 */
const folderIdCache = new Map<string, string>();

async function ensureFolder(name: string, parentId: string): Promise<string> {
  const existing = await findFolderByName(name, parentId);
  if (existing) return existing.id;

  const created = await createFolder({ name, parentFolderId: parentId });
  return created.id;
}

/**
 * "Cohort Alpha" + uuid -> "Cohort Alpha_3f9e2b1a". Parent folder already
 * scopes uniqueness, so we only need enough of the id to disambiguate two
 * same-named cohorts/pods/mentees visually — not the full uuid cluttering
 * every folder name in Drive's UI.
 */
function slugSegment(name: string, id: string): string {
  return `${name.trim()}_${id.slice(0, 8)}`;
}

async function resolvePath(segments: string[]): Promise<string> {
  if (!ROOT_FOLDER_ID) {
    throw new Error("Missing GOOGLE_DRIVE_ROOT_FOLDER_ID");
  }

  let parentId = ROOT_FOLDER_ID;
  let pathSoFar = "";

  for (const segment of segments) {
    pathSoFar = pathSoFar ? `${pathSoFar}/${segment}` : segment;

    const cached = folderIdCache.get(pathSoFar);
    if (cached) {
      parentId = cached;
      continue;
    }

    parentId = await ensureFolder(segment, parentId);
    folderIdCache.set(pathSoFar, parentId);
  }

  return parentId;
}

export interface AssignmentMenteeFolderInput {
  cohortName: string;
  cohortId: string;
  podName: string;
  podId: string;
  assignmentTitle: string;
  assignmentId: string;
  menteeName: string;
  menteeId: string;
}

/**
 * cohort_name_id/pod_name_id/assignments/assignment_title_id/mentee_name_id
 */
export async function resolveAssignmentMenteeFolder(
  input: AssignmentMenteeFolderInput,
): Promise<string> {
  return resolvePath([
    slugSegment(input.cohortName, input.cohortId),
    slugSegment(input.podName, input.podId),
    "assignments",
    slugSegment(input.assignmentTitle, input.assignmentId),
    slugSegment(input.menteeName, input.menteeId),
  ]);
}

export interface ResourceMenteeFolderInput {
  cohortName: string;
  cohortId: string;
  podName: string;
  podId: string;
  resourceTitle: string;
  resourceId: string;
  menteeName: string;
  menteeId: string;
}

/**
 * cohort_name_id/pod_name_id/resources/resource_name_id/mentee_name_id
 */
export async function resolveResourceMenteeFolder(
  input: ResourceMenteeFolderInput,
): Promise<string> {
  return resolvePath([
    slugSegment(input.cohortName, input.cohortId),
    slugSegment(input.podName, input.podId),
    "resources",
    slugSegment(input.resourceTitle, input.resourceId),
    slugSegment(input.menteeName, input.menteeId),
  ]);
}