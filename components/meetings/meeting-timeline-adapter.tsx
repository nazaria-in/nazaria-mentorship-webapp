// /components/meetings/meeting-timeline-adapter.tsx

"use client";

import * as React from "react";
import { AcceptDeclineControls } from "@/components/meetings/AcceptDeclineControls";
import type { MeetingWithParticipants } from "@/types/meetings";
import type { TimelineEvent } from "@/types/timeline";

export function formatTimeRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateLabel = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const startLabel = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endLabel = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateLabel} · ${startLabel} – ${endLabel}`;
}

export function meetingToTimelineEvent(
  meeting: MeetingWithParticipants,
  currentUserId: string,
  invalidateQueryKeys: string[][],
): TimelineEvent {
  const myParticipant = meeting.participants.find((p) => p.user_id === currentUserId);

  return {
    id: meeting.id,
    type: "meeting",
    title: meeting.title,
    startsAt: meeting.starts_at,
    endsAt: meeting.ends_at,
    isMuted: meeting.status === "cancelled",
    statusLabel: myParticipant?.status === "pending" ? "Pending" : undefined,
    renderDetails: () => (
      <div className="flex flex-col gap-3">
        {meeting.description && <p className="text-sm text-text-primary">{meeting.description}</p>}
        <div>
          <p className="text-xs font-semibold uppercase text-text-muted">Participants</p>
          <ul className="mt-1 flex flex-col gap-1">
            {meeting.participants.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm text-text-primary">
                <span>{p.user?.full_name ?? "Unknown"}</span>
                <span className="text-xs capitalize text-text-muted">{p.status}</span>
              </li>
            ))}
          </ul>
        </div>
        {myParticipant?.status === "pending" && (
          <AcceptDeclineControls meeting={meeting} currentUserId={currentUserId} invalidateQueryKeys={invalidateQueryKeys} />
        )}
      </div>
    ),
    renderActions: () =>
      meeting.meet_link && meeting.status !== "cancelled" ? (
        <a
          href={meeting.meet_link}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
        >
          Join meeting
        </a>
      ) : null,
  };
}