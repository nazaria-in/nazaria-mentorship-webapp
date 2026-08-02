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
  userId: string | null;
}

type QuickFilter = "all" | "unread" | "meetings" | "assignments" | "messages";

const QUICK_FILTER_TYPES: Record<QuickFilter, NotificationType[] | null> = {
  all: null,
  unread: null,
  meetings: ["meeting_invite", "meeting_started", "reminder", "exit_survey_pending"],
  assignments: ["assignment_due", "assignment_submitted", "assignment_reviewed", "achievement"],
  messages: ["message"],
};

// Fallback poll interval. The realtime subscription below is the primary
// update path; this exists purely to recover from missed/dropped realtime
// events (e.g. tab backgrounded, websocket reconnect gap) without requiring
// the user to click the bell or refresh the page.
const POLL_INTERVAL_MS = 60_000;

export function NotificationBell({ userId }: NotificationBellProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationWithDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const containerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async (): Promise<void> => {
    if (!userId) return;
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
    if (!userId) return;
    const supabase = createClient();
    const count = await fetchUnreadNotificationCount(supabase, userId);
    setUnreadCount(count);
  }, [userId]);

  const toggleOpen = () => {
    if (!userId) return;
    setIsOpen((prev) => {
      const nextState = !prev;
      if (nextState) {
        void loadNotifications();
      }
      return nextState;
    });
  };

  // Initial unread-count fetch + realtime subscription for this userId.
  // - No setState is ever called synchronously in the effect body.
  // - The fetch uses AbortController; setState only happens inside the
  //   resolved-promise callback, guarded by signal.aborted, so a stale
  //   response from a superseded userId can never overwrite fresh state.
  // - There is no "reset to null" branch here: when userId is null the
  //   component's render path below short-circuits to the disabled bell
  //   before unreadCount/notifications are ever read, so stale values
  //   sitting unused in state need no explicit clearing.
  useEffect(() => {
    if (!userId) {
      return;
    }

    const controller = new AbortController();
    const supabase = createClient();

    fetchUnreadNotificationCount(supabase, userId)
      .then((count) => {
        if (!controller.signal.aborted) {
          setUnreadCount(count);
        }
      })
      .catch(() => {
        // Swallow: a failed initial count fetch just leaves the badge at
        // its previous value; the realtime subscription below will
        // correct it on the next event.
      });

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
      controller.abort();
      void supabase.removeChannel(channel);
    };
  }, [userId, isOpen, refreshUnreadCount, loadNotifications]);

  // Polling fallback: re-checks unread count every POLL_INTERVAL_MS, and
  // also refreshes the loaded list if the dropdown is currently open.
  // Independent of the realtime effect above so a realtime reconnect
  // churn doesn't reset this timer's cadence.
  useEffect(() => {
    if (!userId) {
      return;
    }

    const intervalId = setInterval(() => {
      // Only poll while the tab is actually visible, to avoid burning
      // requests (and Supabase quota) on backgrounded tabs.
      if (document.visibilityState !== "visible") return;
      void refreshUnreadCount();
      if (isOpen) void loadNotifications();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
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
    if (!userId) return;
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

  if (!userId) {
    return (
      <button
        type="button"
        disabled
        aria-label="Notifications loading"
        className="relative rounded-full p-2 text-text-primary/40 dark:text-text-primary/30"
      >
        <Bell size={20} />
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative rounded-full p-2 text-text-primary hover:bg-card-alt dark:hover:bg-white/5"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[90vw] rounded-2xl border border-border bg-surface shadow-lg dark:border-white/10 dark:bg-surface">
          <div className="flex items-center justify-between border-b border-border p-3 dark:border-white/10">
            <p className="font-heading text-sm font-semibold text-text-primary">Notifications</p>
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              className="text-xs font-medium text-text-accent hover:underline"
            >
              Mark all read
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto border-b border-border p-2 dark:border-white/10">
            {(["all", "unread", "meetings", "assignments", "messages"] as QuickFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setQuickFilter(filter)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${
                  quickFilter === filter
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-text-muted hover:bg-card-alt dark:border-white/10 dark:hover:bg-white/5"
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

          <div className="border-t border-border p-2 text-center dark:border-white/10">
            <Link href="/notifications" className="text-xs font-medium text-text-accent hover:underline" onClick={() => setIsOpen(false)}>
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}