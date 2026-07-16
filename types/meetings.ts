// /types/meetings.ts

import type { UserRole } from "./users";

export type MeetingStatus = "scheduled" | "completed" | "cancelled";
export type ParticipantStatus = "pending" | "accepted" | "declined";

export interface Meeting {
  id: string;
  series_id: string | null;
  created_by: string;
  title: string;
  description: string | null;
  meet_link: string | null;
  google_event_id: string | null;
  starts_at: string;
  ends_at: string;
  status: MeetingStatus;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface MeetingParticipantUser {
  id: string;
  full_name: string;
  role: UserRole;
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  status: ParticipantStatus;
  invited_by: string | null;
  responded_at: string | null;
  user?: MeetingParticipantUser;
}

export interface MeetingWithParticipants extends Meeting {
  participants: MeetingParticipant[];
}

export interface CreateMeetingInput {
  title: string;
  description?: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  participantUserIds: string[]; // creator is auto-added server-side, no need to include self
}

export interface InviteCandidate {
  id: string;
  full_name: string;
  role: UserRole;
}