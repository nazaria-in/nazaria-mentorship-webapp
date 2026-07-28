// /lib/api/notification-builders.ts

import { createClient } from "@/lib/supabase/client";
import { createNotification } from "@/lib/api/notifications";

export async function scheduleMeetingReminders(
  meeting: {
    id: string;
    starts_at: string;
    ends_at: string;
    title: string;
    meet_link: string | null;
  },
  participantUserId: string
): Promise<void> {
  const supabase = createClient();

  const start = new Date(meeting.starts_at).getTime();
  const end = new Date(meeting.ends_at).getTime();
  const now = Date.now();

  const stages: {
    offsetMs: number;
    type: "reminder" | "meeting_started" | "exit_survey_pending";
    label: string;
  }[] = [
    { offsetMs: -3 * 86_400_000, type: "reminder", label: "in 3 days" },
    { offsetMs: -1 * 86_400_000, type: "reminder", label: "tomorrow" },
    { offsetMs: -1 * 3_600_000, type: "reminder", label: "in 1 hour" },
    { offsetMs: 0, type: "meeting_started", label: "now" },
    { offsetMs: 0.8 * (end - start), type: "exit_survey_pending", label: "wrapping up" },
  ];

  for (const stage of stages) {
    const scheduledFor = new Date(start + stage.offsetMs);
    if (scheduledFor.getTime() <= now) continue; // skip already-past marks

    await createNotification(supabase, {
      createdBy: null,
      type: stage.type,
      title: `${meeting.title} — ${stage.label}`,
      body:
        stage.type === "exit_survey_pending"
          ? "Please fill out your exit survey."
          : meeting.meet_link ?? undefined,
      recipientUserIds: [participantUserId],
      scheduledFor,
      meetingId: meeting.id,
    });
  }
}