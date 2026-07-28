// /lib/notifications/meeting-notifications.ts

import { createNotification, cancelPendingNotifications } from "@/lib/api/notifications";
import { MEETING_REMINDER_OFFSETS_MS } from "@/lib/notifications/config";
import { NotificationsClient } from "@/types/notifications";

// Exit-survey reminders are NOT scheduled here — a meeting can produce
// several exit_surveys rows (the mentee's own + one per mentor<->mentee
// pair), each needs its own reminder against its own exit_survey_id and
// its own submitter (user_id), not a generic one-per-participant stage.
// See lib/notifications/exit-survey-notifications.ts, called separately
// right after createPendingExitSurveys() in app/api/meetings/route.ts.

export interface MeetingForNotifications {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  meet_link: string | null;
}

/**
 * Immediate meeting_invite, sent once per invited participant. `isReinvite`
 * changes only the copy (used on reschedule, where everyone gets asked to
 * re-confirm) — same notification type either way, so the card UI doesn't
 * need a special case.
 */
export async function notifyMeetingInvite(
  supabase: NotificationsClient,
  meeting: MeetingForNotifications,
  participantUserId: string,
  createdBy: string,
  isReinvite = false
): Promise<void> {
  await createNotification(supabase, {
    createdBy,
    type: "meeting_invite",
    title: meeting.title,
    body: isReinvite
      ? "This meeting was rescheduled — please confirm your availability."
      : "You've been invited to a meeting.",
    recipientUserIds: [participantUserId],
    meetingId: meeting.id,
  });
}

/**
 * Schedules the meeting-time cascade (T-3d, T-1d, T-1h, meeting_started)
 * for one participant. Exit-survey nudges are NOT part of this — see
 * lib/notifications/exit-survey-notifications.ts, scheduled per pending
 * exit_surveys row instead of per participant. Called for EVERY invited
 * participant at invite time, regardless of accept/decline/no-response —
 * the meeting happens either way. Timestamps already in the past at call
 * time are skipped (e.g. inviting someone the day before a meeting means
 * no T-3d reminder gets scheduled for them).
 */
export async function scheduleMeetingReminders(
  supabase: NotificationsClient,
  meeting: MeetingForNotifications,
  participantUserId: string
): Promise<void> {
  const startsAtMs = new Date(meeting.starts_at).getTime();
  const now = Date.now();

  const stages: { scheduledForMs: number; type: "reminder" | "meeting_started"; label: string; body: string }[] = [
    {
      scheduledForMs: startsAtMs + MEETING_REMINDER_OFFSETS_MS.threeDaysBefore,
      type: "reminder",
      label: "in 3 days",
      body: `${meeting.title} is coming up in 3 days.`,
    },
    {
      scheduledForMs: startsAtMs + MEETING_REMINDER_OFFSETS_MS.oneDayBefore,
      type: "reminder",
      label: "tomorrow",
      body: `${meeting.title} is tomorrow.`,
    },
    {
      scheduledForMs: startsAtMs + MEETING_REMINDER_OFFSETS_MS.oneHourBefore,
      type: "reminder",
      label: "in 1 hour",
      body: `${meeting.title} starts in 1 hour.`,
    },
    {
      scheduledForMs: startsAtMs,
      type: "meeting_started",
      label: "starting now",
      body: meeting.meet_link ? `${meeting.title} is starting now.` : `${meeting.title} is starting now — no meet link set.`,
    },
  ];

  for (const stage of stages) {
    if (stage.scheduledForMs <= now) continue;

    await createNotification(supabase, {
      createdBy: null,
      type: stage.type,
      title: `${meeting.title} — ${stage.label}`,
      body: stage.body,
      recipientUserIds: [participantUserId],
      scheduledFor: new Date(stage.scheduledForMs),
      meetingId: meeting.id,
    });
  }
} 

/** Call when a participant declines — no point reminding them about a meeting they opted out of. */
export async function cancelMeetingRemindersForParticipant(
  supabase: NotificationsClient,
  meetingId: string,
  userId: string
): Promise<void> {
  await cancelPendingNotifications(supabase, { meetingId, userId });
}

/** Call when a meeting is cancelled outright — cancels for every participant. */
export async function cancelAllMeetingReminders(
  supabase: NotificationsClient,
  meetingId: string
): Promise<void> {
  await cancelPendingNotifications(supabase, { meetingId });
}

/**
 * Full reschedule flow: cancels every participant's pending reminders,
 * then re-invites and re-schedules for ALL of them (not just previously-
 * accepted ones — a new time might work for someone who'd declined the
 * old one). Caller is responsible for resetting meeting_participants.status
 * back to 'pending' (except the creator) before calling this — that's a
 * DB update, not a notification concern, so it stays in the route.
 */
export async function rescheduleMeetingNotifications(
  supabase: NotificationsClient,
  meeting: MeetingForNotifications,
  allParticipantUserIds: string[],
  createdBy: string
): Promise<void> {
  await cancelAllMeetingReminders(supabase, meeting.id);

  for (const userId of allParticipantUserIds) {
    await notifyMeetingInvite(supabase, meeting, userId, createdBy, true);
    await scheduleMeetingReminders(supabase, meeting, userId);
  }
}