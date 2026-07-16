// /lib/google/calendar-events.ts

import { googleCalendarFetch } from "./calendar";

export interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
}

export interface CreateCalendarEventInput {
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{
    email: string;
  }>;
}

const DEFAULT_CALENDAR = "primary";

export async function createCalendarEvent(
  input: CreateCalendarEventInput,
): Promise<GoogleCalendarEvent> {
  const response = await googleCalendarFetch(
    `/calendars/${encodeURIComponent(
      input.calendarId ?? DEFAULT_CALENDAR,
    )}/events?conferenceDataVersion=1`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: input.start,
        end: input.end,
        attendees: input.attendees,
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
          },
        },
      }),
    },
  );

  return (await response.json()) as GoogleCalendarEvent;
}

export async function updateCalendarEvent(
  eventId: string,
  updates: Partial<CreateCalendarEventInput>,
  calendarId = DEFAULT_CALENDAR,
): Promise<GoogleCalendarEvent> {
  const response = await googleCalendarFetch(
    `/calendars/${encodeURIComponent(
      calendarId,
    )}/events/${eventId}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    },
  );

  return (await response.json()) as GoogleCalendarEvent;
}

export async function deleteCalendarEvent(
  eventId: string,
  calendarId = DEFAULT_CALENDAR,
): Promise<void> {
  await googleCalendarFetch(
    `/calendars/${encodeURIComponent(
      calendarId,
    )}/events/${eventId}`,
    {
      method: "DELETE",
    },
  );
}

export async function getCalendarEvent(
  eventId: string,
  calendarId = DEFAULT_CALENDAR,
): Promise<GoogleCalendarEvent> {
  const response = await googleCalendarFetch(
    `/calendars/${encodeURIComponent(
      calendarId,
    )}/events/${eventId}`,
  );

  return (await response.json()) as GoogleCalendarEvent;
}