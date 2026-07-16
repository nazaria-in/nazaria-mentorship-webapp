// /components/meetings/MeetingBlock.tsx

"use client";

import * as React from "react";
import type { MeetingWithParticipants } from "@/types/meetings";

export interface MeetingBlockProps {
  meeting: MeetingWithParticipants;
  currentUserId: string;
  onClick?: () => void;
}

export function MeetingBlock({ meeting, currentUserId, onClick }: MeetingBlockProps): React.JSX.Element {
  const myStatus = meeting.participants.find((p) => p.user_id === currentUserId)?.status;
  const isCancelled = meeting.status === "cancelled";

  const startLabel = new Date(meeting.starts_at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <button
      type="button"
      onClick={onClick}
      className={`surface-card-strong h-full w-full overflow-hidden text-left ${
        isCancelled ? "opacity-50 line-through" : ""
      }`}
    >
      <p className="truncate text-xs font-semibold text-text-primary">{meeting.title}</p>
      <p className="truncate text-[11px] text-text-muted">{startLabel}</p>
      {myStatus === "pending" && (
        <span className="mt-0.5 inline-block rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
          Pending
        </span>
      )}
    </button>
  );
}