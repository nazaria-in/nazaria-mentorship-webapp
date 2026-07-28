// /lib/notifications/assignment-notifications.ts

import { createNotification, cancelPendingNotifications } from "@/lib/api/notifications";
import { fetchMenteeAssignmentStatus } from "@/lib/api/assignment-status";
import { ASSIGNMENT_REMINDER_PERCENTS } from "@/lib/notifications/config";
import { NotificationsClient } from "@/types/notifications";

export interface AssignmentReminderInput {
  menteeAssignmentId: string;
  menteeId: string;
  assignmentTitle: string;
  /** The assignment template's start_date — used to compute the anchor. */
  assignmentStartDate: string;
  dueAt: string;
}

/**
 * Immediate "assignment started" notification + the 40/70/90% cascade.
 * Anchor is max(now, assignment.start_date) — if a mentor dispatches an
 * assignment before its official start_date, the clock doesn't start
 * ticking (and the mentee doesn't get a "start" ping) until start_date
 * actually arrives. If dispatched late, the anchor is just "now".
 *
 * This cascade is about the assignment's overall deadline, independent of
 * per-slot submit/review activity — see checkAndNotifyAssignmentCompletion
 * below for the submission-driven side of things.
 */
export async function scheduleAssignmentReminders(
  supabase: NotificationsClient,
  input: AssignmentReminderInput
): Promise<void> {
  const now = Date.now();
  const startDateMs = new Date(input.assignmentStartDate).getTime();
  const dueAtMs = new Date(input.dueAt).getTime();
  const anchorMs = Math.max(now, startDateMs);
  const windowMs = dueAtMs - anchorMs;

  const stages: { scheduledForMs: number; label: string }[] = [
    { scheduledForMs: anchorMs, label: "assigned" },
    { scheduledForMs: anchorMs + ASSIGNMENT_REMINDER_PERCENTS.firstDraft * windowMs, label: "first draft due soon" },
    { scheduledForMs: anchorMs + ASSIGNMENT_REMINDER_PERCENTS.secondCheck * windowMs, label: "keep going" },
    { scheduledForMs: anchorMs + ASSIGNMENT_REMINDER_PERCENTS.finalPresentation * windowMs, label: "final presentation coming up" },
  ];

  for (const stage of stages) {
    if (stage.scheduledForMs <= now && stage.label !== "assigned") continue;

    await createNotification(supabase, {
      createdBy: null,
      type: "assignment_due",
      title: `${input.assignmentTitle} — ${stage.label}`,
      body: `Due ${new Date(input.dueAt).toLocaleDateString()}.`,
      recipientUserIds: [input.menteeId],
      scheduledFor: new Date(Math.max(stage.scheduledForMs, now)),
      menteeAssignmentId: input.menteeAssignmentId,
    });
  }
}

/** Cancels any still-pending due-date reminders — call once an assignment is
 *  actually done, so a mentee doesn't get a "final presentation coming up"
 *  nudge for something they already finished. */
export async function cancelAssignmentReminders(
  supabase: NotificationsClient,
  menteeAssignmentId: string
): Promise<void> {
  await cancelPendingNotifications(supabase, { menteeAssignmentId });
}

async function notifyAssignmentCompleted(
  supabase: NotificationsClient,
  menteeAssignmentId: string,
  menteeId: string,
  assignmentTitle: string
): Promise<void> {
  await cancelAssignmentReminders(supabase, menteeAssignmentId);
  await createNotification(supabase, {
    createdBy: null,
    type: "achievement",
    title: `${assignmentTitle} — completed!`,
    body: "All of your submissions for this assignment have been approved.",
    recipientUserIds: [menteeId],
    menteeAssignmentId,
  });
}

/**
 * Call this immediately after a review-approval mutation succeeds (i.e.
 * right after a mentor sets a mentee_submissions row to 'approved'). It
 * re-reads v_mentee_assignment_status and, if that approval was the last
 * one needed, fires the completion notification and cancels remaining
 * due-date reminders.
 *
 * There's no separate "mark complete" action anywhere — this function is
 * the only path to the completion notification, and it's driven entirely
 * by derived state, so it can't disagree with what SlotSubmissionsPanel
 * or AssignmentCompletionStatus are showing on screen.
 *
 * Safe to call after every approval, including ones that don't complete
 * the assignment — it's a no-op unless completionStatus === 'completed'.
 */
export async function checkAndNotifyAssignmentCompletion(
  supabase: NotificationsClient,
  input: { menteeAssignmentId: string; menteeId: string; assignmentTitle: string }
): Promise<void> {
  const status = await fetchMenteeAssignmentStatus(input.menteeAssignmentId);
  if (status?.completionStatus === "completed") {
    await notifyAssignmentCompleted(supabase, input.menteeAssignmentId, input.menteeId, input.assignmentTitle);
  }
}

export async function notifyAssignmentSubmitted(
  supabase: NotificationsClient,
  input: { menteeAssignmentId: string; assignmentTitle: string; mentorId: string; menteeName: string }
): Promise<void> {
  await createNotification(supabase, {
    createdBy: null,
    type: "assignment_submitted",
    title: `${input.assignmentTitle} — new submission`,
    body: `${input.menteeName} submitted work for review.`,
    recipientUserIds: [input.mentorId],
    menteeAssignmentId: input.menteeAssignmentId,
  });
}

export async function notifyAssignmentReviewed(
  supabase: NotificationsClient,
  input: {
    menteeAssignmentId: string;
    assignmentTitle: string;
    menteeId: string;
    status: "approved" | "revision_requested";
  }
): Promise<void> {
  await createNotification(supabase, {
    createdBy: null,
    type: "assignment_reviewed",
    title: `${input.assignmentTitle} — ${input.status === "approved" ? "approved" : "revision requested"}`,
    body:
      input.status === "approved"
        ? "Your submission was approved."
        : "Your mentor requested changes — check the feedback.",
    recipientUserIds: [input.menteeId],
    menteeAssignmentId: input.menteeAssignmentId,
  });
}