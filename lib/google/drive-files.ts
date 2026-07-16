// /lib/google/drive-files.ts

import { googleDriveFetch } from "./drive";

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
  const response = await googleDriveFetch("/files", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      mimeType: "application/vnd.google-apps.folder",
      parents: input.parentFolderId
        ? [input.parentFolderId]
        : undefined,
    }),
  });

  return (await response.json()) as GoogleDriveFile;
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
    parents: input.parentFolderId
      ? [input.parentFolderId]
      : undefined,
  };

  const body = new Blob([
    `--${boundary}\r
Content-Type: application/json; charset=UTF-8\r
\r
${JSON.stringify(metadata)}\r
--${boundary}\r
Content-Type: ${input.mimeType}\r
\r
`,
    input.data,
    `\r
--${boundary}--`,
  ]);

  const response = await googleDriveFetch(
    "/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  return (await response.json()) as GoogleDriveFile;
}