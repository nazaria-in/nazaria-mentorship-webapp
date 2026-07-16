// /lib/google/drive.ts

import { getGoogleAccessToken } from "./auth";

const GOOGLE_DRIVE_API_BASE =
  "https://www.googleapis.com/drive/v3";

/**
 * Performs an authenticated request to the Google Drive API.
 */
export async function googleDriveFetch(
  endpoint: string,
  init: RequestInit = {},
): Promise<Response> {
  const accessToken = await getGoogleAccessToken();

  const response = await fetch(
    `${GOOGLE_DRIVE_API_BASE}${endpoint}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Google Drive API request failed (${response.status})`,
    );
  }

  return response;
}