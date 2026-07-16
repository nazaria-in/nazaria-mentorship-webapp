// /components/meetings/AcceptDeclineControls.tsx

"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateParticipantStatus } from "@/lib/api/meetings";
import type { MeetingWithParticipants } from "@/types/meetings";

export interface AcceptDeclineControlsProps {
  meeting: MeetingWithParticipants;
  currentUserId: string;
  /** Query keys to invalidate after a response, so every surface this is mounted on refreshes. */
  invalidateQueryKeys?: string[][];
}

/**
 * Shared between /meetings (pending invites section) and the dashboard.
 * Renders nothing if the current user isn't a pending participant on this meeting.
 */
export function AcceptDeclineControls({
  meeting,
  currentUserId,
  invalidateQueryKeys = [],
}: AcceptDeclineControlsProps): React.JSX.Element | null {
  const queryClient = useQueryClient();

  const participant = meeting.participants.find((p) => p.user_id === currentUserId);

  const mutation = useMutation({
    mutationFn: (status: "accepted" | "declined") => {
      if (!participant) throw new Error("No participant record for this user on this meeting");
      return updateParticipantStatus(participant.id, status);
    },
    onSuccess: () => {
      invalidateQueryKeys.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });

  if (!participant || participant.status !== "pending") return null;

  const startsAtLabel = new Date(meeting.starts_at).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="surface-card-alt flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-text-primary">{meeting.title}</p>
        <p className="text-xs text-text-muted">{startsAtLabel}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => mutation.mutate("declined")}
          disabled={mutation.isPending}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-primary hover:bg-card disabled:opacity-50"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => mutation.mutate("accepted")}
          disabled={mutation.isPending}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Accept
        </button>
      </div>
      {mutation.isError && (
        <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>
      )}
    </div>
  );
}