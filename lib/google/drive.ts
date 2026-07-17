// /lib/google/drive.ts

import { getGoogleAccessToken } from "./auth";

const GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const GOOGLE_DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

async function buildAuthHeaders(init: RequestInit): Promise<Headers> {
  const accessToken = await getGoogleAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

/**
 * Performs an authenticated request against the Drive metadata API
 * (create folder, query, delete, permissions, etc). NOT for uploads.
 */
export async function googleDriveFetch(
  endpoint: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = await buildAuthHeaders(init);

  const response = await fetch(`${GOOGLE_DRIVE_API_BASE}${endpoint}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Google Drive API request failed (${response.status}): ${errorBody}`,
    );
  }

  return response;
}

/**
 * Performs an authenticated request against the Drive UPLOAD API
 * (multipart/resumable file content). Separate base URL from
 * googleDriveFetch — /drive/v3 does not accept file bodies and will
 * try (and fail) to parse them as JSON.
 */
export async function googleDriveUploadFetch(
  endpoint: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = await buildAuthHeaders(init);

  const response = await fetch(`${GOOGLE_DRIVE_UPLOAD_BASE}${endpoint}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Google Drive upload API request failed (${response.status}): ${errorBody}`,
    );
  }

  return response;
}