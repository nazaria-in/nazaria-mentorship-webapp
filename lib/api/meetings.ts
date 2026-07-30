// /lib/api/meetings.ts

import { createClient } from "@/lib/supabase/client";
import { fetchPodMemberGroups } from "@/lib/api/pods";
import { cancelMeetingRemindersForParticipant } from "@/lib/notifications/meeting-notifications";
import type { UserRole } from "@/types/users";
import type {
  Meeting,
  MeetingParticipant,
  MeetingWithParticipants,
  ParticipantStatus,
  InviteCandidate,
} from "@/types/meetings";

interface RawParticipantRow {
  id: string;
  meeting_id: string;
  user_id: string;
  status: ParticipantStatus;
  invited_by: string | null;
  responded_at: string | null;
  user: { id: string; full_name: string | null; role: UserRole } | null;
}

interface RawMeetingRow extends Meeting {
  meeting_participants: RawParticipantRow[];
}

const MEETING_SELECT = `*, meeting_participants(
  id, meeting_id, user_id, status, invited_by, responded_at,
  user:users!meeting_participants_user_id_fkey(id, full_name, role)
)`;

function hydrateMeeting(row: RawMeetingRow): MeetingWithParticipants {
  return {
    ...row,
    participants: row.meeting_participants.map((p) => ({
      id: p.id,
      meeting_id: p.meeting_id,
      user_id: p.user_id,
      status: p.status,
      invited_by: p.invited_by,
      responded_at: p.responded_at,
      user: p.user
        ? { id: p.user.id, full_name: p.user.full_name?.trim() || "Unnamed", role: p.user.role }
        : undefined,
    })),
  };
}

/**
 * Fetches meetings whose window overlaps [rangeStart, rangeEnd) — for the
 * calendar grid. pm/associate see every meeting (staff oversight); everyone
 * else only sees meetings they're actually a participant on. Two-step for
 * the scoped case (participant meeting_ids, then meetings with full
 * participant lists) so the returned participant arrays aren't accidentally
 * trimmed to just the requesting user's own row.
 */
export async function fetchMeetingsInRange(params: {
  userId: string | null;
  role: UserRole;
  rangeStart: string;
  rangeEnd: string;
}): Promise<MeetingWithParticipants[]> {
  const { userId, role, rangeStart, rangeEnd } = params;
  const supabase = createClient();
  const isStaff = role === "pm" || role === "associate";

  if (!isStaff && !userId) return [];

  let query = supabase
    .from("meetings")
    .select(MEETING_SELECT)
    .is("deleted_at", null)
    .lt("starts_at", rangeEnd)
    .gt("ends_at", rangeStart)
    .order("starts_at", { ascending: true });

  if (!isStaff) {
    const { data: participantRows, error: participantError } = await supabase
      .from("meeting_participants")
      .select("meeting_id")
      .eq("user_id", userId as string);

    if (participantError) throw participantError;

    const meetingIds = (participantRows ?? []).map((r) => r.meeting_id as string);
    if (meetingIds.length === 0) return [];

    query = query.in("id", meetingIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as unknown as RawMeetingRow[]).map(hydrateMeeting);
}

/**
 * Meetings a given user is pending on (invited, not yet responded) — backs
 * the shared AcceptDeclineControls surface wherever it's mounted.
 */
export async function fetchPendingInvitesForUser(userId: string): Promise<MeetingWithParticipants[]> {
  const supabase = createClient();

  const { data: participantRows, error: participantError } = await supabase
    .from("meeting_participants")
    .select("meeting_id")
    .eq("user_id", userId)
    .eq("status", "pending");

  if (participantError) throw participantError;

  const meetingIds = (participantRows ?? []).map((r) => r.meeting_id as string);
  if (meetingIds.length === 0) return [];

  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_SELECT)
    .in("id", meetingIds)
    .is("deleted_at", null)
    .order("starts_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as RawMeetingRow[]).map(hydrateMeeting);
}

export async function fetchMeetingById(meetingId: string): Promise<MeetingWithParticipants | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_SELECT)
    .eq("id", meetingId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return hydrateMeeting(data as unknown as RawMeetingRow);
}

/**
 * Accept or decline a pending invite by participant row id. Pure
 * client-side RSVP — no notification side effects here, since callers
 * that already have a participantId in hand may not have a meetingId
 * loaded. Use respondToMeetingInvite below when you have meetingId
 * instead (e.g. from a notification card, which only carries meeting_id).
 */
export async function updateParticipantStatus(
  participantId: string,
  status: Extract<ParticipantStatus, "accepted" | "declined">,
): Promise<MeetingParticipant> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("meeting_participants")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", participantId)
    .select("id, meeting_id, user_id, status, invited_by, responded_at")
    .single();

  if (error) throw error;
  return data as MeetingParticipant;
}

/**
 * Preferred entry point when you only have a meeting_id + the current
 * user (this is what notification cards have — a meeting_invite
 * notification carries meeting_id, not the participant row id). Resolves
 * the participant row, updates status, and — on decline — cancels that
 * user's pending reminder cascade for this meeting.
 */
export async function respondToMeetingInvite(
  meetingId: string,
  status: Extract<ParticipantStatus, "accepted" | "declined">,
): Promise<MeetingParticipant> {
  const supabase = createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not authenticated.");

  const { data: participant, error: participantError } = await supabase
    .from("meeting_participants")
    .select("id")
    .eq("meeting_id", meetingId)
    .eq("user_id", userData.user.id)
    .single();

  if (participantError || !participant) {
    throw new Error(participantError?.message ?? "Participant record not found for this meeting.");
  }

  const updated = await updateParticipantStatus(participant.id as string, status);

  if (status === "declined") {
    try {
      await cancelMeetingRemindersForParticipant(supabase, meetingId, userData.user.id);
    } catch (notificationError) {
      console.error("[meetings] Failed to cancel reminders on decline", notificationError);
    }
  }

  return updated;
}

/**
 * Invite candidates for the creation form.
 * - mentor/mentee: every member (mentor + mentee) of the requester's own pod(s).
 * - pm/associate: every approved user.
 * Self is always excluded.
 */
export async function fetchInviteCandidates(
  requesterId: string,
  requesterRole: UserRole,
): Promise<InviteCandidate[]> {
  const supabase = createClient();

  if (requesterRole === "pm" || requesterRole === "associate") {
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, role")
      .is("deleted_at", null)
      .eq("approval_status", "approved")
      .neq("id", requesterId)
      .order("full_name", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((u) => ({
      id: u.id as string,
      full_name: (u.full_name as string | null)?.trim() || "Unnamed",
      role: u.role as UserRole,
    }));
  }

  // mentor or mentee: merge both roles across the requester's own pod(s)
  const [mentorGroups, menteeGroups] = await Promise.all([
    fetchPodMemberGroups({ role: "mentor", mentorId: requesterId, includeEmptyPods: true }),
    fetchPodMemberGroups({ role: "mentee", mentorId: requesterId, includeEmptyPods: true }),
  ]);

  const byId = new Map<string, InviteCandidate>();

  for (const pod of mentorGroups) {
    for (const m of pod.members) {
      if (m.id !== requesterId) byId.set(m.id, { id: m.id, full_name: m.full_name, role: "mentor" });
    }
  }
  for (const pod of menteeGroups) {
    for (const m of pod.members) {
      if (m.id !== requesterId) byId.set(m.id, { id: m.id, full_name: m.full_name, role: "mentee" });
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
}