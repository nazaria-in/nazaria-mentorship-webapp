// /app/api/meetings/[meetingId]/backfill-exit-surveys/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createPendingExitSurveys } from "@/lib/server/exit-survey-provisioning";
import type { UserRole } from "@/types/users";

interface RouteParams {
  params: Promise<{ meetingId: string }>;
}

/**
 * Safety net: recreate pending exit_surveys rows for a meeting that ended
 * up with none (e.g. no active template existed at meeting-creation time).
 * Safe to call repeatedly — createPendingExitSurveys upserts with
 * ignoreDuplicates on (meeting_id, user_id, subject_user_id), so it never
 * clobbers an already-submitted row.
 */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { meetingId } = await params;
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("users").select("role").eq("id", authUser.id).single();
  const role = profile?.role as UserRole | undefined;

  if (role !== "pm" && role !== "associate") {
    return NextResponse.json({ error: "Staff only" }, { status: 403 });
  }

  const admin = supabaseAdmin;
  const { data: participantRows, error: participantsError } = await admin
    .from("meeting_participants")
    .select("user_id")
    .eq("meeting_id", meetingId);

  if (participantsError) {
    return NextResponse.json({ error: "Could not load meeting participants" }, { status: 500 });
  }
  if (!participantRows || participantRows.length === 0) {
    return NextResponse.json({ error: "Meeting has no participants" }, { status: 400 });
  }

  try {
    const result = await createPendingExitSurveys(
      meetingId,
      participantRows.map((r) => r.user_id as string)
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backfill failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}