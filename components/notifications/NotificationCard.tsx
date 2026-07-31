// /components/notifications/NotificationCard.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markNotificationRead } from "@/lib/api/notifications";
import { respondToMeetingInvite } from "@/lib/api/meetings";
import { getNotificationAction, isOverdueNotification } from "@/lib/notifications/card-actions";
import { NotificationWithDelivery } from "@/types/notifications";

export interface NotificationCardProps {
  notification: NotificationWithDelivery;
  /** Called after a successful mark-read or accept/decline, so the list owner can update local state. */
  onRead?: (userNotificationId: string) => void;
  /** Tighter padding for the bell dropdown vs. the full /notifications page. */
  dense?: boolean;
}

type LocalRsvpStatus = "accepted" | "declined" | null;

export function NotificationCard({ notification, onRead, dense = false }: NotificationCardProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [isResolving, setIsResolving] = useState(false);
  const [localRsvpStatus, setLocalRsvpStatus] = useState<LocalRsvpStatus>(null);
  const isUnread = notification.readAt === null;
  const isOverdue = isOverdueNotification(notification);
  const action = getNotificationAction(notification);

  async function handleMarkRead(): Promise<void> {
    if (!isUnread) return;
    const supabase = createClient();
    await markNotificationRead(supabase, notification.userNotificationId);
    onRead?.(notification.userNotificationId);
  }

  async function handleRespond(status: "accepted" | "declined"): Promise<void> {
    if (!notification.meeting_id) return;
    setIsResolving(true);
    try {
      await respondToMeetingInvite(notification.meeting_id, status);
      // Reflect the choice immediately in this card, rather than relying on
      // a parent refetch that may not happen right away (e.g. the bell
      // dropdown only reloads on its realtime subscription firing).
      setLocalRsvpStatus(status);
      await handleMarkRead();
      // Meeting-bearing surfaces (the /meetings page, dashboard widgets)
      // key their queries as ["meetings", ...] — invalidate broadly so
      // every one of them refetches and reflects the new participant status.
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
    } catch (error) {
      console.error("[NotificationCard] Failed to respond to meeting invite", error);
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
      {isUnread && (
        <button
          type="button"
          onClick={handleMarkRead}
          aria-label="Mark as read"
          className="absolute top-3 right-3 rounded-full p-1 text-text-muted hover:bg-card-alt"
        >
          <Check size={14} />
        </button>
      )}

      <div className="flex items-start gap-2 pr-8">
        {isUnread && <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-heading text-sm font-semibold text-text-primary">{notification.title}</p>
            {isOverdue && (
              <span className="shrink-0 rounded-full border border-border-strong bg-card-alt px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                Overdue
              </span>
            )}
          </div>
          {notification.body && <p className="mt-0.5 line-clamp-2 text-sm text-text-muted">{notification.body}</p>}
          <p className="mt-1 text-xs text-text-muted">{relativeTime(notification.created_at)}</p>
        </div>
      </div>

      <div className={`mt-3 flex items-center gap-2 ${isUnread ? "pl-4" : "pl-4"}`}>
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