// /components/notifications/NotificationCard.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markNotificationRead } from "@/lib/api/notifications";
import { respondToMeetingInvite } from "@/lib/api/meetings";
import { getNotificationAction, isOverdueNotification } from "@/lib/notifications/card-actions";
import { NotificationWithDelivery } from "@/types/notifications";

export interface NotificationCardProps {
  notification: NotificationWithDelivery;
  onRead?: (userNotificationId: string) => void;
  onDelete?: (userNotificationId: string) => void;
  dense?: boolean;
}

type LocalRsvpStatus = "accepted" | "declined" | null;

async function deleteNotification(userNotificationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("user_notifications")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", userNotificationId);
  if (error) throw error;
}

export function NotificationCard({
  notification,
  onRead,
  onDelete,
  dense = false,
}: NotificationCardProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [isResolving, setIsResolving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Track read state locally so the mark-read tick → delete button
  // transition happens immediately without waiting for a parent refetch.
  const [locallyRead, setLocallyRead] = useState(notification.readAt !== null);

  // Track RSVP locally so the Accept/Decline buttons don't re-appear if
  // the parent refetches meeting data before the participant status is
  // reflected in the query cache. Previously the card flashed because
  // invalidateQueries triggered a refetch that momentarily returned stale
  // data while the DB write was propagating.
  const [localRsvpStatus, setLocalRsvpStatus] = useState<LocalRsvpStatus>(null);

  const isUnread = !locallyRead;
  const isOverdue = isOverdueNotification(notification);
  const action = getNotificationAction(notification);

  async function handleMarkRead(): Promise<void> {
    if (locallyRead) return;
    try {
      const supabase = createClient();
      await markNotificationRead(supabase, notification.userNotificationId);
      setLocallyRead(true);
      onRead?.(notification.userNotificationId);
    } catch (err) {
      console.error("[NotificationCard] Failed to mark read", err);
    }
  }

  async function handleDelete(): Promise<void> {
    setIsDeleting(true);
    try {
      await deleteNotification(notification.userNotificationId);
      onDelete?.(notification.userNotificationId);
      // Also call onRead so parent unread counts update correctly
      onRead?.(notification.userNotificationId);
    } catch (err) {
      console.error("[NotificationCard] Failed to delete", err);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRespond(status: "accepted" | "declined"): Promise<void> {
    if (!notification.meeting_id) return;
    setIsResolving(true);
    try {
      await respondToMeetingInvite(notification.meeting_id, status);
      // Set local RSVP state BEFORE invalidating — this prevents the card
      // from flashing back to Accept/Decline while the refetch is in flight.
      setLocalRsvpStatus(status);
      await handleMarkRead();
      // Delay invalidation slightly so local state has already painted
      // before the refetch overwrites it.
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["meetings"] });
      }, 300);
    } catch (error) {
      console.error("[NotificationCard] Failed to respond to meeting invite", error);
      // Reset local state so the user can try again
      setLocalRsvpStatus(null);
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <div
      className={`relative rounded-xl border ${dense ? "p-3" : "p-4"} ${
        isUnread ? "bg-card-strong border-border-strong" : "bg-card border-border"
      }`}
    >
      {/* Top-right action button:
          - Unread → tick (mark as read)
          - Read   → trash (soft delete)
          Transitions immediately via locallyRead state, no parent refetch needed. */}
      <div className="absolute right-3 top-3">
        {isUnread ? (
          <button
            type="button"
            onClick={() => void handleMarkRead()}
            aria-label="Mark as read"
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-card-alt dark:hover:bg-white/10"
          >
            <Check size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            aria-label="Delete notification"
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-card-alt hover:text-destructive disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-destructive"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="flex items-start gap-2 pr-8">
        {isUnread && (
          <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-heading text-sm font-semibold text-text-primary">
              {notification.title}
            </p>
            {isOverdue && (
              <span className="shrink-0 rounded-full border border-border-strong bg-card-alt px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                Overdue
              </span>
            )}
          </div>
          {notification.body && (
            <p className="mt-0.5 line-clamp-2 text-sm text-text-muted">{notification.body}</p>
          )}
          <p className="mt-1 text-xs text-text-muted">{relativeTime(notification.created_at)}</p>
        </div>
      </div>

      <div className={`mt-3 flex items-center gap-2 pl-4`}>
        {notification.type === "meeting_invite" ? (
          localRsvpStatus ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
              <Check size={12} className="text-text-accent" />
              {localRsvpStatus === "accepted" ? "You accepted" : "You declined"}
            </p>
          ) : (
            <>
              <button
                type="button"
                disabled={isResolving}
                onClick={() => void handleRespond("accepted")}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={isResolving}
                onClick={() => void handleRespond("declined")}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-primary disabled:opacity-50"
              >
                Decline
              </button>
            </>
          )
        ) : action ? (
          <Link
            href={action.href}
            onClick={() => void handleMarkRead()}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-accent hover:bg-card-alt"
          >
            {action.label}
            <ExternalLink size={12} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function relativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoDate).toLocaleDateString();
}