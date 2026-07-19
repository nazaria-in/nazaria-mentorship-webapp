// /lib/api/uploads.ts

import { createClient } from "@/lib/supabase/client";
import type { FileOrLinkValue } from "@/components/shared/FileOrLinkInput";
import type { UploadBoxFileType, UploadedFileRef } from "@/components/shared/uploadbox/UploadBox";

export type UploadContext =
  | { kind: "assignment_submission"; menteeAssignmentId: string }
  | { kind: "resource_update"; resourceId: string; menteeId: string };

function guessFileType(mimeType: string): UploadBoxFileType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf" || mimeType.includes("document") || mimeType.includes("text")) {
    return "document";
  }
  return "file";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function postToUploadRoute(file: File, context: UploadContext): Promise<{ id: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("contextKind", context.kind);
  if (context.kind === "assignment_submission") {
    formData.append("menteeAssignmentId", context.menteeAssignmentId);
  } else {
    formData.append("resourceId", context.resourceId);
    formData.append("menteeId", context.menteeId);
  }

  const response = await fetch("/api/uploads", { method: "POST", body: formData });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error ?? "Upload failed");
  }

  const result = (await response.json()) as { fileId: string; url: string };
  return { id: result.fileId, url: result.url };
}

// Used by AddSubmissionForm's link-or-file input. Link mode: inserts a
// `files` row directly. File mode: routes through /api/uploads, which does
// the real Drive upload server-side and creates the `files` row itself.
export async function uploadFile(value: FileOrLinkValue, context: UploadContext): Promise<string> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  if (value.kind === "link") {
    // file_type "link" is NOT a valid link_type enum value ({file,image,document,other}).
    // Using "other" instead — it's the correct bucket for externally-hosted links
    // where we don't know/care about the underlying mime type.
    const { data, error } = await supabase
      .from("files")
      .insert({ url: value.url, file_type: "other", created_by: userId })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  if (!value.file) throw new Error("No file selected");
  const { id } = await postToUploadRoute(value.file, context);
  return id;
}

// Used by UploadBox for the "upload immediately on pick" flow. Returns the
// already-created files.id — callers should NOT insert a files row again.
export async function uploadRawFile(file: File, context: UploadContext): Promise<UploadedFileRef> {
  const { id, url } = await postToUploadRoute(file, context);
  return {
    id,
    name: file.name,
    url,
    fileType: guessFileType(file.type),
    sizeLabel: formatSize(file.size),
  };
}

// Creates a `files` row for a plain external link (e.g. a public Google
// Drive share link pasted by a mentee) without going through /api/uploads.
// `context` is accepted for signature symmetry with the other creators and
// so future work (e.g. logging which submission a link belongs to) has it
// on hand, but it isn't persisted anywhere today — the files table has no
// context-tracking columns.
export async function createFileFromLink(url: string, context: UploadContext): Promise<UploadedFileRef> {
  void context;
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("files")
    .insert({ url, file_type: "other", created_by: userId })
    .select("id, url")
    .single();
  if (error) throw error;

  const row = data as { id: string; url: string };
  return {
    id: row.id,
    name: url,
    url: row.url,
    fileType: "other",
    sizeLabel: "",
  };
}