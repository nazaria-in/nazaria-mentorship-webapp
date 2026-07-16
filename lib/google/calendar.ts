// /lib/google/calendar.ts

import { getGoogleAccessToken } from "./auth";

const GOOGLE_CALENDAR_API_BASE =
  "https://www.googleapis.com/calendar/v3";

/**
 * Performs an authenticated request to the Google Calendar API.
 */
export async function googleCalendarFetch(
  endpoint: string,
  init: RequestInit = {},
): Promise<Response> {
  const accessToken = await getGoogleAccessToken();

  const response = await fetch(
    `${GOOGLE_CALENDAR_API_BASE}${endpoint}`,
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
      `Google Calendar API request failed (${response.status})`,
    );
  }

  return response;
}