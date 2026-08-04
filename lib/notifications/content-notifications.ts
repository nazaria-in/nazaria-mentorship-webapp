// /lib/notifications/content-notifications.ts

import { createNotification, cancelPendingNotifications } from "@/lib/api/notifications";
import type { NotificationsClient } from "@/types/notifications";

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
  input: { contentDispatchId: string; contentItemTitle: string; mentorId: string; menteeName: string }
): Promise<void> {
  await createNotification(supabase, {
    createdBy: null,
    type: "assignment_submitted",
    title: `${input.contentItemTitle} — new submission`,
    body: `${input.menteeName} submitted work for review.`,
    recipientUserIds: [input.mentorId],
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