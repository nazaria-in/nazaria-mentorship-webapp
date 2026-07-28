// /components/notifications/NotificationBell.tsx

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchNotificationsForUser,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
} from "@/lib/api/notifications";
import { NotificationCard } from "@/components/notifications/NotificationCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotificationType, NotificationWithDelivery } from "@/types/notifications";

export interface NotificationBellProps {
  userId: string;
}

type QuickFilter = "all" | "unread" | "meetings" | "assignments" | "messages";

const QUICK_FILTER_TYPES: Record<QuickFilter, NotificationType[] | null> = {
  all: null,
  unread: null,
  meetings: ["meeting_invite", "meeting_started", "reminder", "exit_survey_pending"],
  assignments: ["assignment_due", "assignment_submitted", "assignment_reviewed", "achievement"],
  messages: ["message"],
};

export function NotificationBell({ userId }: NotificationBellProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationWithDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const containerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const rows = await fetchNotificationsForUser(supabase, { userId, limit: 30 });
      setNotifications(rows);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const refreshUnreadCount = useCallback(async (): Promise<void> => {
    const supabase = createClient();
    const count = await fetchUnreadNotificationCount(supabase, userId);
    setUnreadCount(count);
  }, [userId]);

  // Handle toggling open/close and loading data in event handler
  const toggleOpen = () => {
    setIsOpen((prev) => {
      const nextState = !prev;
      if (nextState) {
        void loadNotifications();
      }
      return nextState;
    });
  };

  useEffect(() => {
    // Wrap in queueMicrotask to avoid synchronous state update in effect mount
    queueMicrotask(() => {
      void refreshUnreadCount();
    });

    const supabase = createClient();
    const channel = supabase
      .channel(`user_notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${userId}` },
        () => {
          void refreshUnreadCount();
          if (isOpen) void loadNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, isOpen, refreshUnreadCount, loadNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredNotifications = notifications.filter((n) => {
    if (quickFilter === "unread") return n.readAt === null;
    const allowedTypes = QUICK_FILTER_TYPES[quickFilter];
    return allowedTypes === null ? true : allowedTypes.includes(n.type);
  });

  async function handleMarkAllRead(): Promise<void> {
    const supabase = createClient();
    const scopedIds = quickFilter === "all" ? undefined : filteredNotifications.map((n) => n.id);
    await markAllNotificationsRead(supabase, userId, scopedIds);
    await loadNotifications();
    await refreshUnreadCount();
  }

  function handleCardRead(): void {
    void refreshUnreadCount();
    void loadNotifications();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative rounded-full p-2 text-text-primary hover:bg-card-alt"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[90vw] rounded-2xl border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border p-3">
            <p className="font-heading text-sm font-semibold text-text-primary">Notifications</p>
            <button type="button" onClick={() => void handleMarkAllRead()} className="text-xs font-medium text-text-accent hover:underline">
              Mark all read
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto border-b border-border p-2">
            {(["all", "unread", "meetings", "assignments", "messages"] as QuickFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setQuickFilter(filter)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${
                  quickFilter === filter
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-text-muted hover:bg-card-alt"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="max-h-96 space-y-2 overflow-y-auto p-2">
            {isLoading ? (
              <p className="p-4 text-center text-sm text-text-muted">Loading...</p>
            ) : filteredNotifications.length === 0 ? (
              <EmptyState title="No notifications" description="You're all caught up." />
            ) : (
              filteredNotifications.map((n) => (
                <NotificationCard key={n.userNotificationId} notification={n} dense onRead={handleCardRead} />
              ))
            )}
          </div>

          <div className="border-t border-border p-2 text-center">
            <Link href="/notifications" className="text-xs font-medium text-text-accent hover:underline" onClick={() => setIsOpen(false)}>
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}