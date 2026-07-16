// /app/api/meetings/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createCalendarEvent } from "@/lib/google/calendar-events";
import type { UserRole } from "@/types/users";

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

  // email now lives directly on public.users (see 20260716_meetings_and_email.sql)
  // — one table select, no more per-user admin.auth.admin.getUserById calls.
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
    // Meeting still gets created without a meet link rather than blocking
    // the whole flow on a Calendar API outage.
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

  const participantRows = [
    {
      meeting_id: meeting.id as string,
      user_id: authUser.id,
      status: "accepted" as const,
      invited_by: authUser.id,
      responded_at: new Date().toISOString(),
    },
    ...participantIds.map((id) => ({
      meeting_id: meeting.id as string,
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

  return NextResponse.json({ meeting }, { status: 201 });
}