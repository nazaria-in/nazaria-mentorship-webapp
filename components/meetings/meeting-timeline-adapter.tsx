// /components/meetings/meeting-timeline-adapter.tsx

"use client";

import * as React from "react";
import { AcceptDeclineControls } from "@/components/meetings/AcceptDeclineControls";
import { cancelMeeting } from "@/lib/api/meetings";
import type { MeetingWithParticipants } from "@/types/meetings";
import type { TimelineEvent } from "@/types/timeline";
import type { UserRole } from "@/types/users";

export function formatTimeRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateLabel = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const startLabel = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endLabel = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateLabel} · ${startLabel} – ${endLabel}`;
}

/** Mirrors the server check in PATCH /api/meetings/[meetingId] exactly —
 *  creator or staff, and only while the meeting hasn't started yet. Kept
 *  in one place so button-hiding here can't drift from what the API
 *  actually allows (worst case is a wrongly-hidden button, never a
 *  wrongly-shown one, since the server re-checks regardless). */
function canManageMeeting(meeting: MeetingWithParticipants, currentUserId: string, currentUserRole: UserRole): boolean {
  const isCreator = meeting.created_by === currentUserId;
  const isStaff = currentUserRole === "pm" || currentUserRole === "associate";
  const hasStarted = new Date(meeting.starts_at) <= new Date();
  return (isCreator || isStaff) && !hasStarted;
}

export interface MeetingTimelineEventOptions {
  currentUserId: string;
  currentUserRole: UserRole;
  invalidateQueryKeys: string[][];
  /** Opens whatever edit UI the caller wants — the adapter has no edit
   *  form itself, it only decides whether the Edit button appears.
   *  Omit to hide the button entirely (e.g. edit UI not built yet). */
  onEdit?: (meeting: MeetingWithParticipants) => void;
  /** Called after a successful cancel so the caller can invalidate/refetch. */
  onCancelled?: (meeting: MeetingWithParticipants) => void;
}

/**
 * BREAKING SIGNATURE CHANGE from the previous (meeting, currentUserId,
 * invalidateQueryKeys) positional form — deliberately switched to a single
 * options object rather than inserting a new positional currentUserRole
 * param, so every call site fails typecheck loudly (missing required
 * field) instead of silently accepting a role passed into the wrong slot.
 */
export function meetingToTimelineEvent(
  meeting: MeetingWithParticipants,
  options: MeetingTimelineEventOptions,
): TimelineEvent {
  const { currentUserId, currentUserRole, invalidateQueryKeys, onEdit, onCancelled } = options;
  const myParticipant = meeting.participants.find((p) => p.user_id === currentUserId);
  const canManage = canManageMeeting(meeting, currentUserId, currentUserRole);

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
    renderActions: () => (
      <MeetingActions meeting={meeting} canManage={canManage} onEdit={onEdit} onCancelled={onCancelled} />
    ),
  };
}

function MeetingActions({
  meeting,
  canManage,
  onEdit,
  onCancelled,
}: {
  meeting: MeetingWithParticipants;
  canManage: boolean;
  onEdit?: (meeting: MeetingWithParticipants) => void;
  onCancelled?: (meeting: MeetingWithParticipants) => void;
}): React.JSX.Element | null {
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  async function handleCancel() {
    const confirmed = window.confirm(
      `Cancel "${meeting.title}"? Participants will no longer see this on their calendar. This can't be undone.`,
    );
    if (!confirmed) return;

    setIsCancelling(true);
    setCancelError(null);
    try {
      await cancelMeeting(meeting.id);
      onCancelled?.(meeting);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Couldn't cancel this meeting. Try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  const joinButton =
    meeting.meet_link && meeting.status !== "cancelled" ? (
      <a
        href={meeting.meet_link}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
      >
        Join meeting
      </a>
    ) : null;

  if (!canManage || meeting.status === "cancelled") return joinButton;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        {joinButton}
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(meeting)}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-primary hover:bg-card-alt dark:border-border dark:text-text-primary dark:hover:bg-card-alt"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={handleCancel}
          disabled={isCancelling}
          className="rounded-lg border border-destructive px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50 dark:border-destructive dark:text-destructive dark:hover:bg-destructive/10"
        >
          {isCancelling ? "Cancelling…" : "Cancel meeting"}
        </button>
      </div>
      {cancelError && <p className="text-xs text-destructive dark:text-destructive">{cancelError}</p>}
    </div>
  );
}