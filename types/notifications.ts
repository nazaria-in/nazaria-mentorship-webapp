// /lib/notifications/types.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type NotificationType = Database["public"]["Enums"]["notification_type"];

/**
 * All three client factories in this project (lib/supabase/client's
 * browser client, lib/supabase/server's server client, and
 * lib/supabase/admin's service-role client) return SupabaseClient<Database>
 * — so every function below takes this as a parameter instead of creating
 * its own client. That's what makes the same functions callable from
 * client-side mutations (submitVersion, sendMessage, ...) and from server
 * routes (meetings PATCH/POST) without duplicating logic per context.
 */
export type NotificationsClient = SupabaseClient<Database>;

export interface CreateNotificationInput {
  createdBy: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  recipientUserIds: string[];
  /** Omit or set to a past/now timestamp for "send on next cron tick". */
  scheduledFor?: Date;
  meetingId?: string;
  menteeAssignmentId?: string;
  exitSurveyId?: string;
  messageId?: string;
  resourceId?: string;
  actionItems?: string;
}

export interface NotificationRow {
  id: string;
  created_by: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  scheduled_for: string;
  meeting_id: string | null;
  mentee_assignment_id: string | null;
  exit_survey_id: string | null;
  message_id: string | null;
  resource_id: string | null;
  action_items: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface UserNotificationRow {
  id: string;
  notification_id: string;
  user_id: string;
  status: Database["public"]["Enums"]["notification_delivery_status"];
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

/** A notification joined with its own delivery/read row — what the UI renders. */
export interface NotificationWithDelivery extends NotificationRow {
  userNotificationId: string;
  readAt: string | null;
}