// /app/notifications/page.tsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSessionStore } from "@/store/session-store";
import {
  fetchNotificationsForUser,
  markAllNotificationsRead,
} from "@/lib/api/notifications";
import { NotificationCard } from "@/components/notifications/NotificationCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotificationType, NotificationWithDelivery } from "@/types/notifications";

const TYPE_OPTIONS: { value: NotificationType; label: string }[] = [
  { value: "meeting_invite", label: "Meeting invites" },
  { value: "meeting_started", label: "Meeting started" },
  { value: "reminder", label: "Reminders" },
  { value: "exit_survey_pending", label: "Exit surveys" },
  { value: "assignment_due", label: "Assignments" },
  { value: "assignment_submitted", label: "Submissions" },
  { value: "assignment_reviewed", label: "Reviews" },
  { value: "message", label: "Messages" },
  { value: "achievement", label: "Achievements" },
];

const PAGE_SIZE = 25;

export default function NotificationsPage(): React.JSX.Element {
  const userId = useSessionStore((s) => s.userId);

  // Early return UI state when no authenticated user exists
  if (!userId) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="mb-4 font-heading text-2xl font-semibold text-text-primary">
          Notifications
        </h1>
        <EmptyState
          title="No notifications"
          description="Please log in to view your notifications."
        />
        <div className="mt-4 text-center">
          <Link
            href="/auth/login"
            className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return <AuthenticatedNotificationsPage userId={userId} />;
}

function AuthenticatedNotificationsPage({
  userId,
}: {
  userId: string;
}): React.JSX.Element {
  const [notifications, setNotifications] = useState<NotificationWithDelivery[]>([]);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<NotificationType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadInitialData() {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const rows = await fetchNotificationsForUser(supabase, {
          userId, // Guaranteed string
          onlyUnread,
          types: selectedTypes.length > 0 ? selectedTypes : undefined,
          limit: PAGE_SIZE,
        });

        if (!ignore) {
          setNotifications(rows);
          setHasMore(rows.length === PAGE_SIZE);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      ignore = true;
    };
  }, [userId, onlyUnread, selectedTypes]);

  async function handleLoadMore(): Promise<void> {
    if (isLoading || notifications.length === 0) return;

    const before = notifications[notifications.length - 1]?.created_at;
    setIsLoading(true);

    try {
      const supabase = createClient();
      const rows = await fetchNotificationsForUser(supabase, {
        userId,
        onlyUnread,
        types: selectedTypes.length > 0 ? selectedTypes : undefined,
        limit: PAGE_SIZE,
        before,
      });

      setNotifications((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshNotifications(): Promise<void> {
    const supabase = createClient();
    const rows = await fetchNotificationsForUser(supabase, {
      userId,
      onlyUnread,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      limit: PAGE_SIZE,
    });
    setNotifications(rows);
    setHasMore(rows.length === PAGE_SIZE);
  }

  function toggleType(type: NotificationType): void {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function handleMarkAllRead(): Promise<void> {
    const supabase = createClient();
    const scopedIds =
      onlyUnread || selectedTypes.length > 0
        ? notifications.map((n) => n.id)
        : undefined;

    await markAllNotificationsRead(supabase, userId, scopedIds);
    await refreshNotifications();
  }

  function handleCardRead(): void {
    void refreshNotifications();
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold text-text-primary">
          Notifications
        </h1>
        <button
          type="button"
          onClick={() => void handleMarkAllRead()}
          className="text-sm font-medium text-text-accent hover:underline"
        >
          Mark all read
        </button>
      </div>

      <div className="surface-card mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOnlyUnread((prev) => !prev)}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            onlyUnread
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-text-muted hover:bg-card-alt"
          }`}
        >
          Unread only
        </button>
        {TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => toggleType(option.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              selectedTypes.includes(option.value)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-text-muted hover:bg-card-alt"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {notifications.length === 0 && !isLoading ? (
          <EmptyState
            title="No notifications"
            description="Nothing matches these filters yet."
          />
        ) : (
          notifications.map((n) => (
            <NotificationCard
              key={n.userNotificationId}
              notification={n}
              onRead={handleCardRead}
            />
          ))
        )}
      </div>

      {hasMore && notifications.length > 0 && (
        <div className="mt-4 text-center">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void handleLoadMore()}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-card-alt disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}