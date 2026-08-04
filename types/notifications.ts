// /types/notifications.ts

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * RECONSTRUCTED from confirmed real usage across lib/api/notifications.ts,
 * lib/notifications/{meeting,exit-survey,message}-notifications.ts, and
 * lib/notifications/card-actions.ts — all five were shared as real,
 * current files, so every field below is backed by an actual read/write
 * site, not a guess. The one substantive change from what those files
 * currently do: `menteeAssignmentId`/`resourceId` (camelCase, on
 * CreateNotificationInput) and `mentee_assignment_id`/`resource_id`
 * (snake_case, on the row type card-actions.ts reads) are replaced with
 * `contentDispatchId`/`content_dispatch_id` and
 * `contentSubmissionId`/`content_submission_id` — matching the real
 * `notifications` table columns you confirmed. The old columns don't
 * exist on the live table; every file still referencing them (notifications.ts's
 * insert, card-actions.ts's switch) was writing/reading fields that 500 or
 * silently return undefined against the real schema.
 */

export type NotificationType =
  | "meeting_invite"
  | "meeting_started"
  | "assignment_due"
  | "assignment_submitted"
  | "assignment_reviewed"
  | "exit_survey_pending"
  | "message"
  | "reminder"
  | "achievement";

/** The real supabase-js client satisfies everything lib/api/notifications.ts needs structurally. */
export type NotificationsClient = SupabaseClient;

export interface CreateNotificationInput {
  createdBy: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  recipientUserIds: string[];
  /** Defaults to "now" (immediate) when omitted. */
  scheduledFor?: Date;
  meetingId?: string;
  exitSurveyId?: string;
  messageId?: string;
  /** REPLACES the old `menteeAssignmentId` — see file header. */
  contentDispatchId?: string;
  /** REPLACES the old `resourceId` — see file header. */
  contentSubmissionId?: string;
}

/** Mirrors the real `notifications` table row (snake_case = actual column names). */
export interface Notification {
  id: string;
  created_by: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  meeting_id: string | null;
  exit_survey_id: string | null;
  message_id: string | null;
  content_dispatch_id: string | null;
  content_submission_id: string | null;
  scheduled_for: string | null;
  created_at: string;
  deleted_at: string | null;
  action_items: string | null;
}

export interface NotificationWithDelivery extends Notification {
  userNotificationId: string;
  readAt: string | null;
}