// /app/api/meetings/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createCalendarEvent } from "@/lib/google/calendar-events";
import type { UserRole } from "@/types/users";
import type { ExitSurveyTemplateEntry } from "@/types/exit-survey";
import { createPendingExitSurveys } from "@/lib/server/exit-survey-provisioning";



import { notifyMeetingInvite, scheduleMeetingReminders } from "@/lib/notifications/meeting-notifications";
import { scheduleExitSurveyReminders } from "@/lib/notifications/exit-survey-notifications";


interface CreateMeetingRequestBody {
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  participantUserIds: string[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as CreateMeetingRequestBody;

  if (!body.title || !body.startsAt || !body.endsAt) {
    return NextResponse.json({ error: "title, startsAt and endsAt are required" }, { status: 400 });
  }

  const { data: creatorProfile, error: creatorError } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", authUser.id)
    .single();

  if (creatorError || !creatorProfile) {
    return NextResponse.json({ error: "Could not load creator profile" }, { status: 400 });
  }

  const creatorRole = creatorProfile.role as UserRole;
  const participantIds = Array.from(new Set(body.participantUserIds.filter((id) => id !== authUser.id)));

  // Server-side re-check of invite permissions — the client-side candidate
  // list already scopes this, but this endpoint shouldn't trust an arbitrary
  // participant list from the request body.
  if (creatorRole === "mentee" || creatorRole === "mentor") {
    const { data: myPodRows, error: myPodError } = await supabase
      .from("pod_members")
      .select("pod_id")
      .eq("user_id", authUser.id);

    if (myPodError) {
      return NextResponse.json({ error: "Could not verify pod membership" }, { status: 400 });
    }

    const myPodIds = (myPodRows ?? []).map((r) => r.pod_id as string);

    const { data: allowedRows, error: allowedError } = await supabase
      .from("pod_members")
      .select("user_id")
      .in("pod_id", myPodIds);

    if (allowedError) {
      return NextResponse.json({ error: "Could not verify pod members" }, { status: 400 });
    }

    const allowedIds = new Set((allowedRows ?? []).map((r) => r.user_id as string));
    const invalid = participantIds.filter((id) => !allowedIds.has(id));

    if (invalid.length > 0) {
      return NextResponse.json({ error: "You can only invite members of your own pod" }, { status: 403 });
    }
  }

  const admin = supabaseAdmin;
  const allUserIds = [authUser.id, ...participantIds];

  const { data: emailRows, error: emailError } = await admin
    .from("users")
    .select("id, email")
    .in("id", allUserIds);

  if (emailError) {
    return NextResponse.json({ error: "Could not resolve participant emails" }, { status: 500 });
  }

  const attendeeEmails = (emailRows ?? [])
    .filter((row) => Boolean(row.email))
    .map((row) => ({ email: row.email as string }));

  let meetLink: string | null = null;
  let googleEventId: string | null = null;

  try {
    const event = await createCalendarEvent({
      summary: body.title,
      description: body.description,
      start: { dateTime: body.startsAt, timeZone: "Asia/Kolkata" },
      end: { dateTime: body.endsAt, timeZone: "Asia/Kolkata" },
      attendees: attendeeEmails,
    });

    googleEventId = event.id;
    meetLink = event.hangoutLink ?? null;
  } catch (calendarError) {
    console.error("[meetings] Google Calendar event creation failed", calendarError);
  }

  const { data: meeting, error: meetingError } = await admin
    .from("meetings")
    .insert({
      created_by: authUser.id,
      title: body.title,
      description: body.description ?? null,
      meet_link: meetLink,
      google_event_id: googleEventId,
      starts_at: body.startsAt,
      ends_at: body.endsAt,
      status: "scheduled",
    })
    .select("*")
    .single();

  if (meetingError || !meeting) {
    return NextResponse.json({ error: "Failed to create meeting" }, { status: 500 });
  }

  const meetingId = meeting.id as string;

  const participantRows = [
    {
      meeting_id: meetingId,
      user_id: authUser.id,
      status: "accepted" as const,
      invited_by: authUser.id,
      responded_at: new Date().toISOString(),
    },
    ...participantIds.map((id) => ({
      meeting_id: meetingId,
      user_id: id,
      status: "pending" as const,
      invited_by: authUser.id,
      responded_at: null,
    })),
  ];

  const { error: participantsError } = await admin.from("meeting_participants").insert(participantRows);

  if (participantsError) {
    return NextResponse.json({ error: "Meeting created but failed to add participants" }, { status: 500 });
  }

  // --- Meeting invite + reminder cascade notifications ---
  // Fire-and-continue on failure: the meeting itself is already committed
  // at this point, and a notification failure shouldn't fail the whole
  // request. Errors are logged loudly instead.
  const meetingForNotifications = {
    id: meetingId,
    title: meeting.title as string,
    starts_at: meeting.starts_at as string,
    ends_at: meeting.ends_at as string,
    meet_link: meeting.meet_link as string | null,
  };

  for (const participantId of participantIds) {
    try {
      await notifyMeetingInvite(admin, meetingForNotifications, participantId, authUser.id);
      await scheduleMeetingReminders(admin, meetingForNotifications, participantId);
    } catch (notificationError) {
      console.error("[meetings] Failed to notify/schedule reminders for participant", notificationError, {
        meetingId,
        participantId,
      });
    }
  }

  // --- Exit survey provisioning ---
  // Uses the deduped, voice_prompt_label-aware, rowsCreated-returning
  // implementation from lib/server/exit-survey-provisioning.ts. A previous
  // version of this file had a SECOND, older copy of this function defined
  // locally (returning only { warnings }, no rowsCreated) — that stale copy
  // shadowed this import and silently broke the `result.rowsCreated > 0`
  // check below, which is why exit-survey reminder notifications were never
  // scheduled even after exit_surveys rows existed. Do not reintroduce a
  // local copy of this function here.
  let exitSurveyWarnings: string[] = [];
  try {
    const result = await createPendingExitSurveys(meetingId, allUserIds);
    exitSurveyWarnings = result.warnings;
    if (result.warnings.length > 0) {
      console.warn("[meetings] Exit survey provisioning warnings:", result.warnings, { meetingId });
    }

    if (result.rowsCreated > 0) {
      const { data: createdSurveyRows, error: createdSurveyRowsError } = await admin
        .from("exit_surveys")
        .select("id, user_id")
        .eq("meeting_id", meetingId);

      if (createdSurveyRowsError) {
        console.error("[meetings] Failed to load created exit survey rows for reminder scheduling", createdSurveyRowsError, {
          meetingId,
        });
      } else if (createdSurveyRows && createdSurveyRows.length > 0) {
        await scheduleExitSurveyReminders(
          admin,
          createdSurveyRows.map((row) => ({
            exitSurveyId: row.id as string,
            submitterUserId: row.user_id as string,
            meetingTitle: meeting.title as string,
          })),
          { startsAt: meeting.starts_at as string, endsAt: meeting.ends_at as string }
        );
      }
    }
  } catch (exitSurveyError) {
    console.error("[meetings] Failed to create pending exit surveys", exitSurveyError, { meetingId });
    exitSurveyWarnings = ["Exit surveys could not be created for this meeting — see server logs."];
  }

  return NextResponse.json({ meeting, exitSurveyWarnings }, { status: 201 });
}