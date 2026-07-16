// /app/api/meetings/[meetingId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/google/calendar-events";
import type { UserRole } from "@/types/users";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface UpdateMeetingRequestBody {
  title?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  cancel?: boolean;
}

interface RouteParams {
  params: Promise<{ meetingId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { meetingId } = await params;
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: requesterProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();

  const requesterRole = requesterProfile?.role as UserRole | undefined;

  const admin = supabaseAdmin;
  const { data: meeting, error: meetingError } = await admin
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .is("deleted_at", null)
    .single();

  if (meetingError || !meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const isCreator = meeting.created_by === authUser.id;
  const isStaff = requesterRole === "pm" || requesterRole === "associate";

  if (!isCreator && !isStaff) {
    return NextResponse.json({ error: "Not allowed to edit this meeting" }, { status: 403 });
  }

  if (new Date(meeting.starts_at as string) <= new Date()) {
    return NextResponse.json(
      { error: "This meeting has already started and can no longer be edited" },
      { status: 403 },
    );
  }

  const body = (await request.json()) as UpdateMeetingRequestBody;

  if (body.cancel) {
    if (meeting.google_event_id) {
      try {
        await deleteCalendarEvent(meeting.google_event_id as string);
      } catch (calendarError) {
        console.error("[meetings] Failed to delete Calendar event", calendarError);
      }
    }

    const { error: cancelError } = await admin
      .from("meetings")
      .update({ status: "cancelled" })
      .eq("id", meetingId);

    if (cancelError) {
      return NextResponse.json({ error: "Failed to cancel meeting" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  const updates: Record<string, string> = {};
  if (body.title) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.startsAt) updates.starts_at = body.startsAt;
  if (body.endsAt) updates.ends_at = body.endsAt;

  if (meeting.google_event_id && (body.title || body.startsAt || body.endsAt)) {
    try {
      await updateCalendarEvent(meeting.google_event_id as string, {
        summary: body.title,
        start: body.startsAt ? { dateTime: body.startsAt, timeZone: "Asia/Kolkata" } : undefined,
        end: body.endsAt ? { dateTime: body.endsAt, timeZone: "Asia/Kolkata" } : undefined,
      });
    } catch (calendarError) {
      console.error("[meetings] Failed to update Calendar event", calendarError);
    }
  }

  const { data: updated, error: updateError } = await admin
    .from("meetings")
    .update(updates)
    .eq("id", meetingId)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Failed to update meeting" }, { status: 500 });
  }

  return NextResponse.json({ meeting: updated });
}