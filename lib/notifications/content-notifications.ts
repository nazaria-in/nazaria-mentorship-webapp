// /lib/notifications/content-notifications.ts

import { createNotification, cancelPendingNotifications } from "@/lib/api/notifications";
import type { NotificationsClient } from "@/types/notifications";
import { CONTENT_REMINDER_PERCENTS } from "./config";

export interface ContentReminderInput {
  contentDispatchId: string;
  menteeId: string;
  contentItemTitle: string;
  requirement: "required" | "optional" | "disabled";
  /** Kept for interface compatibility */
  submissionStartsAt?: string | null;
  submissionEndsAt?: string | null;
}

/**
 * Fires a single immediate notification to the mentee when content is assigned/created.
 */
export async function scheduleContentReminders(
  supabase: NotificationsClient, 
  input: ContentReminderInput
): Promise<void> {
  await createNotification(supabase, {
    createdBy: null,
    type: "assignment_due",
    title: `${input.contentItemTitle} — new item assigned`,
    body: "You have a new item available.",
    recipientUserIds: [input.menteeId],
    scheduledFor: new Date(),
    contentDispatchId: input.contentDispatchId,
  });
}

/**
 * Cancels any still-pending reminders for a dispatch.
 */
export async function cancelContentReminders(
  supabase: NotificationsClient, 
  contentDispatchId: string
): Promise<void> {
  await cancelPendingNotifications(supabase, { contentDispatchId });
}

export async function notifyContentSubmitted(
  supabase: NotificationsClient,
  input: { contentDispatchId: string; contentItemTitle: string; recipientMentorIds: string[]; menteeName: string }
): Promise<void> {
  if (input.recipientMentorIds.length === 0) return;
  await createNotification(supabase, {
    createdBy: null,
    type: "assignment_submitted",
    title: `${input.contentItemTitle} — new submission`,
    body: `${input.menteeName} submitted work for review.`,
    recipientUserIds: input.recipientMentorIds,
    contentDispatchId: input.contentDispatchId,
  });
}
export async function notifyContentReviewed(
  supabase: NotificationsClient,
  input: {
    contentDispatchId: string;
    contentItemTitle: string;
    menteeId: string;
    status: "approved" | "revision_requested";
  }
): Promise<void> {
  await createNotification(supabase, {
    createdBy: null,
    type: "assignment_reviewed",
    title: `${input.contentItemTitle} — ${input.status === "approved" ? "approved" : "revision requested"}`,
    body:
      input.status === "approved"
        ? "Your submission was approved."
        : "Your mentor requested changes — check the feedback.",
    recipientUserIds: [input.menteeId],
    contentDispatchId: input.contentDispatchId,
  });
}

async function hasExistingCompletionNotification(
  supabase: NotificationsClient, 
  contentDispatchId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("content_dispatch_id", contentDispatchId)
    .eq("type", "achievement")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[content-notifications] Failed to check for existing completion notification", error, { contentDispatchId });
    return true;
  }

  return data !== null;
}

export async function notifyContentCompleted(
  supabase: NotificationsClient,
  input: { contentDispatchId: string; menteeId: string; contentItemTitle: string }
): Promise<void> {
  await cancelContentReminders(supabase, input.contentDispatchId);

  const alreadyNotified = await hasExistingCompletionNotification(supabase, input.contentDispatchId);
  if (alreadyNotified) return;

  await createNotification(supabase, {
    createdBy: null,
    type: "achievement",
    title: `${input.contentItemTitle} — completed!`,
    body: "This has been marked complete.",
    recipientUserIds: [input.menteeId],
    contentDispatchId: input.contentDispatchId,
  });
}

export async function scheduleContentDeadlineReminders(
  supabase: NotificationsClient,
  input: {
    contentDispatchId: string;
    menteeId: string;
    contentItemTitle: string;
    submissionStartsAt: string | null;
    submissionEndsAt: string | null;
  }
): Promise<void> {
  // Not-required items (submission_template.metadata.is_not_required) have
  // no window at all — the DB check constraint guarantees start+end are
  // only both-null in that case, so this guard doubles as that detection.
  if (!input.submissionStartsAt || !input.submissionEndsAt) return;

  const startMs = new Date(input.submissionStartsAt).getTime();
  const endMs = new Date(input.submissionEndsAt).getTime();
  const now = Date.now();

  const stages = [
    { pct: CONTENT_REMINDER_PERCENTS.fortyPercent, label: "40% through the window" },
    { pct: CONTENT_REMINDER_PERCENTS.seventyPercent, label: "70% through the window" },
  ];

  for (const stage of stages) {
    const scheduledForMs = startMs + stage.pct * (endMs - startMs);
    if (scheduledForMs <= now) continue;
    await createNotification(supabase, {
      createdBy: null,
      type: "reminder",
      title: `${input.contentItemTitle} — ${stage.label}`,
      body: "This is due soon.",
      recipientUserIds: [input.menteeId],
      scheduledFor: new Date(scheduledForMs),
      contentDispatchId: input.contentDispatchId,
    });
  }

  // Overdue: fires once, right at the window's end. The view suppresses
  // this automatically if content_dispatches.completed_at gets set before
  // scheduled_for arrives — no manual cancellation needed for this one,
  // unlike the meeting cascade, precisely because it's a view-gated read
  // rather than a cron-dispatched write.
  const overdueMs = Math.max(endMs, now);
  await createNotification(supabase, {
    createdBy: null,
    type: "reminder",
    title: `${input.contentItemTitle} — overdue`,
    body: "This is now past its submission window.",
    recipientUserIds: [input.menteeId],
    scheduledFor: new Date(overdueMs),
    contentDispatchId: input.contentDispatchId,
  });
}