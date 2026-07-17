// /lib/google/drive-files.ts

import { googleDriveFetch, googleDriveUploadFetch } from "./drive";

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
}

export interface CreateFolderInput {
  name: string;
  parentFolderId?: string;
}

export async function createFolder(
  input: CreateFolderInput,
): Promise<GoogleDriveFile> {
  const response = await googleDriveFetch(
    "/files?fields=id,name,mimeType,webViewLink,webContentLink",
    {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        mimeType: "application/vnd.google-apps.folder",
        parents: input.parentFolderId
          ? [input.parentFolderId]
          : undefined,
      }),
    },
  );

  return (await response.json()) as GoogleDriveFile;
}

/**
 * Finds a folder by exact name under a given parent. Returns null if none
 * exists. Used by drive-folders.ts to make folder resolution idempotent —
 * always search before create, never assume a folder is missing.
 */
export async function findFolderByName(
  name: string,
  parentFolderId: string,
): Promise<GoogleDriveFile | null> {
  const q = `name = '${escapeDriveQueryValue(name)}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const response = await googleDriveFetch(
    `/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&pageSize=1`,
  );
  const data = (await response.json()) as { files: GoogleDriveFile[] };
  return data.files[0] ?? null;
}

function escapeDriveQueryValue(value: string): string {
  // Drive's query language uses single-quoted string literals; both the
  // quote and the escape character itself need escaping.
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function getFileMetadata(
  fileId: string,
): Promise<GoogleDriveFile> {
  const response = await googleDriveFetch(
    `/files/${fileId}?fields=id,name,mimeType,webViewLink,webContentLink`,
  );

  return (await response.json()) as GoogleDriveFile;
}

export async function deleteFile(
  fileId: string,
): Promise<void> {
  await googleDriveFetch(`/files/${fileId}`, {
    method: "DELETE",
  });
}

export interface UploadFileInput {
  name: string;
  mimeType: string;
  data: Blob;
  parentFolderId?: string;
}

export async function uploadFile(
  input: UploadFileInput,
): Promise<GoogleDriveFile> {
  const boundary = "google-upload-boundary";

  const metadata = {
    name: input.name,
    mimeType: input.mimeType,
    parents: input.parentFolderId ? [input.parentFolderId] : undefined,
  };

  const dataBuffer = Buffer.from(await input.data.arrayBuffer());

  const bodyBuffer = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${input.mimeType}\r\n\r\n`,
    ),
    dataBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const response = await googleDriveUploadFetch(
    "/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: bodyBuffer,
    },
  );

  return (await response.json()) as GoogleDriveFile;
}

export async function makeFilePubliclyViewable(fileId: string): Promise<void> {
  await googleDriveFetch(`/files/${fileId}/permissions`, {
    method: "POST",
    body: JSON.stringify({
      role: "reader",
      type: "anyone",
    }),
  });
}
